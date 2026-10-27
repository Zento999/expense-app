from zoneinfo import ZoneInfo

from pydantic_settings import BaseSettings

# เวลาทั้งแอปคิดเป็นเวลาไทย (เช่น "เดือนตุลาคม" เริ่ม 1 ต.ค. 00:00 เวลาไทย ไม่ใช่ UTC)
BKK = ZoneInfo("Asia/Bangkok")


class Settings(BaseSettings):
    """อ่านค่าจาก environment variables (docker-compose ส่งมาจาก .env)"""

    database_url: str
    app_token: str
    receipts_dir: str = "/data/receipts"


settings = Settings()
