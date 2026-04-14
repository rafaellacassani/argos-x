from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Client, ClientPayment, RecurrenceType, Entity, PaymentMethod
from app.schemas import (
    ClientCreate, ClientUpdate, ClientResponse,
    ClientPaymentUpdate, ClientPaymentResponse, GeneratePaymentsRequest,
)

router = APIRouter(tags=["clients"])


def _payment_months(recurrence: RecurrenceType, start_month: int) -> list[int]:
    if recurrence == RecurrenceType.monthly:
        return list(range(1, 13))
    if recurrence == RecurrenceType.quarterly:
        months, m = [], start_month
        while m <= 12:
            months.append(m)
            m += 3
        return months
    if recurrence == RecurrenceType.annual:
        return [start_month]
    return []


def _generate_payments(db: Session, client: Client, year: int):
    existing = {cp.month for cp in db.query(ClientPayment)
                .filter(ClientPayment.client_id == client.id, ClientPayment.year == year).all()}
    for month in _payment_months(client.recurrence, client.start_month):
        if month not in existing:
            db.add(ClientPayment(client_id=client.id, year=year, month=month, amount=client.amount))
    db.commit()


def _load_client(db: Session, client_id: int) -> Client:
    client = db.query(Client).options(joinedload(Client.entity)).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(404, "Cliente não encontrado.")
    return client


@router.get("/api/clients", response_model=list[ClientResponse])
def list_clients(
    entity_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Client).options(joinedload(Client.entity))
    if entity_id:
        q = q.filter(Client.entity_id == entity_id)
    if is_active is not None:
        q = q.filter(Client.is_active == is_active)
    return q.order_by(Client.entity_id, Client.name).all()


@router.post("/api/clients", response_model=ClientResponse, status_code=201)
def create_client(body: ClientCreate, db: Session = Depends(get_db)):
    if not db.query(Entity).filter(Entity.id == body.entity_id).first():
        raise HTTPException(404, "Entidade não encontrada.")
    data = body.model_dump(exclude={"generate_year"})
    client = Client(**data)
    db.add(client)
    db.commit()
    db.refresh(client)
    if body.generate_year:
        _generate_payments(db, client, body.generate_year)
    return _load_client(db, client.id)


@router.put("/api/clients/{client_id}", response_model=ClientResponse)
def update_client(client_id: int, body: ClientUpdate, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(404, "Cliente não encontrado.")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(client, field, value)
    db.commit()
    return _load_client(db, client_id)


@router.delete("/api/clients/{client_id}", status_code=204)
def delete_client(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(404, "Cliente não encontrado.")
    client.is_active = False
    db.commit()


@router.get("/api/clients/{client_id}/payments", response_model=list[ClientPaymentResponse])
def get_client_payments(client_id: int, year: int = Query(...), db: Session = Depends(get_db)):
    _load_client(db, client_id)
    return (db.query(ClientPayment)
            .options(joinedload(ClientPayment.payment_method).joinedload(PaymentMethod.entity))
            .filter(ClientPayment.client_id == client_id, ClientPayment.year == year)
            .order_by(ClientPayment.month).all())


@router.post("/api/clients/{client_id}/generate-payments", status_code=201)
def generate_payments(client_id: int, body: GeneratePaymentsRequest, db: Session = Depends(get_db)):
    client = _load_client(db, client_id)
    _generate_payments(db, client, body.year)
    return {"ok": True}


@router.put("/api/client-payments/{cp_id}", response_model=ClientPaymentResponse)
def update_client_payment(cp_id: int, body: ClientPaymentUpdate, db: Session = Depends(get_db)):
    cp = db.query(ClientPayment).filter(ClientPayment.id == cp_id).first()
    if not cp:
        raise HTTPException(404, "Pagamento não encontrado.")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(cp, field, value)
    db.commit()
    return (db.query(ClientPayment)
            .options(joinedload(ClientPayment.payment_method).joinedload(PaymentMethod.entity))
            .filter(ClientPayment.id == cp_id).first())
