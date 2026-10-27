from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..deps import get_db, require_token
from ..models import Category
from ..schemas import CategoryOut

router = APIRouter(prefix="/api/categories", tags=["categories"], dependencies=[Depends(require_token)])


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(select(Category).order_by(Category.sort_order, Category.id)).all()
