"""เก็บรูปสลิป/บิลเป็นไฟล์บนดิสก์ (โฟลเดอร์ data/receipts บนคอม)

ขั้นตอน: อัปโหลด → พักไว้ใน tmp/ → (บทที่ 6: AI อ่าน) → กดบันทึก → ย้ายไป YYYY/MM/
รูปใน tmp/ ที่ไม่ถูกบันทึกภายใน 24 ชม. จะถูกลบทิ้งเอง
"""

import json
import re
import shutil
import time
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from .config import BKK, settings

ROOT = Path(settings.receipts_dir)
TMP = ROOT / "tmp"

MAX_BYTES = 15 * 1024 * 1024  # 15 MB
FULL_MAX_SIDE = 2000  # พอให้ซูมอ่านตัวเลขในสลิปได้ชัด
THUMB_MAX_SIDE = 400  # สำหรับหน้าประวัติ โหลดเร็ว
TMP_TTL_SECONDS = 24 * 3600

# upload_id ต้องเป็น hex 32 ตัวเท่านั้น — กัน path traversal เช่น "../../etc/passwd"
UPLOAD_ID_PATTERN = r"^[0-9a-f]{32}$"
_UPLOAD_ID = re.compile(UPLOAD_ID_PATTERN)


class ImageError(ValueError):
    pass


def _save_jpeg(img: Image.Image, path: Path, max_side: int, quality: int) -> None:
    resized = img.copy()
    resized.thumbnail((max_side, max_side))  # ย่อโดยคงสัดส่วน ไม่ขยายรูปเล็ก
    # ไม่ส่ง exif= ตอน save → ไฟล์ใหม่ไม่มี metadata ติดไปเลย
    resized.save(path, "JPEG", quality=quality, optimize=True)


def _sweep_tmp() -> None:
    cutoff = time.time() - TMP_TTL_SECONDS
    for p in [*TMP.glob("*.jpg"), *TMP.glob("*.json")]:
        if p.stat().st_mtime < cutoff:
            p.unlink(missing_ok=True)


def save_upload(data: bytes) -> str:
    """ตรวจว่าเป็นรูปจริง, หมุนให้ตรง, ลบ EXIF (มีพิกัด GPS!), ย่อ แล้วพักไว้ใน tmp/"""
    if len(data) > MAX_BYTES:
        raise ImageError("file too large (max 15 MB)")
    try:
        img = Image.open(BytesIO(data))
        img.load()  # decode จริงทั้งไฟล์ ไม่ใช่แค่อ่าน header — ไฟล์ปลอม/เสียจะพังตรงนี้
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as e:
        raise ImageError("not a valid image") from e

    # รูปจากกล้องมือถือมักเก็บแนวนอน + แท็ก "ให้หมุน 90°" ใน EXIF
    # พอเราจะทิ้ง EXIF ต้องหมุนพิกเซลจริงก่อน ไม่งั้นรูปจะตะแคง
    img = ImageOps.exif_transpose(img).convert("RGB")

    TMP.mkdir(parents=True, exist_ok=True)
    _sweep_tmp()
    upload_id = uuid.uuid4().hex
    _save_jpeg(img, TMP / f"{upload_id}.jpg", FULL_MAX_SIDE, quality=85)
    _save_jpeg(img, TMP / f"{upload_id}_thumb.jpg", THUMB_MAX_SIDE, quality=75)
    return upload_id


def upload_path(upload_id: str) -> Path:
    """path ของรูปที่พักไว้ (บทที่ 6 ใช้ส่งให้ AI อ่าน)"""
    if not _UPLOAD_ID.match(upload_id):
        raise ImageError("invalid upload_id")
    path = TMP / f"{upload_id}.jpg"
    if not path.exists():
        raise ImageError("upload not found or expired")
    return path


def save_ai_result(upload_id: str, result: dict) -> None:
    """เก็บผลที่ AI อ่านได้ไว้คู่กับรูป — ตอนบันทึกจะดึงไปใส่ ai_data เอง (ไม่ต้องเชื่อค่าที่แอปส่งมา)"""
    upload_path(upload_id)  # ตรวจ id + มีรูปจริง
    (TMP / f"{upload_id}.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")


def pop_ai_result(upload_id: str) -> dict | None:
    path = TMP / f"{upload_id}.json"
    if not _UPLOAD_ID.match(upload_id) or not path.exists():
        return None
    result = json.loads(path.read_text(encoding="utf-8"))
    path.unlink()
    return result


def attach(upload_id: str, spent_at: datetime) -> str:
    """ย้ายรูปจาก tmp/ ไปโฟลเดอร์ตามเดือนที่จ่าย คืน path สัมพัทธ์ เช่น '2026/10/ab12….jpg'"""
    src = upload_path(upload_id)
    rel_dir = spent_at.astimezone(BKK).strftime("%Y/%m")
    dest_dir = ROOT / rel_dir
    dest_dir.mkdir(parents=True, exist_ok=True)
    shutil.move(src, dest_dir / src.name)
    thumb = TMP / f"{upload_id}_thumb.jpg"
    if thumb.exists():
        shutil.move(thumb, dest_dir / thumb.name)
    return f"{rel_dir}/{src.name}"


def image_file(rel_path: str, thumb: bool = False) -> Path:
    path = ROOT / rel_path
    return path.with_name(f"{path.stem}_thumb.jpg") if thumb else path


def delete_image(rel_path: str) -> None:
    for p in (image_file(rel_path), image_file(rel_path, thumb=True)):
        p.unlink(missing_ok=True)
