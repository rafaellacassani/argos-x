import os
import hashlib
import secrets
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from app.database import init_db, SessionLocal
from app.seed import run_seed
from app.routers import entities, payment_methods, transactions, clients, unplanned_bills, dashboard, investments, assets

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")

# Credentials — override via environment variables in production
_AUTH_EMAIL    = os.environ.get("AUTH_EMAIL",    "mafracassani@gmail.com")
_AUTH_PASS_RAW = os.environ.get("AUTH_PASSWORD", "Bebella95*")
_AUTH_HASH     = hashlib.sha256(_AUTH_PASS_RAW.encode()).hexdigest()

# In-memory session tokens (fine for single-user local app)
_SESSIONS: set[str] = set()


class LoginRequest(BaseModel):
    email: str
    password: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        run_seed(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Central Financeira", lifespan=lifespan)


@app.post("/api/auth/login")
async def login(body: LoginRequest):
    pwd_hash = hashlib.sha256(body.password.encode()).hexdigest()
    if body.email.lower() != _AUTH_EMAIL.lower() or pwd_hash != _AUTH_HASH:
        raise HTTPException(401, "E-mail ou senha incorretos.")
    token = secrets.token_hex(32)
    _SESSIONS.add(token)
    return {"token": token}


@app.post("/api/auth/logout")
async def logout(body: dict):
    _SESSIONS.discard(body.get("token", ""))
    return {"ok": True}


@app.get("/api/auth/verify")
async def verify(token: str = ""):
    if token not in _SESSIONS:
        raise HTTPException(401, "Sessão inválida.")
    return {"ok": True}


app.include_router(entities.router)
app.include_router(payment_methods.router)
app.include_router(transactions.router)
app.include_router(clients.router)
app.include_router(unplanned_bills.router)
app.include_router(dashboard.router)
app.include_router(investments.router)
app.include_router(assets.router)

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
