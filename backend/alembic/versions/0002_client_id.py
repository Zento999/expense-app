"""expenses.client_id: id ที่มือถือสร้าง กันบันทึกซ้ำตอนส่งคิวออฟไลน์ใหม่

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-27
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("expenses", sa.Column("client_id", sa.String(36)))
    # unique: client_id เดียวกันมีได้แถวเดียว (แถวเก่าเป็น NULL ได้หลายแถว ไม่ชนกัน)
    op.create_index("ix_expenses_client_id", "expenses", ["client_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_expenses_client_id", table_name="expenses")
    op.drop_column("expenses", "client_id")
