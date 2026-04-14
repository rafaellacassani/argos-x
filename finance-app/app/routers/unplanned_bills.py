from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import UnplannedBill, Entity, BillStatus, PaymentMethod
from app.schemas import UnplannedBillCreate, UnplannedBillUpdate, UnplannedBillResponse

router = APIRouter(prefix="/api/unplanned-bills", tags=["unplanned-bills"])


def _load(db: Session, bill_id: int) -> UnplannedBill:
    bill = (db.query(UnplannedBill)
            .options(joinedload(UnplannedBill.entity), joinedload(UnplannedBill.payment_method).joinedload(PaymentMethod.entity))
            .filter(UnplannedBill.id == bill_id).first())
    if not bill:
        raise HTTPException(404, "Conta não encontrada.")
    return bill


@router.get("", response_model=list[UnplannedBillResponse])
def list_bills(
    entity_id: Optional[int] = Query(None),
    status: Optional[BillStatus] = Query(None),
    db: Session = Depends(get_db),
):
    q = (db.query(UnplannedBill)
         .options(joinedload(UnplannedBill.entity), joinedload(UnplannedBill.payment_method)))
    if entity_id:
        q = q.filter(UnplannedBill.entity_id == entity_id)
    if status:
        q = q.filter(UnplannedBill.status == status)
    return q.order_by(UnplannedBill.due_date.asc().nullsfirst(), UnplannedBill.created_at.desc()).all()


@router.post("", response_model=UnplannedBillResponse, status_code=201)
def create_bill(body: UnplannedBillCreate, db: Session = Depends(get_db)):
    if not db.query(Entity).filter(Entity.id == body.entity_id).first():
        raise HTTPException(404, "Entidade não encontrada.")
    bill = UnplannedBill(**body.model_dump())
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return _load(db, bill.id)


@router.put("/{bill_id}", response_model=UnplannedBillResponse)
def update_bill(bill_id: int, body: UnplannedBillUpdate, db: Session = Depends(get_db)):
    bill = db.query(UnplannedBill).filter(UnplannedBill.id == bill_id).first()
    if not bill:
        raise HTTPException(404, "Conta não encontrada.")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(bill, field, value)
    db.commit()
    return _load(db, bill_id)


@router.delete("/{bill_id}", status_code=204)
def delete_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(UnplannedBill).filter(UnplannedBill.id == bill_id).first()
    if not bill:
        raise HTTPException(404, "Conta não encontrada.")
    db.delete(bill)
    db.commit()
