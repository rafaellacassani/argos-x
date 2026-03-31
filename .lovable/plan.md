

## Análise Completa dos Agentes de IA — Últimos 2 Dias

### Dados Analisados
- 1.582 execuções com sucesso, 158 pausadas, 96 loops detectados, 18 rejeitadas
- Mensagens WABA (cloud) e Evolution (instâncias diretas) dos últimos 2 dias
- FAQ com vídeos anexados, logs de entrega de mídia

---

### PROBLEMA 1 — Vídeos NÃO são entregues via WABA (Cloud API)

**Causa raiz:** A função `facebook-webhook/index.ts` que envia respostas da IA via WABA (linhas 442-452) usa **apenas** `sendWhatsAppCloudMessage()`, que envia **somente texto**. Ela NÃO faz extração de `[Vídeo anexo: URL]` nem envia mídia.

A Iara (que opera na instância WABA `cloud_980377115162609`) gera respostas com FAQ que contém vídeos anexados, mas:
- A IA envia apenas o texto "Segue o vídeo do passo a passo" sem o vídeo real
- Ou envia a URL crua como texto em vez de enviar o arquivo de vídeo

**Evidência:** Mensagem para `556496773004` às 17:00 — apenas texto "Segue o vídeo do passo a passo", sem vídeo real. Zero mensagens com `message_type = video` na instância WABA nos últimos 2 dias.

**Correção:**
- Em `facebook-webhook/index.ts`, antes de chamar `sendWhatsAppCloudMessage()`, aplicar a mesma lógica `extractMediaFromChunk()` que já existe no `whatsapp-webhook`
- Criar função `sendWhatsAppCloudMedia()` que use a Graph API para enviar vídeo/imagem/documento via Cloud API
- A Cloud API suporta envio de mídia por URL via `type: "video"` com `link: URL`

**Arquivo:** `supabase/functions/facebook-webhook/index.ts`

---

### PROBLEMA 2 — Agente "Vanessa Nery" enviando lixo/gibberish para clientes reais

**Evidência:** Múltiplas mensagens enviadas para números reais (`5511940690087`, `5511915392549`) contendo texto completamente aleatório em russo, coreano, árabe, etc. — tokens de IA sem sentido.

**Causa:** O agente usa o modelo `openai/gpt-4o-mini` e o sistema prompt é extremamente longo/rígido (SOP com IF/THEN). Isso causa degeneração do modelo — o contexto acumulado + prompt longo faz o modelo gerar tokens aleatórios.

**Correção:**
- Em `ai-agent-chat/index.ts`, adicionar **detecção de gibberish** antes de enviar a resposta: se a resposta contiver caracteres de múltiplos scripts não-latinos (cirílico, coreano, árabe, etc.) acima de um threshold, bloquear o envio e usar fallback
- Adicionar um guard que verifica se a resposta tem menos de 20% de caracteres alfanuméricos latinos — se sim, classificar como gibberish

**Arquivo:** `supabase/functions/ai-agent-chat/index.ts`

---

### PROBLEMA 3 — Alta taxa de loop_detected (96 em 2 dias)

**Agentes mais afetados:**
- Iara: 21 loops
- Matheus havisk: 20 loops
- Aria: 13 loops
- TMM Assistência Virtual: 10 loops
- Simara: 9 loops

Loops são detectados corretamente (é um mecanismo de segurança que funciona), mas a taxa alta indica que:
- Alguns leads estão em conversas circulares onde a IA repete a mesma resposta
- O detector de loop pode estar sendo acionado prematuramente em conversas legítimas onde o lead responde com mensagens curtas como "Ok", "Sim", "Fiz"

**Impacto:** Leads que enviam mensagens curtas legítimas ficam sem resposta porque o loop é detectado.

**Correção sugerida:** Revisar a sensibilidade do detector de loop — ele deve considerar o conteúdo da conversa, não apenas a repetição de padrões de mensagem curta.

---

### Resumo das Correções

| # | Problema | Arquivo | Impacto |
|---|----------|---------|---------|
| 1 | Vídeos FAQ não entregues via WABA | `facebook-webhook/index.ts` | **Crítico** — clientes não recebem vídeos |
| 2 | Gibberish enviado a clientes reais | `ai-agent-chat/index.ts` | **Crítico** — dano à reputação |
| 3 | Loops excessivos bloqueando leads | `ai-agent-chat/index.ts` | **Médio** — leads perdem atendimento |

