import secrets
from collections.abc import Iterator

from fastapi import Depends, HTTPException
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session

from .config import settings
from .db import SessionLocal

# ใช้ APIKeyHeader แทน Header ธรรมดา → หน้า /docs จะมีปุ่ม "Authorize" ให้ใส่ token ครั้งเดียว
_token_header = APIKeyHeader(name="X-App-Token", auto_error=False)


def require_token(token: str | None = Depends(_token_header)) -> None:
    """ทุก endpoint ที่แตะข้อมูลต้องส่ง header X-App-Token ให้ตรงกับใน .env"""
    # compare_digest: เทียบแบบใช้เวลาเท่ากันเสมอ กันการเดา token จากเวลาตอบกลับ
    if not token or not secrets.compare_digest(token, settings.app_token):
        raise HTTPException(status_code=401, detail="invalid token")


def get_db() -> Iterator[Session]:
    """เปิด session ต่อ 1 request แล้วปิดเสมอ แม้เกิด error"""
    with SessionLocal() as db:
        yield db
