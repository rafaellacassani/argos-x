from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import (
    Transaction, TransactionMonth, Client, ClientPayment,
    UnplannedBill, TransactionType, MonthStatus, BillStatus, Entity,
)
from app.schemas import DashboardSummary, MonthlyFlowRow, ClientsSummary

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

MONTH_NAMES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]


@router.get("/summary", response_model=DashboardSummary)
def get_summary(
    year: int = Query(...),
    month: Optional[int] = Query(None),
    entity_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    def tx_sum(tx_type: TransactionType, status: MonthStatus) -> float:
        q = (db.query(func.coalesce(func.sum(TransactionMonth.amount), 0))
             .join(Transaction, TransactionMonth.transaction_id == Transaction.id)
             .filter(TransactionMonth.year == year, Transaction.type == tx_type, TransactionMonth.status == status))
        if month:
            q = q.filter(TransactionMonth.month == month)
        if entity_id:
            q = q.filter(Transaction.entity_id == entity_id)
        return float(q.scalar() or 0)

    def cp_sum(status: MonthStatus) -> float:
        q = (db.query(func.coalesce(func.sum(ClientPayment.amount), 0))
             .join(Client, ClientPayment.client_id == Client.id)
             .filter(ClientPayment.year == year, ClientPayment.status == status))
        if month:
            q = q.filter(ClientPayment.month == month)
        if entity_id:
            q = q.filter(Client.entity_id == entity_id)
        return float(q.scalar() or 0)

    unplanned_q = db.query(func.coalesce(func.sum(UnplannedBill.amount), 0)).filter(UnplannedBill.status == BillStatus.pending)
    if entity_id:
        unplanned_q = unplanned_q.filter(UnplannedBill.entity_id == entity_id)

    expenses_paid = tx_sum(TransactionType.expense, MonthStatus.paid)
    expenses_pending = tx_sum(TransactionType.expense, MonthStatus.pending)
    income_received = tx_sum(TransactionType.income, MonthStatus.paid) + cp_sum(MonthStatus.paid)
    income_pending = tx_sum(TransactionType.income, MonthStatus.pending) + cp_sum(MonthStatus.pending)

    return DashboardSummary(
        total_expenses_paid=expenses_paid,
        total_expenses_pending=expenses_pending,
        total_income_received=income_received,
        total_income_pending=income_pending,
        total_unplanned_pending=float(unplanned_q.scalar() or 0),
        net_balance=income_received - expenses_paid,
    )


@router.get("/monthly-flow", response_model=list[MonthlyFlowRow])
def get_monthly_flow(year: int = Query(...), entity_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    rows = []
    for m in range(1, 13):
        def tx_m(tx_type, status):
            q = (db.query(func.coalesce(func.sum(TransactionMonth.amount), 0))
                 .join(Transaction, TransactionMonth.transaction_id == Transaction.id)
                 .filter(TransactionMonth.year == year, TransactionMonth.month == m,
                         Transaction.type == tx_type, TransactionMonth.status == status))
            if entity_id:
                q = q.filter(Transaction.entity_id == entity_id)
            return float(q.scalar() or 0)

        def cp_m(status):
            q = (db.query(func.coalesce(func.sum(ClientPayment.amount), 0))
                 .join(Client, ClientPayment.client_id == Client.id)
                 .filter(ClientPayment.year == year, ClientPayment.month == m, ClientPayment.status == status))
            if entity_id:
                q = q.filter(Client.entity_id == entity_id)
            return float(q.scalar() or 0)

        exp_paid = tx_m(TransactionType.expense, MonthStatus.paid)
        exp_pending = tx_m(TransactionType.expense, MonthStatus.pending)
        inc_received = tx_m(TransactionType.income, MonthStatus.paid) + cp_m(MonthStatus.paid)
        inc_pending = tx_m(TransactionType.income, MonthStatus.pending) + cp_m(MonthStatus.pending)

        rows.append(MonthlyFlowRow(
            month=m, month_name=MONTH_NAMES[m],
            expenses_paid=exp_paid, expenses_pending=exp_pending,
            income_received=inc_received, income_pending=inc_pending,
            net=inc_received - exp_paid,
        ))
    return rows


@router.get("/clients-summary", response_model=list[ClientsSummary])
def get_clients_summary(year: int = Query(...), entity_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    entities_q = db.query(Entity)
    if entity_id:
        entities_q = entities_q.filter(Entity.id == entity_id)
    result = []
    for entity in entities_q.all():
        base = (db.query(func.coalesce(func.sum(ClientPayment.amount), 0))
                .join(Client, ClientPayment.client_id == Client.id)
                .filter(Client.entity_id == entity.id, ClientPayment.year == year))
        projected = float(base.scalar() or 0)
        received = float(base.filter(ClientPayment.status == MonthStatus.paid).scalar() or 0)
        pending = float(base.filter(ClientPayment.status == MonthStatus.pending).scalar() or 0)
        if projected > 0:
            result.append(ClientsSummary(
                entity_id=entity.id, entity_name=entity.name, entity_color=entity.color,
                projected=projected, received=received, pending=pending,
            ))
    return result
