from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import PaymentMethod, Entity
from app.schemas import PaymentMethodCreate, PaymentMethodUpdate, PaymentMethodResponse

router = APIRouter(prefix="/api/payment-methods", tags=["payment-methods"])


@router.get("", response_model=list[PaymentMethodResponse])
def list_payment_methods(entity_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    q = db.query(PaymentMethod).options(joinedload(PaymentMethod.entity))
    if entity_id:
        q = q.filter(PaymentMethod.entity_id == entity_id)
    return q.order_by(PaymentMethod.entity_id, PaymentMethod.type, PaymentMethod.name).all()


@router.post("", response_model=PaymentMethodResponse, status_code=201)
def create_payment_method(body: PaymentMethodCreate, db: Session = Depends(get_db)):
    if not db.query(Entity).filter(Entity.id == body.entity_id).first():
        raise HTTPException(404, "Entidade não encontrada.")
    pm = PaymentMethod(name=body.name, type=body.type, bank_name=body.bank_name, entity_id=body.entity_id)
    db.add(pm)
    db.commit()
    db.refresh(pm)
    return db.query(PaymentMethod).options(joinedload(PaymentMethod.entity)).filter(PaymentMethod.id == pm.id).first()


@router.put("/{pm_id}", response_model=PaymentMethodResponse)
def update_payment_method(pm_id: int, body: PaymentMethodUpdate, db: Session = Depends(get_db)):
    pm = db.query(PaymentMethod).filter(PaymentMethod.id == pm_id).first()
    if not pm:
        raise HTTPException(404, "Método de pagamento não encontrado.")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(pm, field, value)
    db.commit()
    return db.query(PaymentMethod).options(joinedload(PaymentMethod.entity)).filter(PaymentMethod.id == pm_id).first()


@router.delete("/{pm_id}", status_code=204)
def delete_payment_method(pm_id: int, db: Session = Depends(get_db)):
    pm = db.query(PaymentMethod).filter(PaymentMethod.id == pm_id).first()
    if not pm:
        raise HTTPException(404, "Método de pagamento não encontrado.")
    db.delete(pm)
    db.commit()
