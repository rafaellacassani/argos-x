

## Diagnóstico dos Problemas

Analisei os prints, o prompt da Iara, o prompt da Aria e o código do `ai-agent-chat`. Encontrei 3 problemas distintos:

### Problema 1: Iara envia link do Calendly (mesmo com regra "NUNCA enviar o link do Calendly")
O treinamento da Iara diz explicitamente "NUNCA enviar o link do Calendly" e "NUNCA mencionar reunião ou agendamento". Porém, o modelo está ignorando essa instrução. Isso acontece porque:
- A seção de escalação diz `[Pausar IA e transferir para fila humana]` — mas isso é uma **anotação interna** que o modelo interpreta como texto literal, não como uma instrução de tool call
- O modelo não recebe uma instrução clara de **usar a tool `pausar_ia`** quando o lead pede para falar com humano
- O Calendly link provavelmente foi memorizado de mensagens anteriores do Rafael (humano) no histórico da conversa

### Problema 2: Iara não sabe orientar clientes existentes
A Iara está treinada **exclusivamente como vendedora para novos prospects**. Quando um cliente já cadastrado pergunta "como mudar meu teste para o plano escala", ela não sabe responder porque:
- Não tem instruções sobre funcionalidades internas do painel (Perfil > Plano e Faturamento)
- Responde genericamente "precisa ser feita direto na plataforma ou pela nossa equipe de suporte" em vez de guiar passo a passo

### Problema 3: Aria (suporte no widget) funciona diferente
A Aria já tem todas as instruções corretas sobre navegação no painel. O problema está concentrado na Iara (WhatsApp).

---

## Plano de Correção

### Passo 1 — Reforçar instruções de escalação na Iara (via DB)

Atualizar o `system_prompt` e `knowledge_rules` da Iara para incluir:

**Na seção de ESCALAÇÃO das rules:**
```
ESCALAÇÃO — REGRA ABSOLUTA:
Quando a pessoa pedir para falar com humano, pessoa real ou atendente:
- Responda: "Claro! Vou transferir você para um atendente agora mesmo. Um instante!"
- USE OBRIGATORIAMENTE a ferramenta pausar_ia com o motivo da transferência
- NUNCA envie links do Calendly, NUNCA mencione agendamento de reunião
- NUNCA diga para a pessoa acessar o site ou clicar em suporte
- A transferência é feita por VOCÊ usando a ferramenta pausar_ia

O link do Calendly (https://calendly.com/contato-argosx/new-meeting) SÓ deve ser enviado quando a pessoa insistir 3 VEZES pedindo uma demonstração ao vivo da ferramenta. Em QUALQUER outro caso, NUNCA envie este link.
```

**Adicionar seção para clientes existentes nas rules:**
```
CLIENTES JÁ CADASTRADOS:
Se a pessoa já é cliente do Argos X e pergunta sobre:

- Mudar de plano / fazer upgrade:
  "Você pode fazer isso direto no painel! Clica no seu avatar (canto inferior esquerdo), depois em Plano e Faturamento. Ali você escolhe o novo plano e pronto!"

- Comprar pacote extra de leads:
  "É simples! Clica no seu avatar, depois em Plano e Faturamento. Ali tem a opção de pacotes extras."

- Cancelar conta:
  "Clica no seu avatar, depois Perfil e Segurança, rola até o final da página e clica em Excluir minha conta."

- Problemas técnicos / bugs:
  Use pausar_ia para transferir para suporte humano.

- Cobrança indevida:
  Use pausar_ia para transferir IMEDIATAMENTE para suporte humano.
```

### Passo 2 — Reforçar guardrails no código (ai-agent-chat)

Adicionar ao bloco `GUARDRAILS` uma regra extra:
```
14. ESCALAÇÃO: Quando o lead pedir para falar com humano/pessoa/atendente, você DEVE usar a ferramenta pausar_ia. NUNCA responda com links de agendamento ou calendly — use SEMPRE a ferramenta.
```

### Passo 3 — Melhorar a Aria (support-chat)

No `SYSTEM_PROMPT` da Aria, ajustar a regra sobre mudança de plano para ser mais direta:
- Quando o usuário perguntar sobre upgrade, ela deve guiar: "Clique no seu avatar > Plano e Faturamento > escolha o novo plano"
- Quando pedir humano, a escalação já funciona corretamente (abre ticket)

### Passo 4 — Sanitizar Calendly do contexto

No `ai-agent-chat`, antes de enviar a resposta, adicionar regex para remover qualquer link do Calendly da resposta da Iara caso esteja no output:
```
responseContent = responseContent.replace(/https?:\/\/calendly\.com\/[^\s)>\]]+/gi, '[link removido]')
```

---

## Resumo das Alterações

| Arquivo | Mudança |
|---------|---------|
| DB: `ai_agents` (Iara) | Atualizar `knowledge_rules` com instruções de escalação + clientes existentes |
| `ai-agent-chat/index.ts` | Adicionar guardrail #14 sobre escalação + sanitizar links Calendly |
| `support-chat/index.ts` | Ajustar prompt da Aria para ser mais direta sobre upgrade de plano |

Nenhuma tabela ou estrutura será alterada — são apenas ajustes de prompt e uma regex de segurança.

