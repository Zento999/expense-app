from fastapi import Depends, FastAPI
from sqlalchemy import text

from .db import engine
from .deps import require_token
from .routers import categories, expenses, uploads

app = FastAPI(title="Expense API")
app.include_router(categories.router)
app.include_router(expenses.router)
app.include_router(uploads.router)


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
