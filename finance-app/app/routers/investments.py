from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import InvestmentAccount, InvestmentBalance, Entity
from app.schemas import (
    InvestmentAccountCreate, InvestmentAccountUpdate, InvestmentAccountResponse,
    InvestmentBalanceUpsert, InvestmentBalanceResponse, InvestmentSummaryRow,
)

router = APIRouter(prefix="/api/investments", tags=["investments"])


def _load(db: Session, account_id: int) -> InvestmentAccount:
    acc = (db.query(InvestmentAccount).options(joinedload(InvestmentAccount.entity))
           .filter(InvestmentAccount.id == account_id).first())
    if not acc:
        raise HTTPException(404, "Conta de investimento não encontrada.")
    return acc


@router.get("", response_model=list[InvestmentAccountResponse])
def list_accounts(entity_id: Optional[int] = Query(None), is_active: Optional[bool] = Query(None), db: Session = Depends(get_db)):
    q = db.query(InvestmentAccount).options(joinedload(InvestmentAccount.entity))
    if entity_id:
        q = q.filter(InvestmentAccount.entity_id == entity_id)
    if is_active is not None:
        q = q.filter(InvestmentAccount.is_active == is_active)
    return q.order_by(InvestmentAccount.entity_id, InvestmentAccount.bank, InvestmentAccount.name).all()


@router.post("", response_model=InvestmentAccountResponse, status_code=201)
def create_account(body: InvestmentAccountCreate, db: Session = Depends(get_db)):
    if not db.query(Entity).filter(Entity.id == body.entity_id).first():
        raise HTTPException(404, "Entidade não encontrada.")
    acc = InvestmentAccount(**body.model_dump())
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return _load(db, acc.id)


@router.put("/{account_id}", response_model=InvestmentAccountResponse)
def update_account(account_id: int, body: InvestmentAccountUpdate, db: Session = Depends(get_db)):
    acc = db.query(InvestmentAccount).filter(InvestmentAccount.id == account_id).first()
    if not acc:
        raise HTTPException(404, "Conta não encontrada.")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(acc, field, value)
    db.commit()
    return _load(db, account_id)


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    acc = db.query(InvestmentAccount).filter(InvestmentAccount.id == account_id).first()
    if not acc:
        raise HTTPException(404, "Conta não encontrada.")
    db.delete(acc)
    db.commit()


@router.get("/{account_id}/balances", response_model=list[InvestmentBalanceResponse])
def get_balances(account_id: int, year: int = Query(...), db: Session = Depends(get_db)):
    _load(db, account_id)
    return (db.query(InvestmentBalance)
            .filter(InvestmentBalance.account_id == account_id, InvestmentBalance.year == year)
            .order_by(InvestmentBalance.month).all())


@router.put("/{account_id}/balances", response_model=InvestmentBalanceResponse)
def upsert_balance(account_id: int, body: InvestmentBalanceUpsert, db: Session = Depends(get_db)):
    _load(db, account_id)
    existing = (db.query(InvestmentBalance)
                .filter(InvestmentBalance.account_id == account_id,
                        InvestmentBalance.year == body.year, InvestmentBalance.month == body.month).first())
    if existing:
        existing.balance = body.balance
        existing.contribution = body.contribution
        existing.notes = body.notes
        db.commit()
        return existing
    bal = InvestmentBalance(account_id=account_id, **body.model_dump())
    db.add(bal)
    db.commit()
    db.refresh(bal)
    return bal


@router.get("/summary/year", response_model=list[InvestmentSummaryRow])
def get_summary(year: int = Query(...), month: int = Query(...), entity_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    q = (db.query(InvestmentAccount, InvestmentBalance)
         .outerjoin(InvestmentBalance,
                    (InvestmentBalance.account_id == InvestmentAccount.id) &
                    (InvestmentBalance.year == year) & (InvestmentBalance.month == month))
         .options(joinedload(InvestmentAccount.entity))
         .filter(InvestmentAccount.is_active == True))
    if entity_id:
        q = q.filter(InvestmentAccount.entity_id == entity_id)
    return [InvestmentSummaryRow(
        account_id=acc.id, account_name=acc.name, bank=acc.bank, type=acc.type,
        entity_name=acc.entity.name, entity_color=acc.entity.color,
        balance=bal.balance if bal else 0.0, contribution=bal.contribution if bal else 0.0,
    ) for acc, bal in q.all()]
