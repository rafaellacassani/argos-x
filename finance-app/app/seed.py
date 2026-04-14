from sqlalchemy.orm import Session
from app.models import Entity

DEFAULT_ENTITIES = [
    {"name": "Família", "color": "#3b82f6"},
    {"name": "ECX", "color": "#10b981"},
    {"name": "Argos X", "color": "#8b5cf6"},
    {"name": "Mkt Boost", "color": "#f59e0b"},
]


def run_seed(db: Session) -> None:
    if db.query(Entity).count() > 0:
        return
    for data in DEFAULT_ENTITIES:
        db.add(Entity(name=data["name"], color=data["color"]))
    db.commit()
    print("Seed: entidades padrão criadas.")
