

# Execução: Criar Lead de Teste via Graph API e Monitorar

## Situação atual confirmada no banco
- **Zero eventos leadgen** nos logs do `facebook-webhook` (confirmado agora)
- **1 lead meta-leadgen** antigo de 02/Abr (teste manual anterior) no workspace do Fellipe
- Página `112720421335914` ativa, token salvo

## O que vou executar (4 passos sequenciais)

### Passo 1: Listar formulários ativos
```bash
curl -s "https://graph.facebook.com/v21.0/112720421335914/leadgen_forms?access_token=TOKEN"
```
Se falhar por falta de `pages_manage_ads`, usarei a alternativa: buscar forms via `ads_management` ou simular o payload diretamente.

### Passo 2: Criar lead de teste
Se o Passo 1 retornar form_ids:
```bash
curl -s -X POST "https://graph.facebook.com/v21.0/{form_id}/test_leads?access_token=TOKEN"
```
Isso faz a Meta enviar um evento `leadgen` real para o webhook configurado.

**Alternativa** (se não conseguir listar forms): Simular o payload `leadgen` chamando diretamente o endpoint `facebook-webhook` com o formato exato que a Meta enviaria, para testar se o **processamento** funciona.

### Passo 3: Monitorar logs do webhook
Aguardar 30 segundos e verificar logs de `facebook-webhook` buscando por `leadgen` ou `112720421335914`.

### Passo 4: Verificar banco
```sql
SELECT * FROM leads 
WHERE workspace_id = 'bc7bfbe5-07cc-409c-9a85-5ce46f94b9b3' 
AND source = 'meta-leadgen' 
ORDER BY created_at DESC LIMIT 5
```

## O que o resultado nos dirá

| Resultado | Significado |
|-----------|------------|
| Test lead criado + evento chega nos logs + lead no banco | Sistema funciona; problema é outro CRM interceptando na Meta |
| Test lead criado + evento NAO chega | Meta não entrega ao nosso App (config do App Dashboard) |
| Simulação direta do payload funciona | Processamento OK; problema é 100% entrega da Meta |
| Nenhum form encontrado | Fellipe não tem formulários ativos de Lead Ads |

## Escopo
- Nenhum código alterado
- Apenas chamadas de leitura/teste via Graph API e simulação de webhook
- Restrito ao workspace `bc7bfbe5-07cc-409c-9a85-5ce46f94b9b3`

