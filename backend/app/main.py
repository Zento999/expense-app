import secrets

from fastapi import Depends, FastAPI, Header, HTTPException
from sqlalchemy import text

from .config import settings
from .db import engine

app = FastAPI(title="Expense API")


def require_token(x_app_token: str = Header(default="")) -> None:
    """ทุก endpoint ที่แตะข้อมูลต้องส่ง header X-App-Token ให้ตรงกับใน .env"""
    # compare_digest: เทียบแบบใช้เวลาเท่ากันเสมอ กันการเดา token จากเวลาตอบกลับ
    if not secrets.compare_digest(x_app_token, settings.app_token):
        raise HTTPException(status_code=401, detail="invalid token")


@app.get("/health")
def health():
    """เปิดสาธารณะ ไม่คืนข้อมูลส่วนตัว — ใช้เช็คว่า API กับ DB ยังทำงาน"""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db = "ok"
    except Exception:
        db = "down"
    return {"status": "ok", "db": db}


@app.get("/api/ping", dependencies=[Depends(require_token)])
def ping():
    """ไว้ทดสอบว่าแอปส่ง token ถูก"""
    return {"pong": True}
