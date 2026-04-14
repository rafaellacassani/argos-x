from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Asset, AssetType, Entity, InvestmentAccount, InvestmentBalance, InvestmentType
from app.schemas import AssetCreate, AssetUpdate, AssetResponse, PatrimonioSummary

router = APIRouter(prefix="/api/assets", tags=["assets"])

TYPE_LABELS = {
    InvestmentType.previdencia: "Previdência",
    InvestmentType.tesouro: "Tesouro Direto",
    InvestmentType.renda_fixa: "Renda Fixa",
    InvestmentType.renda_variavel: "Renda Variável",
}


def _load(db: Session, asset_id: int) -> Asset:
    asset = db.query(Asset).options(joinedload(Asset.entity)).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Ativo não encontrado.")
    return asset


def _to_response(asset: Asset) -> AssetResponse:
    r = AssetResponse.model_validate(asset)
    if asset.status.value == "quitado":
        r.paid_percent = 100.0
    elif asset.total_financed > 0:
        r.paid_percent = round((asset.amount_paid / asset.total_financed) * 100, 1)
    else:
        r.paid_percent = 0.0
    return r


@router.get("", response_model=list[AssetResponse])
def list_assets(entity_id: Optional[int] = Query(None), type: Optional[AssetType] = Query(None), db: Session = Depends(get_db)):
    q = db.query(Asset).options(joinedload(Asset.entity))
    if entity_id:
        q = q.filter(Asset.entity_id == entity_id)
    if type:
        q = q.filter(Asset.type == type)
    return [_to_response(a) for a in q.order_by(Asset.type, Asset.name).all()]


@router.post("", response_model=AssetResponse, status_code=201)
def create_asset(body: AssetCreate, db: Session = Depends(get_db)):
    if not db.query(Entity).filter(Entity.id == body.entity_id).first():
        raise HTTPException(404, "Entidade não encontrada.")
    asset = Asset(**body.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return _to_response(_load(db, asset.id))


@router.put("/{asset_id}", response_model=AssetResponse)
def update_asset(asset_id: int, body: AssetUpdate, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Ativo não encontrado.")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(asset, field, value)
    db.commit()
    return _to_response(_load(db, asset_id))


@router.delete("/{asset_id}", status_code=204)
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Ativo não encontrado.")
    db.delete(asset)
    db.commit()


@router.get("/patrimonio", response_model=PatrimonioSummary)
def get_patrimonio(entity_id: Optional[int] = Query(None), inv_year: int = Query(...), inv_month: int = Query(...), db: Session = Depends(get_db)):
    q = db.query(Asset).options(joinedload(Asset.entity))
    if entity_id:
        q = q.filter(Asset.entity_id == entity_id)
    all_assets = q.all()

    imoveis = [_to_response(a) for a in all_assets if a.type == AssetType.imovel]
    veiculos = [_to_response(a) for a in all_assets if a.type == AssetType.veiculo]
    outros = [_to_response(a) for a in all_assets if a.type == AssetType.outro]

    inv_q = (db.query(InvestmentAccount, InvestmentBalance)
             .outerjoin(InvestmentBalance,
                        (InvestmentBalance.account_id == InvestmentAccount.id) &
                        (InvestmentBalance.year == inv_year) & (InvestmentBalance.month == inv_month))
             .filter(InvestmentAccount.is_active == True))
    if entity_id:
        inv_q = inv_q.filter(InvestmentAccount.entity_id == entity_id)

    investimentos_por_tipo: dict[str, float] = {}
    total_investimentos = 0.0
    for acc, bal in inv_q.all():
        val = bal.balance if bal else 0.0
        label = TYPE_LABELS.get(acc.type, acc.type.value)
        investimentos_por_tipo[label] = investimentos_por_tipo.get(label, 0.0) + val
        total_investimentos += val

    total_imoveis = sum(a.current_value for a in imoveis)
    total_veiculos = sum(a.current_value for a in veiculos)
    total_outros = sum(a.current_value for a in outros)

    return PatrimonioSummary(
        total_imoveis=total_imoveis, total_veiculos=total_veiculos,
        total_outros=total_outros, total_investimentos=total_investimentos,
        total_patrimonio=total_imoveis + total_veiculos + total_outros + total_investimentos,
        imoveis=imoveis, veiculos=veiculos, outros=outros,
        investimentos_por_tipo=investimentos_por_tipo,
    )
