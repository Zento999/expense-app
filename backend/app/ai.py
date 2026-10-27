"""ให้ Claude อ่านรูปสลิปโอนเงิน / บิล แล้วคืนข้อมูลเป็น JSON ตาม schema

ทำไมใช้ structured output (Pydantic): บังคับให้ AI ตอบเป็นช่องที่กำหนดเป๊ะ
ไม่ต้องมานั่ง parse ข้อความอิสระที่พังง่าย
"""

import base64
import re
from datetime import datetime
from pathlib import Path
from typing import Literal

import anthropic
from pydantic import BaseModel, Field

from .config import BKK, settings

Kind = Literal["slip", "receipt"]


class AIError(Exception):
    """อ่านไม่สำเร็จ — status_code คือ HTTP status ที่จะตอบกลับแอป"""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


class Extraction(BaseModel):
    """สิ่งที่ AI ต้องตอบ (ทุกช่องเป็น null ได้ ถ้าในรูปไม่มีหรืออ่านไม่ออก)"""

    doc_type: Literal["transfer_slip", "receipt", "other"]
    amount: float | None = Field(description="ยอดที่จ่ายจริง หน่วยบาท (ยอดรวมสุทธิ ไม่ใช่ยอดก่อนส่วนลด)")
    paid_at: str | None = Field(description="วันเวลาที่จ่าย รูปแบบ YYYY-MM-DDTHH:MM ปี ค.ศ. เวลาไทย")
    payee: str | None = Field(description="ชื่อผู้รับเงินหรือร้านค้า สั้นๆ ไม่มีเลขบัญชี")
    category: str | None = Field(description="ชื่อหมวดหมู่จากรายการที่ให้ไว้เท่านั้น")
    note: str | None = Field(description="สรุปสั้นๆ ว่าจ่ายค่าอะไร ไม่เกิน 60 ตัวอักษร")
    confidence: Literal["high", "medium", "low"]


_PROMPTS: dict[Kind, str] = {
    "slip": (
        "รูปนี้คือสลิปโอนเงินจากแอปธนาคารหรือพร้อมเพย์ของไทย อ่านแล้วกรอกข้อมูล:\n"
        "- amount: จำนวนเงินที่โอน\n"
        "- paid_at: วันเวลาที่ทำรายการ (สลิปไทยมักใช้ปี พ.ศ. เช่น '27 ต.ค. 69' = 2026 ให้แปลงเป็น ค.ศ.)\n"
        "- payee: ชื่อ 'ผู้รับ' หรือชื่อร้าน/บริษัทปลายทาง เท่านั้น (ห้ามใช้ชื่อผู้โอน)\n"
        "- note: ถ้ามีบันทึกช่วยจำในสลิปให้ใช้ ถ้าไม่มีให้เป็น null"
    ),
    "receipt": (
        "รูปนี้คือบิลหรือใบเสร็จจากร้านค้า อ่านแล้วกรอกข้อมูล:\n"
        "- amount: ยอดรวมสุทธิที่จ่ายจริง (หลังส่วนลด รวม VAT)\n"
        "- paid_at: วันเวลาบนบิล (ถ้าเป็นปี พ.ศ. ให้แปลงเป็น ค.ศ.)\n"
        "- payee: ชื่อร้าน/แบรนด์เท่านั้น ไม่ต้องใส่สาขา (เช่น 'Cafe Amazon' ไม่ใช่ 'Cafe Amazon สาขาลาดพร้าว')\n"
        "- note: สรุปรายการที่ซื้อสั้นๆ เช่น 'กาแฟ 2 แก้ว, ขนมปัง'"
    ),
}

_RULES = (
    "กฎสำคัญ:\n"
    "- ห้ามใส่เลขบัญชี เลขบัตร เบอร์โทร หรือเลขอ้างอิงรายการ ในช่องใดเลย\n"
    "- category ต้องเป็นชื่อจากรายการนี้เท่านั้น: {categories}\n"
    "- ถ้าอ่านช่องไหนไม่ออกหรือไม่มีในรูป ให้เป็น null อย่าเดา\n"
    "- ถ้ารูปไม่ใช่สลิปหรือบิล ให้ doc_type เป็น 'other' และช่องอื่นเป็น null\n"
    "- confidence: high ถ้ายอดเงินชัดเจน, low ถ้ารูปเบลอหรือไม่แน่ใจยอดเงิน"
)

# ตัวเลข (หรือ x ที่ธนาคารใช้ปิดเลข) 6 ตัวขึ้นไป อาจมีขีด/ช่องว่างคั่น เช่น 123-4-56789-0, xxx-x-x1234-x, 081 234 5678
_LONG_NUMBER = re.compile(r"[\dXx](?:[\s-]?[\dXx]){5,}")


def _mask_numbers(text: str | None) -> str | None:
    """ชั้นป้องกันที่ 2: ถ้า AI เผลอใส่เลขบัญชี/เบอร์โทรมา ให้ปิดทิ้งก่อนเก็บ"""
    if text is None:
        return None

    def mask(m: re.Match) -> str:
        # ต้องมีตัวเลขจริงอย่างน้อย 4 ตัว — กันคำอย่าง "xxxxxx" ไม่ให้โดนปิดโดยไม่จำเป็น
        return "••••" if sum(c.isdigit() for c in m.group()) >= 4 else m.group()

    return _LONG_NUMBER.sub(mask, text).strip() or None


def _parse_paid_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        return None
    if dt.year > 2400:  # AI ลืมแปลง พ.ศ. → ค.ศ.
        dt = dt.replace(year=dt.year - 543)
    return dt.replace(tzinfo=BKK) if dt.tzinfo is None else dt


def _fallback_options(model: str) -> dict:
    """ถ้าระบบกรองความปลอดภัยของ Claude ปฏิเสธผิดพลาด ให้ server ส่งต่อไปโมเดลสำรองเอง
    (มีเฉพาะ Opus / Sonnet 5.5 / Fable — Haiku ไม่รองรับ)"""
    if model.startswith(("claude-opus", "claude-sonnet-5-5", "claude-fable")):
        return {
            "extra_headers": {"anthropic-beta": "server-side-fallback-2026-07-01"},
            "extra_body": {"fallbacks": "default"},
        }
    return {}


def read_document(image: Path, kind: Kind, category_names: list[str]) -> dict:
    """ส่งรูปให้ Claude อ่าน คืน dict ที่ทำความสะอาดแล้ว + usage (ไว้ดูค่าใช้จ่าย)"""
    if not settings.anthropic_api_key:
        raise AIError("AI not configured: set ANTHROPIC_API_KEY in .env", status_code=503)

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=60, max_retries=2)
    image_b64 = base64.standard_b64encode(image.read_bytes()).decode()
    prompt = f"{_PROMPTS[kind]}\n\n{_RULES.format(categories=', '.join(category_names))}"

    try:
        response = client.messages.parse(
            model=settings.ai_model,
            max_tokens=16000,
            output_config={"effort": settings.ai_effort},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": image_b64}},
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
            output_format=Extraction,
            **_fallback_options(settings.ai_model),
        )
    except anthropic.AuthenticationError as e:
        raise AIError("ANTHROPIC_API_KEY is invalid", status_code=503) from e
    except anthropic.RateLimitError as e:
        raise AIError("AI rate limited, try again shortly", status_code=429) from e
    except anthropic.BadRequestError as e:
        raise AIError(f"AI rejected the request: {e.message}") from e
    except anthropic.APIStatusError as e:
        raise AIError(f"AI service error ({e.status_code})") from e
    except anthropic.APIConnectionError as e:
        raise AIError("cannot reach AI service (internet?)") from e

    if response.stop_reason == "refusal" or response.parsed_output is None:
        raise AIError("AI could not read this image", status_code=422)

    out = response.parsed_output
    paid_at = _parse_paid_at(out.paid_at)
    return {
        "doc_type": out.doc_type,
        "amount": round(out.amount, 2) if out.amount and out.amount > 0 else None,
        "paid_at": paid_at.isoformat() if paid_at else None,
        "payee": _mask_numbers(out.payee),
        "category": out.category if out.category in category_names else None,
        "note": _mask_numbers(out.note),
        "confidence": out.confidence,
        "model": response.model,
        "usage": {"input_tokens": response.usage.input_tokens, "output_tokens": response.usage.output_tokens},
    }
