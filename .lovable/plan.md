

## Plano: Pixel + API de Conversões do Meta

### Diagnóstico

O Pixel Helper mostra `PageView` ativo, mas o `CompleteRegistration` pode não estar aparecendo no Events Manager por dois motivos:
1. **Timing no browser**: o `fbq('track', 'CompleteRegistration')` dispara e imediatamente o `navigate()` redireciona para `/cadastro/sucesso`, podendo cancelar a requisição HTTP antes de completar
2. **Sem envio server-side**: o Meta prioriza eventos enviados via Conversions API e pode demorar até 20min para exibir eventos apenas client-side

### Solução

Implementar **duplo envio** (browser + server-side), o que é a prática recomendada pelo Meta.

---

### 1. Corrigir timing do evento client-side

**`src/pages/Cadastro.tsx`**: Aguardar um pequeno delay após disparar o `fbq` antes de navegar, garantindo que o beacon HTTP seja enviado.

```typescript
// Após signup bem-sucedido:
window.fbq?.('track', 'CompleteRegistration', { ... });
// Aguardar 500ms para o beacon completar
await new Promise(r => setTimeout(r, 500));
navigate(`/cadastro/sucesso?email=...`);
```

### 2. Adicionar campo para Access Token na UI

**`src/components/settings/MetaPixelSettings.tsx`**: Adicionar um segundo campo para o **Access Token** da API de Conversões, que será salvo no banco.

**DB migration**: Adicionar coluna `meta_conversions_token` na tabela `workspaces`.

### 3. Enviar evento server-side na edge function `public-signup`

**`supabase/functions/public-signup/index.ts`**: Após criar o workspace, buscar `meta_pixel_id` e `meta_conversions_token` do workspace admin (o workspace do Argos X interno) e enviar o evento `CompleteRegistration` via Facebook Conversions API:

```
POST https://graph.facebook.com/v21.0/{PIXEL_ID}/events
```

Payload com:
- `event_name`: `CompleteRegistration`
- `action_source`: `website`
- `user_data`: email (hashed SHA-256), phone (hashed SHA-256)
- `event_source_url`: URL do cadastro
- `event_id`: ID único para deduplicação com o evento client-side

### 4. Deduplicação browser/server

Gerar um `event_id` único no frontend e enviá-lo tanto no `fbq` quanto no body do `public-signup`. O Meta deduplica automaticamente eventos com o mesmo `event_id` + `event_name`.

---

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| DB migration | `meta_conversions_token text` em `workspaces` |
| `MetaPixelSettings.tsx` | Campo para Access Token + instruções |
| `Cadastro.tsx` | Gerar `event_id`, delay antes de navigate, enviar `event_id` no body |
| `public-signup/index.ts` | Enviar evento via Conversions API com deduplicação |
| `CadastroSucesso.tsx` | Usar mesmo `event_id` passado via query param |

### Pré-requisito do usuário

Você precisará gerar um **Access Token** no Meta Events Manager (Dataset Settings > Conversions API > Generate Token) e colá-lo na aba Meta Pixel em Integrações.

