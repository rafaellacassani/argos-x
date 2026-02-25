
# Pagina de Treinamento para Vendedoras - Argos X

## Objetivo
Criar uma pagina interna `/treinamento` com conteudo de treinamento completo, visual e didatico, para que as vendedoras possam:
1. Aprender a apresentar o Argos X para empresarios leigos
2. Consultar duvidas frequentes rapidamente
3. Seguir um roteiro de demonstracao na ordem ideal

## Estrutura da Pagina

A pagina tera formato de "guia interativo" com secoes colapsaveis (accordion), usando linguagem simples e sem termos tecnicos. Cada secao tera icones ilustrativos e explicacoes curtas e diretas.

### Secoes do Treinamento (na ordem de apresentacao ideal)

**1. O que e o Argos X? (Elevator Pitch)**
- Frase pronta para usar com o cliente: "O Argos X e como ter uma secretaria inteligente no seu WhatsApp que nunca esquece de responder ninguem"
- 3 beneficios principais em linguagem simples
- Para quem serve (exemplos de negocios)

**2. Conectar o WhatsApp (Integracoes)**
- Passo a passo visual de como escanear o QR Code
- Explicar que o WhatsApp do cliente continua funcionando normal
- Resposta para duvida: "Vou perder minhas conversas?" → Nao

**3. Funil de Vendas (Leads)**
- O que e um funil em linguagem simples: "E como um quadro de post-its onde voce arrasta cada cliente pela jornada de compra"
- Explicar etapas: Novo → Qualificado → Proposta → Negociacao → Fechado
- Como criar um lead manualmente
- Filtro "Minha Carteira" - o que e e para que serve
- Vista Kanban vs Lista

**4. Chats Centralizado**
- Explicar: "Todas as conversas do WhatsApp, Instagram e Facebook em um so lugar"
- Como responder mensagens
- Como enviar audio, imagem e agendar mensagem
- Painel lateral do lead (ver historico, tags, dados)

**5. Agentes de IA**
- Explicar em linguagem simples: "Um robo que responde seus clientes automaticamente, 24 horas, como se fosse voce"
- O que ele faz: responde perguntas, qualifica o lead, agenda reunioes
- Como criar um agente: nome, personalidade, base de conhecimento (FAQ)

**6. SalesBots (Automacoes)**
- Explicar: "Sequencias automaticas de mensagens, tipo um funil no WhatsApp"
- Exemplo pratico: "Quando alguem manda 'oi', o bot responde, pergunta o interesse e move o lead pra etapa certa"
- Templates prontos disponiveis

**7. Campanhas em Massa**
- Explicar: "Enviar a mesma mensagem pra varios clientes de uma vez, tipo um disparo"
- Cuidados: nao e spam, respeitar limites

**8. Dashboard e Estatisticas**
- O que o empresario ve: mensagens recebidas, leads novos, vendas, ranking da equipe
- Explicar valor: "Voce sabe exatamente quem ta vendendo mais e quem ta deixando cliente sem resposta"

**9. Contatos**
- Importar contatos de planilha
- Enriquecer perfis automaticamente
- Tags para organizar

**10. Calendario e Email**
- Integracoes disponiveis (Google Calendar)
- Centralizar emails

**11. Configuracoes Essenciais**
- Equipe: convidar vendedores, definir permissoes
- Tags: organizar clientes por categoria
- Notificacoes: alertas de cliente sem resposta

**12. Planos e Precos**
- Tabela comparativa simples dos 3 planos: Semente (R$97), Negocio (R$297), Escala (R$697)
- Pacotes extras de leads
- Como responder "e caro?" - argumentos de valor

### Secao de FAQ para Vendedoras
Accordion separado com perguntas frequentes que os CLIENTES fazem:
- "Vou perder minhas conversas do WhatsApp?"
- "Funciona no celular?"
- "Posso usar meu numero pessoal?"
- "Meus funcionarios vao ver minhas conversas pessoais?"
- "E se eu cancelar, perco meus dados?"
- "Preciso de computador pra usar?"
- "Quantas pessoas podem usar?"
- "Tem contrato de fidelidade?"
- "Como funciona o robo de IA?"
- "O que acontece se eu atingir o limite de leads?"
- "Posso testar antes de pagar?"
- "Consigo disparar mensagens em massa?"
- "Integra com Instagram e Facebook?"
- "E seguro? Meus dados ficam protegidos?"
- "Quanto tempo leva pra configurar tudo?"

## Implementacao Tecnica

### Arquivo novo: `src/pages/Treinamento.tsx`
- Pagina protegida (precisa estar logado)
- Layout com `AppLayout` (sidebar + topbar)
- Usa componentes existentes: `Accordion`, `Card`, `Badge`, `Tabs`
- Secao de treinamento com accordions expansiveis
- Secao de FAQ separada com accordions
- Botao "Imprimir / Exportar PDF" usando `window.print()` (mesmo padrao do ProjectDocs)
- Design limpo e visual, com icones do Lucide para cada secao
- Responsivo para mobile (vendedoras podem consultar pelo celular)

### Rota nova no `App.tsx`
- Adicionar rota `/treinamento` dentro das rotas protegidas com `AppLayout`

### Link no menu lateral (`AppSidebar.tsx`)
- Adicionar item "Treinamento" com icone `GraduationCap` no menu, apos "Configuracoes"

### Estilo
- Sem termos tecnicos na interface
- Textos curtos e diretos
- Cada secao com icone colorido para facilitar a navegacao visual
- Destaques em cards coloridos para "dicas de venda" e "respostas prontas"
- Tons amigaveis e motivacionais
