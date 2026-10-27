"""ช่วงเวลารายเดือน (เวลาไทย) — ใช้ร่วมกันทั้งหน้าประวัติและหน้าสรุป"""

from datetime import datetime

from .config import BKK

MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"


def month_start(month: str) -> datetime:
    """'2026-10' → 1 ต.ค. 2026 00:00 เวลาไทย"""
    y, m = map(int, month.split("-"))
    return datetime(y, m, 1, tzinfo=BKK)


def add_months(start: datetime, n: int) -> datetime:
    """วันที่ 1 ของเดือนที่เลื่อนไป n เดือน (n ติดลบ = ย้อนหลัง)"""
    index = start.month - 1 + n
    return start.replace(year=start.year + index // 12, month=index % 12 + 1, day=1)


def month_range(month: str) -> tuple[datetime, datetime]:
    """'2026-10' → (1 ต.ค. 00:00, 1 พ.ย. 00:00) เวลาไทย"""
    start = month_start(month)
    return start, add_months(start, 1)
