from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import BKK
from ..deps import get_db, require_token
from ..models import Category, Expense
from ..periods import MONTH_PATTERN, month_range
from ..schemas import ExpenseCreate, ExpenseList, ExpenseOut, ExpenseUpdate
from ..storage import ImageError, attach, delete_image, image_file, pop_ai_result

router = APIRouter(prefix="/api/expenses", tags=["expenses"], dependencies=[Depends(require_token)])

# ช่องที่ห้ามเป็น null ตอน PATCH (ส่ง null มา = ผิด ไม่ใช่ "ลบค่า")
_REQUIRED = {"amount", "spent_at", "category_id"}


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
    month: str | None = Query(default=None, pattern=MONTH_PATTERN, examples=["2026-10"]),
    q: str | None = Query(default=None, max_length=100, description="ค้นใน ร้านค้า/ผู้รับ และ โน้ต"),
    category_id: int | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    filters = []
    if month:
        start, end = month_range(month)
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
    # idempotent: client_id นี้เคยบันทึกแล้ว → คืนแถวเดิม ไม่สร้างซ้ำ
    # (มือถือส่งสำเร็จแต่เน็ตหลุดก่อนได้คำตอบ → คิวออฟไลน์จะส่งซ้ำ)
    if body.client_id and (existing := _find_by_client_id(db, body.client_id)):
        return existing

    _check_category(db, body.category_id)
    expense = Expense(**body.model_dump(exclude={"upload_id"}))
    if expense.spent_at is None:
        expense.spent_at = datetime.now(BKK)

    if body.upload_id:
        try:
            expense.image_path = attach(body.upload_id, expense.spent_at)
        except ImageError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        # ผลดิบจาก AI (ถ้าเคยกดให้อ่าน) เก็บไว้เทียบทีหลังว่า AI อ่านถูกแค่ไหน
        expense.ai_data = pop_ai_result(body.upload_id)

    db.add(expense)
    try:
        db.commit()
    except Exception as e:
        # บันทึก DB ไม่สำเร็จ → ลบรูปที่เพิ่งย้ายไป จะได้ไม่มีไฟล์กำพร้า
        db.rollback()
        if expense.image_path:
            delete_image(expense.image_path)
        # ส่งซ้ำพร้อมกัน 2 request: อีกอันบันทึกไปก่อนแล้ว (ชน unique) → คืนแถวนั้นแทน error
        if isinstance(e, IntegrityError) and body.client_id:
            if existing := _find_by_client_id(db, body.client_id):
                return existing
        raise
    db.refresh(expense)
    return expense


def _find_by_client_id(db: Session, client_id: str) -> Expense | None:
    return db.scalar(select(Expense).where(Expense.client_id == client_id))


@router.get("/{expense_id}", response_model=ExpenseOut)
def get_expense(expense_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, expense_id)


@router.get("/{expense_id}/image", response_class=FileResponse)
def get_expense_image(expense_id: int, thumb: bool = False, db: Session = Depends(get_db)):
    """รูปสลิป/บิลของรายการนี้ (?thumb=true ได้รูปเล็กสำหรับหน้ารายการ)"""
    expense = _get_or_404(db, expense_id)
    path = image_file(expense.image_path, thumb) if expense.image_path else None
    if path is None or not path.exists():
        raise HTTPException(status_code=404, detail="no image")
    # private: ให้มือถือ cache ได้ 1 วัน แต่ห้าม proxy กลางทาง cache
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=86400"})


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
    image_path = expense.image_path
    db.delete(expense)
    db.commit()
    # ลบไฟล์หลัง commit สำเร็จ — ถ้าลบไฟล์ก่อนแล้ว DB พัง รายการจะชี้ไปรูปที่หายไปแล้ว
    if image_path:
        delete_image(image_path)
    return Response(status_code=204)
