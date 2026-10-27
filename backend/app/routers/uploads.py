from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel

from ..deps import require_token
from ..storage import MAX_BYTES, ImageError, save_upload

router = APIRouter(prefix="/api/uploads", tags=["uploads"], dependencies=[Depends(require_token)])


class UploadOut(BaseModel):
    upload_id: str


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
