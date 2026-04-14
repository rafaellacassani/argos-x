import enum
from datetime import date, datetime
from typing import Optional, List
from sqlalchemy import (
    Boolean, Date, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text, UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PaymentMethodType(str, enum.Enum):
    bank = "bank"
    card = "card"


class TransactionType(str, enum.Enum):
    expense = "expense"
    income = "income"


class RecurrenceType(str, enum.Enum):
    monthly = "monthly"
    quarterly = "quarterly"
    annual = "annual"
    one_time = "one_time"


class MonthStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    skipped = "skipped"


class BillStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"


class AssetType(str, enum.Enum):
    imovel = "imovel"
    veiculo = "veiculo"
    outro = "outro"


class AssetStatus(str, enum.Enum):
    quitado = "quitado"
    financiado = "financiado"


class InvestmentType(str, enum.Enum):
    previdencia = "previdencia"
    tesouro = "tesouro"
    renda_fixa = "renda_fixa"
    renda_variavel = "renda_variavel"


class Entity(Base):
    __tablename__ = "entities"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#6366f1")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    payment_methods: Mapped[List["PaymentMethod"]] = relationship(back_populates="entity", cascade="all, delete-orphan")
    transactions: Mapped[List["Transaction"]] = relationship(back_populates="entity", cascade="all, delete-orphan")
    clients: Mapped[List["Client"]] = relationship(back_populates="entity", cascade="all, delete-orphan")
    unplanned_bills: Mapped[List["UnplannedBill"]] = relationship(back_populates="entity", cascade="all, delete-orphan")
    investment_accounts: Mapped[List["InvestmentAccount"]] = relationship(back_populates="entity", cascade="all, delete-orphan")
    assets: Mapped[List["Asset"]] = relationship(back_populates="entity", cascade="all, delete-orphan")


class PaymentMethod(Base):
    __tablename__ = "payment_methods"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[PaymentMethodType] = mapped_column(Enum(PaymentMethodType), nullable=False)
    bank_name: Mapped[Optional[str]] = mapped_column(String(100))
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    entity: Mapped["Entity"] = relationship(back_populates="payment_methods")
    transaction_months: Mapped[List["TransactionMonth"]] = relationship(back_populates="payment_method")
    client_payments: Mapped[List["ClientPayment"]] = relationship(back_populates="payment_method")
    unplanned_bills_paid: Mapped[List["UnplannedBill"]] = relationship(back_populates="payment_method")


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType), nullable=False)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=True)
    day_of_month: Mapped[Optional[int]] = mapped_column(Integer)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    entity: Mapped["Entity"] = relationship(back_populates="transactions")
    months: Mapped[List["TransactionMonth"]] = relationship(back_populates="transaction", cascade="all, delete-orphan")


class TransactionMonth(Base):
    __tablename__ = "transaction_months"
    __table_args__ = (UniqueConstraint("transaction_id", "year", "month"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    status: Mapped[MonthStatus] = mapped_column(Enum(MonthStatus), default=MonthStatus.pending)
    payment_method_id: Mapped[Optional[int]] = mapped_column(ForeignKey("payment_methods.id"))
    paid_at: Mapped[Optional[date]] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    transaction: Mapped["Transaction"] = relationship(back_populates="months")
    payment_method: Mapped[Optional["PaymentMethod"]] = relationship(back_populates="transaction_months")


class Client(Base):
    __tablename__ = "clients"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    recurrence: Mapped[RecurrenceType] = mapped_column(Enum(RecurrenceType), default=RecurrenceType.monthly)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    payment_day: Mapped[Optional[int]] = mapped_column(Integer)
    start_month: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    entity: Mapped["Entity"] = relationship(back_populates="clients")
    payments: Mapped[List["ClientPayment"]] = relationship(back_populates="client", cascade="all, delete-orphan")


class ClientPayment(Base):
    __tablename__ = "client_payments"
    __table_args__ = (UniqueConstraint("client_id", "year", "month"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[MonthStatus] = mapped_column(Enum(MonthStatus), default=MonthStatus.pending)
    payment_method_id: Mapped[Optional[int]] = mapped_column(ForeignKey("payment_methods.id"))
    paid_at: Mapped[Optional[date]] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    client: Mapped["Client"] = relationship(back_populates="payments")
    payment_method: Mapped[Optional["PaymentMethod"]] = relationship(back_populates="client_payments")


class UnplannedBill(Base):
    __tablename__ = "unplanned_bills"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    status: Mapped[BillStatus] = mapped_column(Enum(BillStatus), default=BillStatus.pending)
    payment_method_id: Mapped[Optional[int]] = mapped_column(ForeignKey("payment_methods.id"))
    paid_at: Mapped[Optional[date]] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    entity: Mapped["Entity"] = relationship(back_populates="unplanned_bills")
    payment_method: Mapped[Optional["PaymentMethod"]] = relationship(back_populates="unplanned_bills_paid")


class Asset(Base):
    __tablename__ = "assets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[AssetType] = mapped_column(Enum(AssetType), nullable=False)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    current_value: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    purchase_price: Mapped[Optional[float]] = mapped_column(Float)
    purchase_date: Mapped[Optional[date]] = mapped_column(Date)
    status: Mapped[AssetStatus] = mapped_column(Enum(AssetStatus), default=AssetStatus.quitado)
    total_financed: Mapped[float] = mapped_column(Float, default=0.0)
    amount_paid: Mapped[float] = mapped_column(Float, default=0.0)
    total_installments: Mapped[Optional[int]] = mapped_column(Integer)
    installments_paid: Mapped[Optional[int]] = mapped_column(Integer)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    entity: Mapped["Entity"] = relationship(back_populates="assets")


class InvestmentAccount(Base):
    __tablename__ = "investment_accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    bank: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[InvestmentType] = mapped_column(Enum(InvestmentType), nullable=False)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    entity: Mapped["Entity"] = relationship(back_populates="investment_accounts")
    balances: Mapped[List["InvestmentBalance"]] = relationship(back_populates="account", cascade="all, delete-orphan")


class InvestmentBalance(Base):
    __tablename__ = "investment_balances"
    __table_args__ = (UniqueConstraint("account_id", "year", "month"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("investment_accounts.id"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    balance: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    contribution: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    account: Mapped["InvestmentAccount"] = relationship(back_populates="balances")
