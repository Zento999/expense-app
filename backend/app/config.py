from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """อ่านค่าจาก environment variables (docker-compose ส่งมาจาก .env)"""

    database_url: str
    app_token: str
    receipts_dir: str = "/data/receipts"


settings = Settings()
