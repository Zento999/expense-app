from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..ai import AIError, Kind, read_document
from ..deps import get_db, require_token
from ..models import Category, Expense
from ..storage import MAX_BYTES, ImageError, save_ai_result, save_upload, upload_path

router = APIRouter(prefix="/api/uploads", tags=["uploads"], dependencies=[Depends(require_token)])


class UploadOut(BaseModel):
    upload_id: str


class ReadOut(BaseModel):
    """ผลที่ AI อ่าน พร้อมแปลงหมวดเป็น id ให้แอปใช้ได้ทันที — ทุกช่องแก้ได้ก่อนบันทึก"""

    doc_type: str
    amount: float | None
    spent_at: str | None
    payee: str | None
    category_id: int | None
    # history = ใช้หมวดเดียวกับที่คุณเคยบันทึกให้ร้านนี้ / ai = AI เดาเอง
    category_source: Literal["history", "ai"] | None
    note: str | None
    confidence: str


def _category_from_history(db: Session, payee: str | None) -> int | None:
    """หมวดที่ใช้ล่าสุดกับผู้รับ/ร้านนี้ — คุณเคยตัดสินใจไว้แล้ว แม่นกว่าให้ AI เดาใหม่ทุกครั้ง"""
    if not payee:
        return None
    # '  GRAB  Taxi ' กับ 'grab taxi' ถือเป็นร้านเดียวกัน (ตัวเล็ก + ช่องว่างเดียว ทั้งสองฝั่ง)
    key = " ".join(payee.lower().split())
    stored = func.lower(func.btrim(func.regexp_replace(Expense.payee, r"\s+", " ", "g")))
    return db.scalar(
        select(Expense.category_id).where(stored == key).order_by(Expense.spent_at.desc()).limit(1)
    )


@router.post("", response_model=UploadOut, status_code=201)
def upload_image(file: UploadFile):
    """อัปโหลดรูป (multipart field ชื่อ file) → ได้ upload_id ไว้แนบตอนสร้างรายจ่าย"""
    # อ่านเกินลิมิต 1 byte เพื่อรู้ว่าไฟล์ใหญ่เกิน โดยไม่ต้องอ่านทั้งไฟล์เข้า RAM
    data = file.file.read(MAX_BYTES + 1)
    try:
        upload_id = save_upload(data)
    except ImageError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return UploadOut(upload_id=upload_id)


@router.post("/{upload_id}/read", response_model=ReadOut)
def read_upload(upload_id: str, kind: Kind = "slip", db: Session = Depends(get_db)):
    """ให้ AI อ่านรูปที่อัปโหลดไว้ (kind = slip หรือ receipt)"""
    try:
        image = upload_path(upload_id)
    except ImageError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    categories = db.scalars(select(Category).order_by(Category.sort_order)).all()
    try:
        result = read_document(image, kind, [c.name for c in categories])
    except AIError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e)) from e

    save_ai_result(upload_id, result)

    category_id = _category_from_history(db, result["payee"])
    source = "history" if category_id else None
    if category_id is None:
        category_id = {c.name: c.id for c in categories}.get(result["category"])
        source = "ai" if category_id else None

    return ReadOut(
        doc_type=result["doc_type"],
        amount=result["amount"],
        spent_at=result["paid_at"],
        payee=result["payee"],
        category_id=category_id,
        category_source=source,
        note=result["note"],
        confidence=result["confidence"],
    )
