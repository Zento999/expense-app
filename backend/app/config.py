from zoneinfo import ZoneInfo

from pydantic_settings import BaseSettings

# เวลาทั้งแอปคิดเป็นเวลาไทย (เช่น "เดือนตุลาคม" เริ่ม 1 ต.ค. 00:00 เวลาไทย ไม่ใช่ UTC)
BKK = ZoneInfo("Asia/Bangkok")


class Settings(BaseSettings):
    """อ่านค่าจาก environment variables (docker-compose ส่งมาจาก .env)"""

    database_url: str
    app_token: str
    receipts_dir: str = "/data/receipts"

    # AI อ่านสลิป (ว่าง = ปิดฟีเจอร์ AI แต่แอปยังใช้ได้ปกติ)
    anthropic_api_key: str = ""
    ai_model: str = "claude-opus-5-5"
    ai_effort: str = "medium"


settings = Settings()
