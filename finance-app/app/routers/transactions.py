from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Transaction, TransactionMonth, TransactionType, Entity
from app.schemas import (
    TransactionCreate, TransactionUpdate, TransactionResponse,
    TransactionMonthUpdate, TransactionMonthResponse, GenerateMonthsRequest,
)

router = APIRouter(tags=["transactions"])


def _generate_months(db: Session, tx: Transaction, year: int, default_amount: float = 0.0):
    existing = {tm.month for tm in db.query(TransactionMonth)
                .filter(TransactionMonth.transaction_id == tx.id, TransactionMonth.year == year).all()}
    for month in range(1, 13):
        if month not in existing:
            db.add(TransactionMonth(transaction_id=tx.id, year=year, month=month, amount=default_amount))
    db.commit()


def _load_tx(db: Session, tx_id: int) -> Transaction:
    tx = db.query(Transaction).options(joinedload(Transaction.entity)).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(404, "Transação não encontrada.")
    return tx


@router.get("/api/transactions", response_model=list[TransactionResponse])
def list_transactions(
    entity_id: Optional[int] = Query(None),
    type: Optional[TransactionType] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Transaction).options(joinedload(Transaction.entity))
    if entity_id:
        q = q.filter(Transaction.entity_id == entity_id)
    if type:
        q = q.filter(Transaction.type == type)
    if is_active is not None:
        q = q.filter(Transaction.is_active == is_active)
    return q.order_by(Transaction.entity_id, Transaction.name).all()


@router.post("/api/transactions", response_model=TransactionResponse, status_code=201)
def create_transaction(body: TransactionCreate, db: Session = Depends(get_db)):
    if not db.query(Entity).filter(Entity.id == body.entity_id).first():
        raise HTTPException(404, "Entidade não encontrada.")
    data = body.model_dump(exclude={"generate_year", "default_amount"})
    tx = Transaction(**data)
    db.add(tx)
    db.commit()
    db.refresh(tx)
    if body.generate_year:
        _generate_months(db, tx, body.generate_year, body.default_amount)
    return _load_tx(db, tx.id)


@router.put("/api/transactions/{tx_id}", response_model=TransactionResponse)
def update_transaction(tx_id: int, body: TransactionUpdate, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(404, "Transação não encontrada.")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(tx, field, value)
    db.commit()
    return _load_tx(db, tx_id)


@router.delete("/api/transactions/{tx_id}", status_code=204)
def delete_transaction(tx_id: int, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(404, "Transação não encontrada.")
    db.delete(tx)
    db.commit()


@router.get("/api/transactions/{tx_id}/months", response_model=list[TransactionMonthResponse])
def get_months(tx_id: int, year: int = Query(...), db: Session = Depends(get_db)):
    _load_tx(db, tx_id)
    return (db.query(TransactionMonth)
            .options(joinedload(TransactionMonth.payment_method).joinedload(PaymentMethod.entity))
            .filter(TransactionMonth.transaction_id == tx_id, TransactionMonth.year == year)
            .order_by(TransactionMonth.month).all())


@router.post("/api/transactions/{tx_id}/generate-months", status_code=201)
def generate_months(tx_id: int, body: GenerateMonthsRequest, db: Session = Depends(get_db)):
    tx = _load_tx(db, tx_id)
    _generate_months(db, tx, body.year, body.default_amount)
    return {"ok": True}


@router.put("/api/transaction-months/{tm_id}", response_model=TransactionMonthResponse)
def update_month(tm_id: int, body: TransactionMonthUpdate, db: Session = Depends(get_db)):
    tm = db.query(TransactionMonth).filter(TransactionMonth.id == tm_id).first()
    if not tm:
        raise HTTPException(404, "Mês não encontrado.")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(tm, field, value)
    db.commit()
    return (db.query(TransactionMonth)
            .options(joinedload(TransactionMonth.payment_method).joinedload(PaymentMethod.entity))
            .filter(TransactionMonth.id == tm_id).first())


# Import here to avoid circular at top
from app.models import PaymentMethod  # noqa: E402
