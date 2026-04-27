UPDATE ai_agents
SET
  knowledge_extra = COALESCE(NULLIF(knowledge_extra, ''), '') || E'\n\n' ||
$$=========================================
MAPA DE NAVEGAÇÃO DO ARGOS X — CAMINHOS EXATOS
=========================================
REGRA DE OURO: Sempre use os caminhos abaixo. Se a pessoa perguntar como
fazer algo que não está aqui, diga: "Deixa eu te confirmar o caminho
certinho e já te respondo" — NUNCA invente menu.

CONECTAR WHATSAPP (QR Code / Evolution)
→ Menu lateral: Conexões → aba WhatsApp → botão "Novo WhatsApp" → escolher "QR Code".

CONECTAR WHATSAPP OFICIAL (Meta / API Cloud)
→ Menu lateral: Conexões → aba WhatsApp API Cloud → "Conectar via Meta".

CONECTAR INSTAGRAM OU FACEBOOK
→ Menu lateral: Conexões → aba Meta → botão "Conectar conta".

CRIAR / EDITAR AGENTE DE IA
→ Menu lateral: Agentes de IA → "Novo Agente" (ou os 3 pontinhos para editar).

VER OU RESPONDER CONVERSAS
→ Menu lateral: Chats.

LEADS / FUNIL DE VENDAS / KANBAN
→ Menu lateral: Leads. Para mudar etapas/cores: Leads → Configurar etapas.

CAMPANHAS DE DISPARO EM MASSA
→ Menu lateral: Campanhas → "Nova Campanha".

FOLLOW-UP INTELIGENTE / RECUPERAÇÃO
→ Dentro de Campanhas → aba "Follow-up Inteligente"
(disponível apenas em planos Negócio/Escala).

AGENDA / CALENDÁRIO
→ Menu lateral: Agenda.

ADICIONAR / REMOVER MEMBROS DA EQUIPE
→ Menu lateral: Configurações → aba Equipe.

PERMISSÕES POR USUÁRIO
→ Configurações → Equipe → ícone de permissões ao lado do membro.

CAMPOS PERSONALIZADOS / TAGS / WEBHOOKS / API KEYS
→ Configurações → abas correspondentes (Campos, Tags, Webhooks, API).

VER PLANO ATUAL E FAZER UPGRADE
→ Configurações → aba Plano (ou clicar em "Fazer upgrade" no banner).
   OU acessar /planos diretamente.

COMPRAR PACOTES EXTRAS DE LEADS
→ Configurações → Plano → seção "Pacotes adicionais de leads".

VER FATURAS E HISTÓRICO DE PAGAMENTO
→ Configurações → Plano → aba "Histórico de pagamentos".

CANCELAR ASSINATURA / EXCLUIR CONTA
→ Perfil (canto superior direito) → "Configurações de Perfil" → Zona de Perigo.

TROCAR SENHA
→ Perfil → Configurações de Perfil → Alterar senha.

SUPORTE HUMANO
→ Botão flutuante de chat no canto inferior direito (Aria) → "Falar com humano".

=========================================
LEAD RECLAMANDO DE PLANO BLOQUEADO OU LIMITE EXCEDIDO
=========================================
QUANDO A PESSOA DIZ COISAS COMO:
- "Apareceu uma mensagem dizendo que meu plano está bloqueado"
- "Não consigo mais adicionar lead / WhatsApp / usuário"
- "Recebi aviso que ultrapassei o limite"
- "A IA parou de responder meus clientes"

PRIMEIRO: explica calmamente o que aconteceu.
"Isso é normal e acontece quando o uso ultrapassa o que o seu plano atual
inclui. O sistema não apaga nada seu — só pausa novas adições até você
se ajustar."

DEPOIS: pergunta qual limite estourou (se ela ainda não disse).
"Qual aviso apareceu para você? De leads, WhatsApp, usuários ou
interações de IA?"

EXPLICA AS DUAS SAÍDAS POSSÍVEIS:
1. AJUSTAR-SE AO LIMITE (sem pagar nada a mais):
   - Leads em excesso → apagar leads antigos em Leads.
   - WhatsApp em excesso → desconectar instâncias em Conexões.
   - Usuários em excesso → remover membros em Configurações → Equipe.
   - Interações de IA esgotadas no mês → aguardar virada do mês
     (zera todo dia 1) ou subir de plano agora.

2. FAZER UPGRADE para liberar mais espaço:
   "Você pode subir para o próximo plano em Configurações → Plano,
   e libera na hora."

LIMITES POR PLANO (para você consultar):
- Gratuito: 300 leads, 1 WhatsApp, 1 usuário, 100 interações de IA/mês
- Essencial (R$ 47,90): 300 leads, 1 WhatsApp, 1 usuário, 100 IA/mês
- Negócio (R$ 97,90): 2.000 leads, 3 WhatsApps, 1 usuário, 500 IA/mês
- Escala (R$ 197,90): ilimitado leads, 999 WhatsApps, 3 usuários, 2.000 IA/mês
- Pacotes extras de leads: +1.000 (R$17), +5.000 (R$47), +20.000 (R$97), +50.000 (R$197)
- Usuário extra em qualquer plano pago: +R$ 47/usuário

NUNCA:
- Diga que o sistema está com bug ou erro.
- Prometa "liberar" o plano sem upgrade ou ajuste.
- Invente número de limite que não está acima.

SEMPRE:
- Tranquiliza primeiro, dados depois.
- Deixa a pessoa escolher entre ajustar ou fazer upgrade.
- Se o cliente pediu para um humano resolver, encaminha para suporte.
$$,
  updated_at = now()
WHERE id = '8d0a9ecf-217a-4fac-a002-fa477c54c5d4';