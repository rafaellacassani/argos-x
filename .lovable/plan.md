
# Documento de Treinamento da Agente de IA -- Argos X CRM

## Objetivo

Criar um documento completo e pronto para colar na **Base de Conhecimento** da agente de IA, dividido nas 4 seções que o sistema espera:

1. **Produtos, Servicos e Precos** (campo `knowledge_products`)
2. **Regras e Restricoes** (campo `knowledge_rules`)
3. **Contexto Adicional** (campo `knowledge_extra`)
4. **FAQ** (campo `knowledge_faq` -- array de perguntas/respostas)

O documento sera escrito em linguagem informal e didatica ("para leigos"), sem termos em ingles, com foco em **vender** o Argos X como solucao.

---

## Secao 1: Produtos, Servicos e Precos

Conteudo que sera gerado cobrindo:

**O que e o Argos X:**
- Plataforma de gestao comercial e atendimento ao cliente
- Centraliza todos os canais de comunicacao (WhatsApp, Instagram, Facebook, Email) em um so lugar
- Organiza leads num funil de vendas visual (tipo arrastar e soltar)
- Tem agente de inteligencia artificial que atende 24h
- Tem automacoes que trabalham sozinhas enquanto voce dorme

**Funcionalidades principais detalhadas (cada uma explicada de forma simples):**
- Funil de Vendas (Kanban visual, etapas customizaveis, arrastar leads, filtros, carteira do vendedor, automacoes por etapa)
- Chats unificados (todas as conversas num lugar so, etiquetas, agendamento de mensagens, painel do lead ao lado)
- Agente de IA (atende sozinha 24h, qualifica leads, 6 modelos prontos, base de conhecimento, FAQ, tom de voz customizavel)
- SalesBots (fluxos automatizados tipo "receita de bolo", disparo por gatilhos, condicoes, esperas)
- Campanhas em massa (envio para listas filtradas, agendamento, personalizacao com nome do lead, anexos)
- Calendario (eventos, tarefas, sincronizacao com Google Agenda)
- Contatos (base centralizada, importacao CSV, enriquecimento de perfil, tags em lote)
- Email (caixa de entrada integrada, envio, resposta, sincronizacao Gmail)
- Dashboard (metricas em tempo real, ranking de equipe, graficos de atividade)
- Estatisticas (taxa de conversao, receita por periodo, desempenho por vendedor)
- Integracoes (WhatsApp via QR Code, WhatsApp API oficial, Instagram, Facebook, Google Calendar)
- Configuracoes (gestao de equipe com permissoes, tags automaticas, notificacoes)

**Planos e precos:**
- Gratuito: R$ 0 (teste de 7 dias) -- 300 leads, 1 WhatsApp, 1 usuario, 100 interacoes de IA
- Essencial: R$ 47,90/mes -- 300 leads, 1 WhatsApp, 1 usuario, 100 interacoes de IA
- Negocio: R$ 97,90/mes -- 2.000 leads, 3 WhatsApps, 1 usuario (adicional R$ 37/mes), 500 interacoes de IA
- Escala: R$ 197,90/mes -- Leads ilimitados, WhatsApps ilimitados, 3 usuarios (adicional R$ 57/mes), 2.000 interacoes de IA

**Pacotes extras de leads:**
- +1.000 leads: R$ 17/mes
- +5.000 leads: R$ 47/mes
- +20.000 leads: R$ 97/mes
- +50.000 leads: R$ 197/mes

---

## Secao 2: Regras e Restricoes

Conteudo cobrindo:
- Nunca inventar funcionalidades que nao existem
- Nunca mencionar concorrentes pelo nome
- Nunca prometer prazos de implementacao de funcoes novas
- Sempre recomendar o plano mais adequado ao tamanho do negocio do lead
- Quando o lead pedir algo fora do escopo, encaminhar para atendimento humano
- Nao dar suporte tecnico aprofundado (ex: configurar API, resolver bugs); encaminhar para equipe
- Nunca compartilhar dados de outros clientes
- Sempre manter tom amigavel e nao pressionar demais
- Quando nao souber a resposta, dizer "vou confirmar com a equipe e te retorno"
- Funcoes em desenvolvimento (TikTok, Google Business, Zoom, Calendly) devem ser mencionadas como "em breve"

---

## Secao 3: Contexto Adicional

Conteudo cobrindo:
- Publico-alvo: empresarios, autonomos, MEIs, pequenas e medias empresas
- Diferenciais vs planilhas e anotacoes manuais
- Proposta de valor: "Voce nunca mais vai perder um cliente por esquecimento"
- Argos X funciona no navegador, celular e computador
- Suporta multiplos WhatsApps numa mesma conta (planos superiores)
- A agente de IA pode ser treinada com o jeito de falar do proprio dono do negocio
- Dados seguros e armazenados na nuvem
- Pagamento via cartao de credito (recorrente mensal)

---

## Secao 4: FAQ (minimo 25 perguntas)

Perguntas cobrindo todas as areas:
- "O que e o Argos X?" / "Como funciona?"
- "Quanto custa?" / "Tem teste gratis?"
- "Funciona no celular?"
- "Consigo conectar meu WhatsApp?" / "E seguro?"
- "O que e o funil de vendas?"
- "Como a agente de IA funciona?"
- "Ela responde sozinha no WhatsApp?"
- "Posso usar no Instagram e Facebook tambem?"
- "Quantas pessoas podem usar?"
- "O que sao SalesBots?"
- "Consigo enviar mensagem para todos os clientes de uma vez?"
- "Tem calendario?"
- "Consigo importar meus contatos?"
- "O que acontece quando acaba meus leads?"
- "Como cancelo?"
- "Precisa instalar algo?"
- "Funciona para qualquer tipo de negocio?"
- "Consigo ver relatorios de vendas?"
- "O que e a carteira do vendedor?"
- "Posso agendar mensagens?"
- "A IA vai substituir meus vendedores?"
- "Meus dados ficam seguros?"
- "Consigo personalizar as etapas do funil?"
- "Como faco para comecar?"
- "Tem suporte?"

---

## Implementacao Tecnica

O documento sera criado como uma **nova pagina** (`src/pages/AgentTrainingDoc.tsx`) que:

1. Exibe o conteudo completo formatado e organizado
2. Tem botao "Copiar" para cada secao, facilitando colar na base de conhecimento da agente
3. Sera acessivel via rota `/agent-training` (protegida, apenas admin)
4. Tambem adicionaremos link no sidebar para super admins

**Arquivos a criar/editar:**
- `src/pages/AgentTrainingDoc.tsx` (novo) -- pagina com todo o conteudo
- `src/App.tsx` -- adicionar rota
- `src/components/layout/AppSidebar.tsx` -- adicionar link no menu (super admin)
