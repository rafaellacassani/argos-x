from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Entity
from app.schemas import EntityCreate, EntityUpdate, EntityResponse

router = APIRouter(prefix="/api/entities", tags=["entities"])


@router.get("", response_model=list[EntityResponse])
def list_entities(db: Session = Depends(get_db)):
    return db.query(Entity).order_by(Entity.id).all()


@router.post("", response_model=EntityResponse, status_code=201)
def create_entity(body: EntityCreate, db: Session = Depends(get_db)):
    if db.query(Entity).filter(Entity.name == body.name).first():
        raise HTTPException(400, "Entidade com esse nome já existe.")
    entity = Entity(name=body.name, color=body.color)
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


@router.put("/{entity_id}", response_model=EntityResponse)
def update_entity(entity_id: int, body: EntityUpdate, db: Session = Depends(get_db)):
    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(404, "Entidade não encontrada.")
    if body.name is not None:
        entity.name = body.name
    if body.color is not None:
        entity.color = body.color
    db.commit()
    db.refresh(entity)
    return entity


@router.delete("/{entity_id}", status_code=204)
def delete_entity(entity_id: int, db: Session = Depends(get_db)):
    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(404, "Entidade não encontrada.")
    db.delete(entity)
    db.commit()
