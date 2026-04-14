from __future__ import annotations
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models import (
    PaymentMethodType, TransactionType, RecurrenceType,
    MonthStatus, BillStatus, InvestmentType, AssetType, AssetStatus,
)


class EntityCreate(BaseModel):
    name: str
    color: str = "#6366f1"

class EntityUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

class EntityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    color: str
    created_at: datetime


class PaymentMethodCreate(BaseModel):
    name: str
    type: PaymentMethodType
    bank_name: Optional[str] = None
    entity_id: int

class PaymentMethodUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[PaymentMethodType] = None
    bank_name: Optional[str] = None
    entity_id: Optional[int] = None

class PaymentMethodResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    type: PaymentMethodType
    bank_name: Optional[str]
    entity_id: int
    entity: EntityResponse
    created_at: datetime


class TransactionCreate(BaseModel):
    name: str
    entity_id: int
    type: TransactionType
    is_recurring: bool = True
    day_of_month: Optional[int] = None
    notes: Optional[str] = None
    generate_year: Optional[int] = None
    default_amount: float = 0.0

class TransactionUpdate(BaseModel):
    name: Optional[str] = None
    entity_id: Optional[int] = None
    type: Optional[TransactionType] = None
    is_recurring: Optional[bool] = None
    day_of_month: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    entity_id: int
    entity: EntityResponse
    type: TransactionType
    is_recurring: bool
    day_of_month: Optional[int]
    notes: Optional[str]
    is_active: bool
    created_at: datetime

class TransactionMonthUpdate(BaseModel):
    amount: Optional[float] = None
    status: Optional[MonthStatus] = None
    payment_method_id: Optional[int] = None
    paid_at: Optional[date] = None
    notes: Optional[str] = None

class TransactionMonthResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    transaction_id: int
    year: int
    month: int
    amount: float
    status: MonthStatus
    payment_method_id: Optional[int]
    payment_method: Optional[PaymentMethodResponse]
    paid_at: Optional[date]
    notes: Optional[str]

class GenerateMonthsRequest(BaseModel):
    year: int
    default_amount: float = 0.0


class ClientCreate(BaseModel):
    name: str
    entity_id: int
    recurrence: RecurrenceType = RecurrenceType.monthly
    amount: float
    payment_day: Optional[int] = None
    start_month: int = 1
    notes: Optional[str] = None
    generate_year: Optional[int] = None

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    entity_id: Optional[int] = None
    recurrence: Optional[RecurrenceType] = None
    amount: Optional[float] = None
    payment_day: Optional[int] = None
    start_month: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class ClientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    entity_id: int
    entity: EntityResponse
    recurrence: RecurrenceType
    amount: float
    payment_day: Optional[int]
    start_month: int
    is_active: bool
    notes: Optional[str]
    created_at: datetime

class ClientPaymentUpdate(BaseModel):
    amount: Optional[float] = None
    status: Optional[MonthStatus] = None
    payment_method_id: Optional[int] = None
    paid_at: Optional[date] = None
    notes: Optional[str] = None

class ClientPaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    client_id: int
    year: int
    month: int
    amount: float
    status: MonthStatus
    payment_method_id: Optional[int]
    payment_method: Optional[PaymentMethodResponse]
    paid_at: Optional[date]
    notes: Optional[str]

class GeneratePaymentsRequest(BaseModel):
    year: int


class UnplannedBillCreate(BaseModel):
    name: str
    entity_id: int
    amount: float
    due_date: Optional[date] = None
    notes: Optional[str] = None

class UnplannedBillUpdate(BaseModel):
    name: Optional[str] = None
    entity_id: Optional[int] = None
    amount: Optional[float] = None
    due_date: Optional[date] = None
    status: Optional[BillStatus] = None
    payment_method_id: Optional[int] = None
    paid_at: Optional[date] = None
    notes: Optional[str] = None

class UnplannedBillResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    entity_id: int
    entity: EntityResponse
    amount: float
    due_date: Optional[date]
    status: BillStatus
    payment_method_id: Optional[int]
    payment_method: Optional[PaymentMethodResponse]
    paid_at: Optional[date]
    notes: Optional[str]
    created_at: datetime


class InvestmentAccountCreate(BaseModel):
    name: str
    bank: str
    type: InvestmentType
    entity_id: int
    notes: Optional[str] = None

class InvestmentAccountUpdate(BaseModel):
    name: Optional[str] = None
    bank: Optional[str] = None
    type: Optional[InvestmentType] = None
    entity_id: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class InvestmentBalanceUpsert(BaseModel):
    year: int
    month: int
    balance: float
    contribution: float = 0.0
    notes: Optional[str] = None

class InvestmentBalanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int
    year: int
    month: int
    balance: float
    contribution: float
    notes: Optional[str]

class InvestmentAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    bank: str
    type: InvestmentType
    entity_id: int
    entity: EntityResponse
    notes: Optional[str]
    is_active: bool
    created_at: datetime

class InvestmentSummaryRow(BaseModel):
    account_id: int
    account_name: str
    bank: str
    type: InvestmentType
    entity_name: str
    entity_color: str
    balance: float
    contribution: float


class AssetCreate(BaseModel):
    name: str
    type: AssetType
    entity_id: int
    current_value: float
    purchase_price: Optional[float] = None
    purchase_date: Optional[date] = None
    status: AssetStatus = AssetStatus.quitado
    total_financed: float = 0.0
    amount_paid: float = 0.0
    total_installments: Optional[int] = None
    installments_paid: Optional[int] = None
    notes: Optional[str] = None

class AssetUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[AssetType] = None
    entity_id: Optional[int] = None
    current_value: Optional[float] = None
    purchase_price: Optional[float] = None
    purchase_date: Optional[date] = None
    status: Optional[AssetStatus] = None
    total_financed: Optional[float] = None
    amount_paid: Optional[float] = None
    total_installments: Optional[int] = None
    installments_paid: Optional[int] = None
    notes: Optional[str] = None

class AssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    type: AssetType
    entity_id: int
    entity: EntityResponse
    current_value: float
    purchase_price: Optional[float]
    purchase_date: Optional[date]
    status: AssetStatus
    total_financed: float
    amount_paid: float
    total_installments: Optional[int]
    installments_paid: Optional[int]
    notes: Optional[str]
    paid_percent: float = 0.0
    created_at: datetime

class PatrimonioSummary(BaseModel):
    total_imoveis: float
    total_veiculos: float
    total_outros: float
    total_investimentos: float
    total_patrimonio: float
    imoveis: list[AssetResponse]
    veiculos: list[AssetResponse]
    outros: list[AssetResponse]
    investimentos_por_tipo: dict


class DashboardSummary(BaseModel):
    total_expenses_paid: float
    total_expenses_pending: float
    total_income_received: float
    total_income_pending: float
    total_unplanned_pending: float
    net_balance: float

class MonthlyFlowRow(BaseModel):
    month: int
    month_name: str
    expenses_paid: float
    expenses_pending: float
    income_received: float
    income_pending: float
    net: float

class ClientsSummary(BaseModel):
    entity_id: int
    entity_name: str
    entity_color: str
    projected: float
    received: float
    pending: float
