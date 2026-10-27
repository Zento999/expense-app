"""initial: categories + expenses

Revision ID: 0001
Revises:
Create Date: 2026-10-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    categories = op.create_table(
        "categories",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
        sa.Column("icon", sa.String(16), nullable=False),
        sa.Column("color", sa.String(7), nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
    )

    op.create_table(
        "expenses",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("spent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(10), nullable=False),
        sa.Column(
            "category_id",
            sa.Integer,
            sa.ForeignKey("categories.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("payee", sa.String(200)),
        sa.Column("note", sa.Text),
        sa.Column("image_path", sa.String(300)),
        sa.Column("ai_data", JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("amount > 0", name="ck_expenses_amount_positive"),
        sa.CheckConstraint("source IN ('cash', 'slip', 'receipt')", name="ck_expenses_source_valid"),
    )
    op.create_index("ix_expenses_spent_at", "expenses", ["spent_at"])

    # หมวดเริ่มต้น — สีพาสเทลคนละโทน ให้กราฟแยกหมวดออก (เหลืองล้วนจะแยกไม่ออก)
    op.bulk_insert(
        categories,
        [
            {"name": "อาหาร", "icon": "🍜", "color": "#F7C04A", "sort_order": 1},
            {"name": "เครื่องดื่ม/คาเฟ่", "icon": "🧋", "color": "#C8A27A", "sort_order": 2},
            {"name": "เดินทาง", "icon": "🚗", "color": "#8EC5E8", "sort_order": 3},
            {"name": "ช้อปปิ้ง", "icon": "🛍️", "color": "#F4A7B9", "sort_order": 4},
            {"name": "ของใช้ในบ้าน", "icon": "🏠", "color": "#A8D5BA", "sort_order": 5},
            {"name": "บิล/ค่าน้ำไฟ", "icon": "💡", "color": "#FFB38A", "sort_order": 6},
            {"name": "สุขภาพ", "icon": "💊", "color": "#B9A7E8", "sort_order": 7},
            {"name": "บันเทิง", "icon": "🎮", "color": "#FFDD83", "sort_order": 8},
            {"name": "การศึกษา", "icon": "📚", "color": "#9FD8D3", "sort_order": 9},
            {"name": "อื่นๆ", "icon": "📦", "color": "#C9C2B0", "sort_order": 99},
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_expenses_spent_at", table_name="expenses")
    op.drop_table("expenses")
    op.drop_table("categories")
