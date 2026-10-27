FROM python:3.13-slim

# ไม่สร้างไฟล์ .pyc และให้ log ออกทันที (ไม่ค้างใน buffer)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /code

# copy requirements ก่อนโค้ด → ถ้าแก้แค่โค้ด Docker ใช้ cache ชั้น pip install เดิมได้ build เร็ว
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app

# อัปเดต schema ให้ล่าสุดก่อนเปิด API ทุกครั้ง (ถ้าล่าสุดอยู่แล้วจะไม่ทำอะไร)
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
