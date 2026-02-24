

# Plano: Correção Definitiva do Loop na Evolution API

## O que aconteceu (explicação simples)

A Evolution API roda **dentro de um container Docker**. Quando uma instancia WhatsApp tem a sessao corrompida, o servico fica tentando reconectar infinitamente (o loop que voce ve nos logs: "ChannelStartupService" repetindo sem parar).

Os comandos `rm -rf` que voce rodou apagaram pastas na **maquina host** (o sistema operacional da VPS), mas as sessoes ficam **dentro do container Docker** -- por isso nao teve efeito e o loop continuou.

---

## PARTE 1: Correcao Imediata (voce executa no servidor)

Rode estes comandos na VPS, nesta ordem:

```text
# 1. Descobrir o nome/ID do container da Evolution API
docker ps | grep -i evolution

# 2. Entrar no container (substituir CONTAINER_ID pelo resultado acima)
docker exec -it CONTAINER_ID sh

# 3. Dentro do container, encontrar onde ficam as instancias
find / -type d -name "lia27" 2>/dev/null

# 4. Navegar ate a pasta (geralmente /evolution/instances ou /app/instances)
# Exemplo: cd /evolution/instances

# 5. Apagar as sessoes corrompidas
rm -rf lia27/session
rm -rf iara-mkt-boost/session
rm -rf ana-nutriscience-curso/session
rm -rf ana-nutri/session

# 6. Sair do container
exit

# 7. Reiniciar o container
docker restart CONTAINER_ID
```

Apos o restart, as instancias vao aparecer como "desconectadas" e voce reconecta escaneando o QR Code normalmente no CRM.

---

## PARTE 2: Solucao Permanente no App (eu implemento)

Para que isso **nunca mais** precise de intervencao manual, vou implementar um mecanismo de auto-recuperacao:

### 2.1 Endpoint de auto-heal na Edge Function

Novo endpoint `POST /restart-instance/:instanceName` na Edge Function `evolution-api`:

- Chama `DELETE /instance/logout/{name}` na Evolution API para limpar a sessao
- Aguarda 2 segundos
- Chama `POST /instance/create` para recriar a instancia limpa
- Retorna o novo QR Code para reconexao imediata

### 2.2 Deteccao automatica de loop no frontend

No `Settings.tsx` e `ConnectionModal.tsx`:

- Quando `getConnectionState` retorna `"connecting"` por **mais de 3 verificacoes consecutivas** (ou seja, ~90 segundos), o sistema entende que a instancia esta em loop
- Exibe automaticamente um botao "Reparar Conexao" que chama o endpoint de auto-heal
- O usuario so precisa escanear o QR Code novamente -- sem acessar servidor

### 2.3 Cooldown agressivo no endpoint /connect

Aumentar o cache do endpoint `/connect` de 60s para **120s** e adicionar um cooldown: se a mesma instancia receber mais de 3 chamadas `/connect` em 5 minutos, bloquear com resposta cached por 5 minutos inteiros. Isso impede que mesmo com multiplos usuarios abrindo a pagina, o servidor seja bombardeado.

### 2.4 Circuit breaker por instancia

Se uma instancia retornar estado `"connecting"` por mais de 5 minutos seguidos nos checks de estado, o proxy automaticamente para de fazer chamadas a Evolution API para aquela instancia e retorna `{ state: "close" }` por 10 minutos. Isso protege o servidor de ser sobrecarregado por instancias problematicas.

---

## Arquivos que serao modificados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/evolution-api/index.ts` | Novo endpoint `/restart-instance`, circuit breaker por instancia, cooldown agressivo no `/connect` |
| `src/pages/Settings.tsx` | Deteccao de loop (3+ checks em "connecting") e botao "Reparar Conexao" |
| `src/hooks/useEvolutionAPI.ts` | Nova funcao `restartInstance()` que chama o endpoint de auto-heal |

---

## Resumo

| Problema | Solucao |
|---|---|
| Sessoes corrompidas causam loop | Comandos Docker corretos para limpar agora |
| App nao detecta instancia em loop | Deteccao automatica apos 3 checks consecutivos em "connecting" |
| Nao tem como resolver sem acessar servidor | Endpoint de auto-heal que faz logout + recriacao automaticamente |
| Muitas chamadas simultaneas sobrecarregam | Circuit breaker + cooldown agressivo no proxy |

