#!/usr/bin/env python3
"""
seed_rafaella.py — Popula o banco com os dados reais da Rafaella (Controle26).

Faz POST nas APIs do sistema rodando em localhost:8080.
Não apaga dados existentes (idempotente: pula itens que já existem por nome).

Uso:
    python3 seed_rafaella.py
    python3 seed_rafaella.py --url http://localhost:8080
"""

import sys
import json
import argparse
from datetime import date
import urllib.request
import urllib.error

# ── configurações ─────────────────────────────────────────────────────────────
BASE_URL = "http://localhost:8080"
EMAIL    = "mafracassani@gmail.com"
PASSWORD = "Bebella95*"
YEAR     = date.today().year   # gera meses para o ano corrente


# ── helper HTTP ───────────────────────────────────────────────────────────────

def api(method: str, path: str, body=None):
    url = BASE_URL + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        msg = e.read().decode()
        # 400 com "já existe" é esperado em seeds — não imprime erro
        if e.code != 400:
            print(f"    ⚠  {method} {path} → HTTP {e.code}: {msg[:200]}")
        return None


# ── seções ────────────────────────────────────────────────────────────────────

def check_server():
    try:
        api("GET", "/api/entities")
    except Exception:
        print(f"\n❌  Servidor não responde em {BASE_URL}")
        print("    Rode primeiro:  cd finance-app && python3 main.py\n")
        sys.exit(1)


def seed_entities() -> dict[str, int]:
    """Retorna {nome: id} para todas as entidades."""
    existing = {e["name"]: e["id"] for e in (api("GET", "/api/entities") or [])}

    catalog = [
        {"name": "Família",   "color": "#6366f1"},
        {"name": "ECX",       "color": "#0ea5e9"},
        {"name": "Argos X",   "color": "#8b5cf6"},
        {"name": "Mkt Boost", "color": "#f59e0b"},
    ]

    for item in catalog:
        if item["name"] in existing:
            print(f"  ⏭  {item['name']} (já existe)")
        else:
            r = api("POST", "/api/entities", item)
            if r:
                existing[r["name"]] = r["id"]
                print(f"  ✅  {item['name']}")

    return existing


def seed_payment_methods(entity_ids: dict[str, int]) -> dict[str, int]:
    """Retorna {nome: id} para todos os métodos de pagamento."""
    existing = {m["name"]: m["id"] for m in (api("GET", "/api/payment-methods") or [])}

    fid = entity_ids["Família"]

    catalog = [
        {"name": "Caixa",         "type": "bank", "bank_name": "Caixa Econômica Federal", "entity_id": fid},
        {"name": "Bradesco PF",   "type": "bank", "bank_name": "Bradesco",                "entity_id": fid},
        {"name": "Bradesco AMEX", "type": "card", "bank_name": "Bradesco",                "entity_id": fid},
        {"name": "Sicoob PF",     "type": "bank", "bank_name": "Sicoob",                  "entity_id": fid},
        {"name": "C6",            "type": "card", "bank_name": "C6 Bank",                 "entity_id": fid},
        {"name": "Mercado Livre", "type": "card", "bank_name": "Mercado Pago",             "entity_id": fid},
    ]

    for item in catalog:
        if item["name"] in existing:
            print(f"  ⏭  {item['name']} (já existe)")
        else:
            r = api("POST", "/api/payment-methods", item)
            if r:
                existing[r["name"]] = r["id"]
                print(f"  ✅  {item['name']} ({item['type']})")

    return existing


def seed_transactions(entity_ids: dict[str, int]):
    """Cria transações recorrentes e gera os 12 meses do ano corrente."""
    existing_names = {t["name"] for t in (api("GET", "/api/transactions") or [])}

    fid = entity_ids["Família"]
    aid = entity_ids["Argos X"]

    # ── despesas mensais Família ───────────────────────────────────────────────
    familia_despesas = [
        # (nome,                      vencimento, valor)
        ("Finan. Caixa Aribiri",           1,   3280.00),
        ("Cond. Mar de Verão",            10,    678.00),
        ("Plano Saúde Rafaella",          10,    380.00),
        ("Dona Graça empréstimo",         10,   3070.00),
        ("Cartão Bradesco",               10,   2536.00),
        ("Creche Ronda",                  12,   1450.00),
        ("Internet Go IN",                15,     79.90),
        ("Cartão Mercado Livre",          15,   1502.00),
        ("VIVO Isabella",                 18,     82.00),
        ("Seguro Kwid",                   20,     49.90),
        ("VIVO Rafaella",                 21,     86.40),
        ("Energia Guarapari",             23,    419.00),
        ("Cartão C6",                     27,   4618.00),
        ("Faxina",                        30,    640.00),
    ]

    # ── despesas mensais Empresas (Argos X) ───────────────────────────────────
    # Ajuste entity_id para cada item conforme necessário
    empresa_despesas = [
        # (nome,              dia, valor)
        ("Salário Geise",    None,  1200.00),
        ("Advogado 1",       None,  1000.00),
        ("Advogado 2",       None,  1200.00),
        ("Claude",           None,   110.00),
        ("Hospedagem VPS",   None,   150.00),
        ("Google Workspace", None,   490.00),
        ("Salário Aloir",    None,  1900.00),
    ]

    criadas = 0

    def _create(name, entity_id, day, amount):
        nonlocal criadas
        if name in existing_names:
            print(f"  ⏭  {name} (já existe)")
            return
        body = {
            "name":           name,
            "entity_id":      entity_id,
            "type":           "expense",
            "is_recurring":   True,
            "day_of_month":   day,
            "generate_year":  YEAR,
            "default_amount": amount,
        }
        r = api("POST", "/api/transactions", body)
        if r:
            print(f"  ✅  {name}  •  venc.{day or '—'}  •  R$ {amount:,.2f}")
            criadas += 1

    print("  — Família —")
    for name, day, amount in familia_despesas:
        _create(name, fid, day, amount)

    print("  — Empresas (Argos X) —")
    for name, day, amount in empresa_despesas:
        _create(name, aid, day, amount)

    print(f"\n  → {criadas} transações novas criadas com 12 meses para {YEAR}")


def seed_unplanned_bills(entity_ids: dict[str, int]):
    """Cria contas a vencer (não planejadas)."""
    existing_names = {b["name"] for b in (api("GET", "/api/unplanned-bills") or [])}

    fid = entity_ids["Família"]

    bills = [
        {"name": "Documento Kwid",       "amount": 8000.00, "entity_id": fid, "notes": "Documentação do veículo"},
        {"name": "Terreno Setiba Ville",  "amount":  914.23, "entity_id": fid, "notes": "Parcela em atraso"},
    ]

    for bill in bills:
        if bill["name"] in existing_names:
            print(f"  ⏭  {bill['name']} (já existe)")
        else:
            r = api("POST", "/api/unplanned-bills", bill)
            if r:
                print(f"  ✅  {bill['name']}  •  R$ {bill['amount']:,.2f}")


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Seed dados da Rafaella no finance-app")
    parser.add_argument("--url", default="http://localhost:8080",
                        help="URL base da API (padrão: http://localhost:8080)")
    args = parser.parse_args()

    global BASE_URL
    BASE_URL = args.url.rstrip("/")

    print(f"\n🚀  Seed Rafaella → {BASE_URL}  (ano {YEAR})\n")

    check_server()

    print("🏢  Entidades")
    entity_ids = seed_entities()
    # garante que todas as 4 entidades existem
    missing = [n for n in ("Família", "ECX", "Argos X", "Mkt Boost") if n not in entity_ids]
    if missing:
        print(f"\n❌  Entidades não encontradas após seed: {missing}")
        sys.exit(1)

    print("\n💳  Métodos de pagamento")
    seed_payment_methods(entity_ids)

    print(f"\n📋  Transações recorrentes (meses de {YEAR})")
    seed_transactions(entity_ids)

    print("\n⚠️   Contas a vencer")
    seed_unplanned_bills(entity_ids)

    print("\n✅  Seed concluído com sucesso!\n")
    print("   Acesse http://localhost:8080 para ver os dados.\n")


if __name__ == "__main__":
    main()
