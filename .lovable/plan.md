

# Fix: Evolution API Pairing Code retornando null

## Diagnóstico

Analisando a documentação oficial da Evolution API e o código atual, identifiquei **3 problemas**:

1. **Restart desnecessário quebra o fluxo**: Antes de solicitar o pairing code, o código faz `PUT /instance/restart` (linha 246). Isso coloca a instância em estado `connecting` transitório. Com apenas 2s de delay, a instância ainda não está pronta quando o `/instance/connect` é chamado — resultando em `pairingCode: null`.

2. **A instância precisa estar em estado `close`**: Segundo a documentação, o pairing code só funciona quando a instância está desconectada. Se ela já estiver em `connecting` (após o QR code ter sido gerado anteriormente), precisa fazer **logout** primeiro para voltar ao estado `close`, não restart.

3. **Cache do `getConnectResponse`**: A função `getConnectResponse` cacheia respostas do `/instance/connect` por 15s. Se o QR code foi solicitado antes, o cache pode interferir com a chamada do pairing code.

## Plano de correção

### 1. Edge Function `evolution-api` — rota `POST /pairing/:instanceName`

Substituir a lógica atual por:

```text
1. Fazer logout da instância (DELETE /instance/logout/{name})
   — Isso garante estado "close"
2. Aguardar 3 segundos
3. Chamar GET /instance/connect/{name}?number={sanitizedNumber}
4. Limpar cache do connectResponseCache para essa instância
5. Se pairingCode ainda for null, retornar erro claro
```

Remover o `restart` e usar `logout` no lugar — é o que a Evolution API exige para gerar pairing code quando a instância já teve um QR code gerado.

### 2. Validação de número no frontend (`ConnectionModal.tsx`)

Garantir que o número digitado pelo usuário é sanitizado corretamente:
- Strip de `+`, parênteses, traços, espaços
- Verificar comprimento mínimo (10 dígitos) e máximo (15 dígitos)
- Já está implementado, apenas confirmar

### Resumo técnico

| Arquivo | Mudança |
|---|---|
| `supabase/functions/evolution-api/index.ts` | Trocar restart por logout + delay 3s + limpar cache antes do connect com number |

Mudança pontual em ~15 linhas. Nenhuma alteração no frontend necessária.

