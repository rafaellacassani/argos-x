

### Plano: 5 correções críticas no `ai-agent-chat`

**1. Bloquear nome extraído inválido (final)**
- Reforçar `NAME_BLOCKLIST` com TODAS as palavras vistas: `autônomo, autonomo, de, uma, cliente, vendedor, responsável, responsavel, quero, iniciante, profissional, aluno, interessado, lead, contato, pessoa, atendente, suporte, comprador, novo, novato`
- Exigir **2 letras maiúsculas iniciais** (forçar Capitalize) E mínimo **3 caracteres**
- Validação extra: rejeitar se a "palavra-nome" aparecer minúscula em qualquer mensagem do histórico recente

**2. Fallback só dispara em falha REAL**
- Antes de mostrar "instabilidade técnica", verificar se houve resposta válida do modelo (mesmo que tool-call sem texto)
- Se tool-call sem texto, gerar resposta padrão neutra de transição em vez do fallback genérico
- Reduzir frequência drasticamente

**3. Forçar idioma português no Claude (Aria/Iara/master workspaces)**
- Adicionar instrução absoluta no system prompt: *"SEMPRE responda em português brasileiro, NUNCA em inglês, mesmo ao analisar imagens"*
- Mesmo quando modelo é Claude Haiku/Sonnet

**4. Cap rígido de contexto (anti-explosão de tokens)**
- Truncar mensagens-imagem do histórico após 5 imagens (manter apenas a última)
- Forçar summarization quando context_window > 50.000 tokens (não apenas a cada 30 msgs)
- Limitar tamanho máximo de input enviado ao modelo a 80k tokens hard-cap

**5. Loop detectado → transferir para humano**
- Quando `detectAILoop` retorna positivo, em vez de só logar, criar entrada em `human_support_queue` com `reason='ai_loop'`
- Notificar membro responsável

### Não-implementação (responsabilidade do cliente)
- Configurações de temperatura, tamanho de prompt e qualidade de treinamento são responsabilidade do workspace. Vamos documentar como avisos visuais na UI (já existe na aba Avançadas).

### Comunicação aos clientes afetados
Após o deploy, sugiro enviar um aviso aos workspaces da lista (Narciso & Ribeiro, Relaxar e Meditar, Jm beauty clinic, Atacadão natural, Herbalife, Le Fiori Grafica, Bem estar bem, Bernardino Advocacia, BeloLar, Imobiliária Vitória Certa, Vantique, JetLub, RC Academy, Federação Cearense, Computer Doctor) confirmando que o problema foi identificado e corrigido.

### Arquivos a serem alterados
- `supabase/functions/ai-agent-chat/index.ts` (único arquivo — todas as 5 correções)

### Não será alterado
- Nenhum agente, nenhuma configuração de cliente, nenhuma outra função

