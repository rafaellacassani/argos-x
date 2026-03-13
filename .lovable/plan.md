

## Diagnóstico

Dois problemas identificados:

### 1. Timing do script client-side
No `Cadastro.tsx`, o script `fbevents.js` é carregado **somente após o formulário ser enviado com sucesso**. O fluxo atual:
1. Usuário submete formulário → signup acontece
2. Código cria stub do `fbq`, adiciona `<script>` do Facebook
3. Chama `fbq('track', 'CompleteRegistration')` (fica na fila do stub)
4. Aguarda 600ms e navega para `/cadastro/sucesso`

O problema: `fbevents.js` (~90KB) precisa baixar e executar para processar a fila. Se levar mais que 600ms, a navegação cancela tudo e o evento nunca é enviado.

### 2. URL de origem incorreta
`sourceUrl: window.location.href` envia a URL do preview (`lovable.app`) quando testado fora do domínio de produção. O Meta pode ignorar eventos com domínio diferente do configurado no Pixel.

### 3. CAPI server-side está funcionando
Os logs confirmam `"events_received":1` — o Meta recebeu o evento server-side. Se ainda não apareceu, pode ser questão de domínio ou delay (até 20min).

---

## Correções

### A. Pré-carregar fbevents.js no mount da página
Mover a inicialização do Pixel para o `useEffect` de montagem do `Cadastro.tsx`, com o Pixel ID hardcoded (`1294031842786070`). Assim o script já estará carregado quando o usuário terminar o cadastro.

### B. Aguardar script carregar antes de disparar evento
Adicionar `onload` no script e só chamar `fbq('track', 'CompleteRegistration')` após confirmação de carregamento. Se já carregou, disparar imediatamente.

### C. Forçar `event_source_url` para domínio de produção
Substituir `window.location.href` por `https://argosx.com.br/cadastro` tanto no client quanto no server, garantindo consistência com o domínio configurado no Meta Pixel.

---

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Cadastro.tsx` | Pré-carregar Pixel no mount; aguardar `onload`; forçar URL de produção |
| `supabase/functions/public-signup/index.ts` | Forçar `event_source_url` para `argosx.com.br` sempre |

