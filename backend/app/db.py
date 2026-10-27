from sqlalchemy import create_engine

from .config import settings

# pool_pre_ping: เช็คว่า connection ยังไม่ตายก่อนใช้ (เช่นหลัง Postgres restart)
engine = create_engine(settings.database_url, pool_pre_ping=True)
