from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, computed_field, field_validator

from .config import BKK
from .storage import UPLOAD_ID_PATTERN

# รับ/เก็บเป็น Decimal (แม่นยำ) แต่ส่งออก JSON เป็นตัวเลขธรรมดา ให้แอปใช้ง่าย
Money = Annotated[
    Decimal,
    Field(gt=0, max_digits=12, decimal_places=2),
    PlainSerializer(float, return_type=float),
]
# ยอดรวมเป็น 0 ได้ (เดือนที่ยังไม่มีรายจ่าย) เลยแยกจาก Money ที่ต้อง > 0
Total = Annotated[Decimal, PlainSerializer(float, return_type=float)]
Source = Literal["cash", "slip", "receipt"]


def _assume_bkk(v: datetime | None) -> datetime | None:
    """ถ้าเวลาที่ส่งมาไม่มี timezone ให้ถือว่าเป็นเวลาไทย"""
    if v is not None and v.tzinfo is None:
        return v.replace(tzinfo=BKK)
    return v


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    icon: str
    color: str


class ExpenseCreate(BaseModel):
    amount: Money
    spent_at: datetime | None = None  # ไม่ส่งมา = ตอนนี้
    source: Source = "cash"
    category_id: int
    payee: str | None = Field(default=None, max_length=200)
    note: str | None = Field(default=None, max_length=1000)
    upload_id: str | None = Field(default=None, pattern=UPLOAD_ID_PATTERN)  # จาก POST /api/uploads
    # UUID ที่มือถือสร้าง: ส่งซ้ำกี่ครั้งก็ได้แถวเดียว (สำคัญตอนส่งคิวออฟไลน์ที่อาจส่งสำเร็จแต่ไม่ได้คำตอบ)
    client_id: str | None = Field(default=None, pattern=r"^[0-9a-fA-F-]{36}$")

    _tz = field_validator("spent_at")(_assume_bkk)


class ExpenseUpdate(BaseModel):
    """PATCH: ส่งมาเฉพาะช่องที่จะแก้"""

    amount: Money | None = None
    spent_at: datetime | None = None
    category_id: int | None = None
    payee: str | None = Field(default=None, max_length=200)
    note: str | None = Field(default=None, max_length=1000)

    _tz = field_validator("spent_at")(_assume_bkk)


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: Money
    spent_at: datetime
    source: Source
    category: CategoryOut
    payee: str | None
    note: str | None
    created_at: datetime
    # ไม่ส่ง path จริงบนเครื่องออกไป บอกแค่ว่ามีรูปไหม (ดึงรูปผ่าน endpoint ในบทที่ 5)
    image_path: str | None = Field(default=None, exclude=True)

    @computed_field
    @property
    def has_image(self) -> bool:
        return self.image_path is not None


class ExpenseList(BaseModel):
    items: list[ExpenseOut]
    total_count: int  # จำนวนทั้งหมดที่ตรงเงื่อนไข (ไม่ใช่แค่หน้านี้)
    total_amount: Total
