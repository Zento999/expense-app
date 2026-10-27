from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import BKK
from ..deps import get_db, require_token
from ..models import Category, Expense
from ..periods import MONTH_PATTERN, add_months, month_range
from ..schemas import CategoryOut, Total

router = APIRouter(prefix="/api/summary", tags=["summary"], dependencies=[Depends(require_token)])

HISTORY_MONTHS = 6


class CategoryTotal(BaseModel):
    category: CategoryOut
    total: Total
    count: int
    prev_total: Total  # ช่วงเดียวกันของเดือนก่อน


class MonthTotal(BaseModel):
    month: str  # "2026-05"
    total: Total


class SummaryOut(BaseModel):
    month: str
    total: Total
    count: int
    is_current: bool  # เดือนที่ยังไม่จบ
    days: int  # จำนวนวันที่ผ่านไปแล้ว (เดือนที่จบแล้ว = ทั้งเดือน) ใช้คิดค่าเฉลี่ยต่อวัน
    compare_day: int | None  # เทียบกับวันที่ 1..N ของเดือนก่อน (None = เทียบทั้งเดือน)
    prev_same_period_total: Total
    prev_month_total: Total
    by_category: list[CategoryTotal]  # เรียงยอดมาก→น้อย เฉพาะหมวดที่มีรายจ่ายเดือนนี้
    months: list[MonthTotal]  # 6 เดือนล่าสุด เก่า→ใหม่ (เดือนที่ไม่มีรายจ่าย = 0)


def _totals(db: Session, start: datetime, end: datetime) -> tuple[int, Decimal]:
    count, total = db.execute(
        select(func.count(), func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.spent_at >= start, Expense.spent_at < end
        )
    ).one()
    return count, total


def _by_category(db: Session, start: datetime, end: datetime) -> dict[int, tuple[int, Decimal]]:
    rows = db.execute(
        select(Expense.category_id, func.count(), func.sum(Expense.amount))
        .where(Expense.spent_at >= start, Expense.spent_at < end)
        .group_by(Expense.category_id)
    ).all()
    return {cat_id: (count, total) for cat_id, count, total in rows}


@router.get("", response_model=SummaryOut)
def get_summary(month: str = Query(pattern=MONTH_PATTERN, examples=["2026-10"]), db: Session = Depends(get_db)):
    """สรุปเดือน: ยอดรวม, เทียบช่วงเดียวกันเดือนก่อน, แยกหมวด, 6 เดือนย้อนหลัง — DB รวมให้ทั้งหมด"""
    start, end = month_range(month)
    now = datetime.now(BKK)
    is_current = start <= now < end

    # เทียบแบบยุติธรรม: เดือนที่ยังไม่จบ เทียบกับ "ช่วงเดียวกัน" ของเดือนก่อน ไม่ใช่ทั้งเดือน
    # (วันที่ 27 ต.ค. 15:00 → เทียบกับ 1 ก.ย. 00:00 ถึง 27 ก.ย. 15:00)
    prev_start = add_months(start, -1)
    cutoff = now if is_current else end
    prev_cutoff = min(prev_start + (cutoff - start), start)

    count, total = _totals(db, start, end)
    _, prev_same = _totals(db, prev_start, prev_cutoff)
    _, prev_full = _totals(db, prev_start, start)

    current = _by_category(db, start, end)
    previous = _by_category(db, prev_start, prev_cutoff)
    categories = {c.id: c for c in db.scalars(select(Category)).all()}
    by_category = sorted(
        (
            CategoryTotal(
                category=categories[cat_id],
                total=cat_total,
                count=cat_count,
                prev_total=previous.get(cat_id, (0, Decimal(0)))[1],
            )
            for cat_id, (cat_count, cat_total) in current.items()
        ),
        key=lambda c: c.total,
        reverse=True,
    )

    # 6 เดือนล่าสุด: จัดกลุ่มตามเดือน "เวลาไทย" (ไม่ใช่ UTC) ใน query เดียว
    history_start = add_months(start, -(HISTORY_MONTHS - 1))
    month_key = func.to_char(func.timezone("Asia/Bangkok", Expense.spent_at), "YYYY-MM")
    month_totals = dict(
        db.execute(
            select(month_key, func.sum(Expense.amount))
            .where(Expense.spent_at >= history_start, Expense.spent_at < end)
            .group_by(month_key)
        ).all()
    )
    months = []
    for i in range(HISTORY_MONTHS):
        key = add_months(history_start, i).strftime("%Y-%m")
        months.append(MonthTotal(month=key, total=month_totals.get(key, Decimal(0))))

    days = (now.date() - start.date()).days + 1 if is_current else (end - start).days
    return SummaryOut(
        month=month,
        total=total,
        count=count,
        is_current=is_current,
        days=days,
        compare_day=now.day if is_current else None,
        prev_same_period_total=prev_same,
        prev_month_total=prev_full,
        by_category=by_category,
        months=months,
    )
