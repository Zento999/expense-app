from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    icon: Mapped[str] = mapped_column(String(16))  # emoji
    color: Mapped[str] = mapped_column(String(7))  # "#RRGGBB" ใช้ในกราฟ
    sort_order: Mapped[int] = mapped_column(default=0)


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_expenses_amount_positive"),
        CheckConstraint("source IN ('cash', 'slip', 'receipt')", name="ck_expenses_source_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Numeric ไม่ใช่ float: float เก็บ 0.1 ไม่ได้เป๊ะ บวกกันหลายรายการแล้วเศษสตางค์เพี้ยน
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    spent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    source: Mapped[str] = mapped_column(String(10))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"))
    payee: Mapped[str | None] = mapped_column(String(200))  # ร้านค้า / ผู้รับเงิน
    note: Mapped[str | None] = mapped_column(Text)
    image_path: Mapped[str | None] = mapped_column(String(300))  # path สัมพัทธ์ใน receipts_dir
    ai_data: Mapped[dict | None] = mapped_column(JSONB)  # ผลดิบจาก AI ไว้ debug (บทที่ 6)
    client_id: Mapped[str | None] = mapped_column(String(36), unique=True)  # id จากมือถือ กันบันทึกซ้ำ
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    category: Mapped[Category] = relationship(lazy="joined")
