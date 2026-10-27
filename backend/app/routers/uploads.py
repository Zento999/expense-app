from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..ai import AIError, Kind, read_document
from ..deps import get_db, require_token
from ..models import Category
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
    note: str | None
    confidence: str


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
    by_name = {c.name: c.id for c in categories}
    return ReadOut(
        doc_type=result["doc_type"],
        amount=result["amount"],
        spent_at=result["paid_at"],
        payee=result["payee"],
        category_id=by_name.get(result["category"]),
        note=result["note"],
        confidence=result["confidence"],
    )
