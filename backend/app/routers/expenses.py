from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..config import BKK
from ..deps import get_db, require_token
from ..models import Category, Expense
from ..schemas import ExpenseCreate, ExpenseList, ExpenseOut, ExpenseUpdate

router = APIRouter(prefix="/api/expenses", tags=["expenses"], dependencies=[Depends(require_token)])

# ช่องที่ห้ามเป็น null ตอน PATCH (ส่ง null มา = ผิด ไม่ใช่ "ลบค่า")
_REQUIRED = {"amount", "spent_at", "category_id"}


def _month_range(month: str) -> tuple[datetime, datetime]:
    """'2026-10' → (1 ต.ค. 00:00, 1 พ.ย. 00:00) เวลาไทย"""
    y, m = map(int, month.split("-"))
    start = datetime(y, m, 1, tzinfo=BKK)
    end = datetime(y + m // 12, m % 12 + 1, 1, tzinfo=BKK)
    return start, end


def _get_or_404(db: Session, expense_id: int) -> Expense:
    expense = db.get(Expense, expense_id)
    if expense is None:
        raise HTTPException(status_code=404, detail="expense not found")
    return expense


def _check_category(db: Session, category_id: int) -> None:
    if db.get(Category, category_id) is None:
        raise HTTPException(status_code=400, detail="unknown category_id")


@router.get("", response_model=ExpenseList)
def list_expenses(
    month: str | None = Query(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$", examples=["2026-10"]),
    q: str | None = Query(default=None, max_length=100, description="ค้นใน ร้านค้า/ผู้รับ และ โน้ต"),
    category_id: int | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    filters = []
    if month:
        start, end = _month_range(month)
        filters += [Expense.spent_at >= start, Expense.spent_at < end]
    if q:
        filters.append(or_(Expense.payee.ilike(f"%{q}%"), Expense.note.ilike(f"%{q}%")))
    if category_id is not None:
        filters.append(Expense.category_id == category_id)

    items = db.scalars(
        select(Expense)
        .where(*filters)
        .order_by(Expense.spent_at.desc(), Expense.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    total_count, total_amount = db.execute(
        select(func.count(), func.coalesce(func.sum(Expense.amount), 0)).where(*filters)
    ).one()
    return ExpenseList(items=items, total_count=total_count, total_amount=total_amount)


@router.post("", response_model=ExpenseOut, status_code=201)
def create_expense(body: ExpenseCreate, db: Session = Depends(get_db)):
    _check_category(db, body.category_id)
    expense = Expense(**body.model_dump())
    if expense.spent_at is None:
        expense.spent_at = datetime.now(BKK)
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.get("/{expense_id}", response_model=ExpenseOut)
def get_expense(expense_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, expense_id)


@router.patch("/{expense_id}", response_model=ExpenseOut)
def update_expense(expense_id: int, body: ExpenseUpdate, db: Session = Depends(get_db)):
    expense = _get_or_404(db, expense_id)
    # exclude_unset: เอาเฉพาะช่องที่ส่งมาจริง ช่องที่ไม่ได้ส่งจะไม่ถูกแตะ
    changes = body.model_dump(exclude_unset=True)
    for field in _REQUIRED & changes.keys():
        if changes[field] is None:
            raise HTTPException(status_code=422, detail=f"{field} cannot be null")
    if "category_id" in changes:
        _check_category(db, changes["category_id"])
    for field, value in changes.items():
        setattr(expense, field, value)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=204)
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = _get_or_404(db, expense_id)
    db.delete(expense)
    db.commit()
    return Response(status_code=204)
