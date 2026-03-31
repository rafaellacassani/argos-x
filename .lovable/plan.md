

## Correção: Vídeos/mídias não enviados em SalesBots (nós resumidos da fila)

### Problema identificado
O arquivo `supabase/functions/check-no-response-alerts/index.ts` contém uma versão simplificada da função `resumeFlowFromNode` que processa nós de SalesBot quando itens da fila de espera expiram (timers, horário comercial, etc).

O nó `send_message` nesse arquivo (linhas 136-151) **só envia texto**. Ele ignora completamente os campos `nodeMediaUrl` e `nodeMediaType`, que são usados para enviar vídeos, imagens e áudios. Quando um bot tem nós com mídia após um nó "Aguardar", a mídia simplesmente não é enviada.

Compare com a versão completa em `whatsapp-webhook/index.ts` (linhas 205-247) que trata corretamente:
- Áudio (sendWhatsAppAudio / PTT)
- Imagem/Vídeo (sendMedia com caption)
- Texto simples

### Solução
Atualizar a função `resumeFlowFromNode` em `check-no-response-alerts/index.ts` para incluir o tratamento de mídia, espelhando a lógica do `whatsapp-webhook`.

### Alteração
**Arquivo:** `supabase/functions/check-no-response-alerts/index.ts`

Substituir o case `send_message` (linhas 136-151) para:
1. Verificar `nodeMediaUrl` e `nodeMediaType`
2. Se for áudio, enviar via `sendWhatsAppAudio`
3. Se for imagem/vídeo/documento, enviar via `sendMedia`
4. Se tiver apenas texto, manter comportamento atual
5. Adicionar uma função auxiliar `sendMedia` e `sendAudio` similar ao que já existe

### Impacto
- Corrige o envio de vídeos, imagens e áudios em SalesBots que usam nós "Aguardar"
- Sem efeito colateral em outras funcionalidades
- A função `sendWhatsApp` existente (texto) permanece inalterada

### Observação adicional
O envio de FAQ da IA (via `whatsapp-webhook` e `facebook-webhook`) está funcionando corretamente no código. Se a IA não está enviando vídeos do FAQ, pode ser que o modelo de IA não está incluindo as referências `[Vídeo anexo: URL]` na resposta. Isso depende do prompt e do comportamento do modelo, não de um bug no código de envio.

