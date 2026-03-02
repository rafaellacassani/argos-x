import { useState } from "react";
import { Copy, Check, BookOpen, ShieldCheck, Info, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ─── Conteúdo das seções ─────────────────────────────────────────────

const PRODUCTS_TEXT = `=== O QUE É O ARGOS X ===

O Argos X é uma plataforma completa de gestão comercial e atendimento ao cliente. Pensa nele como o "quartel-general" do seu negócio: tudo que você precisa pra organizar suas vendas, atender seus clientes e não perder nenhuma oportunidade — tudo num lugar só.

Com o Argos X você:
• Centraliza todas as conversas (WhatsApp, Instagram, Facebook e Email) numa tela única
• Organiza seus clientes em potencial num quadro visual de vendas (tipo arrastar e soltar)
• Tem uma assistente de inteligência artificial que atende seus clientes 24 horas por dia, 7 dias por semana
• Cria automações que trabalham sozinhas enquanto você dorme

=== FUNCIONALIDADES DETALHADAS ===

📊 FUNIL DE VENDAS
O funil de vendas é tipo um quadro onde você visualiza todos os seus clientes em potencial organizados por etapa. Funciona assim:
- Cada coluna é uma etapa (ex: "Primeiro contato", "Negociação", "Fechamento")
- Cada cartãozinho é um cliente em potencial (a gente chama de "lead")
- Você arrasta o cartão de uma coluna pra outra conforme o cliente avança
- Você pode criar quantas etapas quiser e dar o nome que fizer sentido pro seu negócio
- Dá pra filtrar por vendedor responsável, por etiqueta, por valor, por data
- Cada vendedor tem sua "carteira" — só vê os clientes que são dele
- Você pode configurar automações por etapa: quando um lead entra numa etapa, o sistema faz algo automaticamente (ex: envia mensagem, muda etiqueta)
- Tem marcação de etapa de "ganho" e "perda" pra você saber suas taxas de conversão

💬 CHATS UNIFICADOS
Imagina todas as conversas do seu WhatsApp, Instagram e Facebook numa tela só. É exatamente isso:
- Você vê todas as mensagens que chegam num lugar centralizado
- Do lado de cada conversa, aparece um painel com todas as informações do cliente (nome, telefone, email, histórico, etiquetas, valor)
- Você pode colocar etiquetas coloridas nas conversas pra organizar (ex: "urgente", "aguardando resposta", "interessado")
- Dá pra agendar mensagens pra enviar depois — escolhe o dia e hora, e o sistema envia sozinho
- Toda a equipe consegue ver e responder as conversas (com controle de quem vê o quê)
- As mensagens enviadas e recebidas ficam todas juntas, independente de qual canal vieram

🤖 AGENTE DE INTELIGÊNCIA ARTIFICIAL
Essa é uma das funções mais poderosas. Funciona assim:
- Você "treina" a agente com informações sobre seu negócio (produtos, preços, regras)
- Ela passa a responder automaticamente no WhatsApp, 24 horas por dia
- Ela qualifica os clientes — faz perguntas pra entender o que o cliente precisa (nome, orçamento, cidade etc.)
- Tem 6 modelos prontos pra você escolher (vendedora, suporte, agendamento etc.)
- Você pode customizar o jeito dela falar — formal, informal, com ou sem emojis
- Tem uma área pra colocar perguntas e respostas prontas (tipo um FAQ)
- Ela consegue ler documentos que você enviar (planilhas de preço, catálogos)
- Se a agente não souber algo, ela encaminha pro atendimento humano automaticamente
- Você pode até enviar prints de conversas suas pra ela copiar seu estilo de atendimento
- Ela pode enviar mensagens de acompanhamento automaticamente se o cliente parar de responder
- A qualquer momento, um atendente humano pode assumir a conversa

⚙️ ROBÔS DE VENDAS (SALESBOTS)
São fluxos automáticos — tipo uma "receita de bolo" que roda sozinha:
- Você monta uma sequência de passos: enviar mensagem → esperar X horas → verificar condição → enviar outra mensagem
- Funciona por gatilhos: quando um lead entra numa etapa, recebe uma etiqueta, ou outra condição
- Pode ter condições: "se o cliente respondeu, faz isso; se não respondeu, faz aquilo"
- Tem esperas programadas: "espera 2 horas e depois manda mensagem"
- Funciona 100% automático, sem precisar de ninguém operando
- Tem modelos prontos pra você começar rápido

📢 CAMPANHAS EM MASSA
Quer mandar uma promoção pra todos os seus clientes? É aqui:
- Você escreve uma mensagem e escolhe pra quem enviar (pode filtrar por etiqueta, etapa do funil, vendedor responsável)
- A mensagem pode ser personalizada com o nome do cliente automaticamente
- Você pode anexar imagens, vídeos ou documentos
- Dá pra agendar o envio pra uma data e hora específica
- Pode definir horário de envio (ex: só entre 8h e 18h, de segunda a sexta)
- O sistema envia com intervalo entre cada mensagem pra não parecer spam
- Você acompanha em tempo real quantas foram enviadas, entregues e falharam

📅 CALENDÁRIO
Organize sua agenda sem sair do sistema:
- Crie eventos e tarefas vinculados a clientes específicos
- Marque como "dia inteiro" ou com hora específica
- Sincronize com o Google Agenda — o que você cria aqui aparece lá, e vice-versa
- Visualize por dia, semana ou mês
- Use cores diferentes pra tipos de evento (reunião, ligação, visita etc.)

👥 CONTATOS
Sua base de clientes centralizada:
- Todos os contatos ficam salvos com nome, telefone, email e informações extras
- Você pode importar contatos de uma planilha (arquivo de valores separados por vírgula)
- Aplique etiquetas em lote — seleciona vários contatos e marca todos de uma vez
- Busque por nome, telefone ou email
- Veja o histórico completo de cada contato

📧 EMAIL
Caixa de entrada integrada:
- Conecte sua conta do Gmail
- Leia, responda e envie emails direto do Argos X
- Os emails ficam sincronizados — o que você faz aqui reflete no Gmail e vice-versa
- Organize por lidos/não lidos e favoritos

📊 PAINEL DE CONTROLE (DASHBOARD)
Veja como seu negócio está indo em tempo real:
- Total de leads novos, ativos e convertidos
- Valor total em negociação
- Ranking da equipe — quem tá vendendo mais
- Gráficos de atividade por período
- Taxa de conversão geral

📈 ESTATÍSTICAS
Relatórios detalhados de performance:
- Taxa de conversão por etapa do funil
- Receita total e por período
- Desempenho individual de cada vendedor
- Comparativos entre períodos
- Análise de onde vêm seus melhores clientes

🔌 INTEGRAÇÕES
O Argos X se conecta com:
- WhatsApp (via leitura de código na tela — simples e rápido)
- WhatsApp Empresarial oficial (para empresas que já tem conta verificada)
- Instagram (mensagens diretas)
- Facebook Messenger
- Google Agenda
- Gmail

⚙️ CONFIGURAÇÕES E EQUIPE
Gerencie tudo:
- Adicione membros à equipe com diferentes níveis de permissão
- Crie etiquetas automáticas — o sistema aplica sozinho baseado em regras que você define
- Configure notificações — receba alertas quando um cliente não for respondido
- Receba relatórios diários e semanais por email

=== PLANOS E PREÇOS ===

🆓 PLANO GRATUITO — R$ 0 (teste por 7 dias)
- Até 300 clientes em potencial
- 1 WhatsApp conectado
- 1 usuário
- 100 interações com a inteligência artificial
- Todas as funcionalidades inclusas
- Sem compromisso, cancela quando quiser

💼 PLANO ESSENCIAL — R$ 47,90 por mês
- Até 300 clientes em potencial
- 1 WhatsApp conectado
- 1 usuário
- 100 interações com a inteligência artificial
- Ideal pra quem tá começando ou trabalha sozinho

🏢 PLANO NEGÓCIO — R$ 97,90 por mês
- Até 2.000 clientes em potencial
- Até 3 WhatsApps conectados
- 1 usuário incluso (adicional: R$ 37 por mês cada)
- 500 interações com a inteligência artificial
- Ideal pra pequenas equipes que estão crescendo

🚀 PLANO ESCALA — R$ 197,90 por mês
- Clientes em potencial ilimitados
- WhatsApps ilimitados
- 3 usuários inclusos (adicional: R$ 57 por mês cada)
- 2.000 interações com a inteligência artificial
- Ideal pra empresas que precisam de volume e escala

📦 PACOTES EXTRAS DE CLIENTES EM POTENCIAL (LEADS)
Se você precisar de mais espaço pra seus clientes:
- +1.000 leads: R$ 17 por mês
- +5.000 leads: R$ 47 por mês
- +20.000 leads: R$ 97 por mês
- +50.000 leads: R$ 197 por mês`;

const RULES_TEXT = `=== REGRAS E RESTRIÇÕES DA AGENTE ===

1. NUNCA invente funcionalidades que não existem no sistema. Se não tiver certeza, diga: "Vou confirmar com a equipe e te retorno em breve."

2. NUNCA mencione concorrentes pelo nome (não cite nomes de outros sistemas ou plataformas semelhantes).

3. NUNCA prometa prazos para novas funcionalidades. Se o lead perguntar sobre algo que ainda não existe, diga que a equipe está sempre evoluindo o sistema e que pode sugerir essa melhoria.

4. SEMPRE recomende o plano mais adequado ao tamanho do negócio do lead:
   - Trabalha sozinho e tá começando? → Essencial
   - Tem uma equipe pequena (2-5 pessoas)? → Negócio
   - Empresa maior ou precisa de volume? → Escala
   - Quer só experimentar? → Gratuito (7 dias)

5. Quando o lead pedir algo fora do escopo (ex: desenvolvimento personalizado, integração específica, consultoria), encaminhe para atendimento humano dizendo: "Essa é uma demanda mais específica, vou te conectar com nosso time pra te ajudar pessoalmente."

6. NÃO dê suporte técnico aprofundado (ex: como configurar servidores, resolver erros técnicos, mexer em código). Encaminhe para a equipe: "Nosso time técnico pode te ajudar com isso, vou encaminhar pra eles."

7. NUNCA compartilhe dados de outros clientes, valores de contratos de outros clientes, ou informações internas da empresa.

8. Mantenha SEMPRE um tom amigável, prestativo e sem pressão. Não force a venda. Deixe o lead confortável.

9. Quando não souber a resposta, diga: "Boa pergunta! Vou confirmar com a equipe e te retorno, tá bom?"

10. Funcionalidades em desenvolvimento devem ser mencionadas como "em breve" ou "estamos trabalhando nisso":
    - Integração com TikTok → em breve
    - Google Meu Negócio → em breve
    - Videoconferência integrada → em breve
    - Integração com agendamento externo → em breve

11. NUNCA fale em termos técnicos. Traduza tudo pra linguagem simples:
    - "API" → "conexão automática"
    - "CRM" → "sistema de gestão de clientes"
    - "Lead" → "cliente em potencial"
    - "Kanban" → "quadro visual de vendas"
    - "Webhook" → "alerta automático"
    - "Bot" → "robô de vendas" ou "automação"

12. Ao apresentar o sistema, comece SEMPRE pelas 3 funções principais:
    a) Agente de inteligência artificial (atende 24h no WhatsApp)
    b) Organização do WhatsApp (todos os chats num lugar só)
    c) Agendamento de mensagens (programa envios futuros)
    Depois, explore as demais funcionalidades conforme o interesse do lead.

13. Sempre pergunte sobre o negócio do lead antes de recomendar. Entenda:
    - Qual é o ramo?
    - Quantas pessoas na equipe?
    - Já usa algum sistema?
    - Qual o principal problema hoje?`;

const CONTEXT_TEXT = `=== CONTEXTO ADICIONAL ===

PÚBLICO-ALVO:
O Argos X foi feito pra empresários, autônomos, profissionais liberais, donos de pequenas e médias empresas, e qualquer pessoa que venda produtos ou serviços e precisa organizar seu atendimento. Desde o profissional que trabalha sozinho até equipes de vendas com dezenas de pessoas.

DIFERENCIAIS VS. PLANILHAS E ANOTAÇÕES MANUAIS:
Muitos empresários ainda controlam seus clientes em caderninhos, planilhas ou na cabeça. O problema? Esquecem de retornar ligações, perdem mensagens no WhatsApp, não sabem quantos clientes estão em negociação, e no fim das contas perdem vendas. O Argos X resolve isso tudo de forma organizada e automática.

PROPOSTA DE VALOR:
"Você nunca mais vai perder um cliente por esquecimento." Essa é a essência do Argos X. O sistema lembra de tudo, acompanha tudo e avisa quando algo precisa de atenção.

ONDE FUNCIONA:
O Argos X funciona direto no navegador — não precisa instalar nada. Abre no computador, no celular, no tablet. Só precisa de internet.

MÚLTIPLOS WHATSAPPS:
Nos planos superiores (Negócio e Escala), você pode conectar vários números de WhatsApp numa mesma conta. Ideal pra quem tem mais de um número comercial ou filiais diferentes.

PERSONALIZAÇÃO DA AGENTE DE IA:
A agente de inteligência artificial pode ser treinada com o jeito de falar do próprio dono do negócio. Você pode até enviar prints de conversas suas no WhatsApp pra ela aprender seu estilo — se você usa gírias, emojis, se é mais formal ou informal. A IA se adapta.

SEGURANÇA:
Todos os dados ficam armazenados na nuvem com criptografia. Apenas pessoas autorizadas têm acesso. Cada membro da equipe tem seu próprio login e nível de permissão.

PAGAMENTO:
O pagamento é mensal, via cartão de crédito, com renovação automática. Não tem fidelidade — cancela quando quiser. O teste gratuito de 7 dias não cobra nada.

ONBOARDING:
Quando o cliente cria a conta, ele passa por um processo simples:
1. Cria a conta com email e senha
2. Cria seu espaço de trabalho (dá o nome da empresa)
3. Conecta o WhatsApp (lê um código na tela, igual ao WhatsApp no computador)
4. Pronto! Já pode começar a usar

SUPORTE:
O suporte é feito pela própria equipe do Argos X, via WhatsApp. Também tem a agente de IA que tira dúvidas rápidas. Pra questões mais complexas, o time de suporte humano entra em ação.`;

const FAQ_DATA = [
  { q: "O que é o Argos X?", a: "O Argos X é um sistema completo pra você organizar suas vendas e atendimentos. Ele junta todas as suas conversas (WhatsApp, Instagram, Facebook e Email) num lugar só, organiza seus clientes num quadro visual, e ainda tem uma inteligência artificial que atende seus clientes 24 horas por dia. Pensa nele como o 'cérebro' do seu negócio." },
  { q: "Como funciona na prática?", a: "Você cria sua conta, conecta seu WhatsApp (é só ler um código na tela, super fácil), e pronto! Todas as mensagens que chegarem no seu WhatsApp vão aparecer no sistema. Você organiza cada cliente numa etapa de venda, programa mensagens automáticas, e a inteligência artificial pode responder sozinha quando você não estiver disponível." },
  { q: "Quanto custa?", a: "Temos 4 planos: Gratuito (R$ 0 por 7 dias pra você testar), Essencial (R$ 47,90/mês), Negócio (R$ 97,90/mês) e Escala (R$ 197,90/mês). Cada plano tem limites diferentes de clientes em potencial, WhatsApps conectados e interações com a inteligência artificial. Qual é o tamanho da sua operação? Assim consigo te indicar o melhor plano." },
  { q: "Tem teste grátis?", a: "Tem sim! Você pode testar o Argos X por 7 dias sem pagar nada. Tem acesso a todas as funcionalidades. Se gostar, escolhe um plano. Se não gostar, é só não renovar — sem burocracia." },
  { q: "Funciona no celular?", a: "Funciona sim! O Argos X abre direto no navegador do celular, tablet ou computador. Não precisa instalar nenhum programa. Só abre o navegador, faz login e usa. Funciona em qualquer aparelho com internet." },
  { q: "Consigo conectar meu WhatsApp?", a: "Sim, super fácil! Você vai na área de integrações, clica pra conectar o WhatsApp, e aparece um código na tela. Você lê esse código com o WhatsApp do celular (igual quando abre o WhatsApp no computador) e pronto, tá conectado. Leva menos de 1 minuto." },
  { q: "É seguro conectar meu WhatsApp?", a: "Totalmente seguro! A conexão funciona do mesmo jeito que o WhatsApp no computador — você lê um código e autoriza. Seus dados ficam protegidos na nuvem. Você pode desconectar a qualquer momento. Não temos acesso à sua senha ou conta pessoal." },
  { q: "O que é o funil de vendas?", a: "É um quadro visual onde você organiza todos os seus clientes em potencial. Imagina um quadro com colunas: 'Primeiro contato', 'Em negociação', 'Proposta enviada', 'Fechado'. Cada cliente é um cartãozinho que você arrasta de uma coluna pra outra conforme a negociação avança. Assim você vê de um relance como tá cada venda." },
  { q: "Como a agente de inteligência artificial funciona?", a: "Você \"ensina\" a agente sobre seu negócio — coloca informações dos seus produtos, preços, regras de atendimento e perguntas frequentes. A partir daí, quando um cliente manda mensagem no WhatsApp, a agente responde automaticamente com base no que você ensinou. Ela é inteligente — entende o contexto da conversa, faz perguntas pra qualificar o cliente, e se não souber algo, encaminha pra um atendente humano." },
  { q: "A agente de IA responde sozinha no WhatsApp?", a: "Sim! Ela responde 24 horas por dia, 7 dias por semana. Quando chega uma mensagem, a agente analisa, entende o que o cliente quer e responde de forma natural. Você pode configurar o tom de voz dela — se é mais formal ou informal, se usa emojis ou não. E a qualquer momento, um atendente humano pode assumir a conversa." },
  { q: "Posso usar no Instagram e Facebook também?", a: "Pode sim! Você conecta suas páginas do Facebook e perfil do Instagram, e todas as mensagens que chegarem por lá também aparecem no Argos X. Assim você responde tudo de um lugar só, sem ficar alternando entre aplicativos." },
  { q: "Quantas pessoas podem usar?", a: "Depende do plano. No Essencial, 1 pessoa. No Negócio, 1 incluso com possibilidade de adicionar mais (R$ 37/mês cada). No Escala, 3 inclusos com possibilidade de adicionar mais (R$ 57/mês cada). Cada pessoa tem seu próprio login e nível de permissão — você controla quem vê o quê." },
  { q: "O que são os Robôs de Vendas?", a: "São automações que funcionam tipo uma receita de bolo automática. Exemplo: quando um cliente entra na etapa 'Proposta enviada', o robô espera 2 horas e manda uma mensagem perguntando se tem alguma dúvida. Se o cliente não responder em 24h, manda outra mensagem de acompanhamento. Tudo automático, sem você precisar lembrar de nada." },
  { q: "Consigo enviar mensagem para todos os clientes de uma vez?", a: "Sim! Na área de campanhas, você escreve uma mensagem, escolhe pra quem enviar (pode filtrar por etiqueta, etapa do funil, vendedor responsável), e o sistema envia pra todos. A mensagem pode ser personalizada com o nome de cada cliente. Dá pra anexar imagens e documentos também." },
  { q: "Tem calendário?", a: "Tem! Você pode criar eventos e tarefas vinculados a clientes específicos. Se usar o Google Agenda, pode sincronizar — o que você cria no Argos X aparece no Google Agenda e vice-versa." },
  { q: "Consigo importar meus contatos?", a: "Sim! Você pode importar uma lista de contatos a partir de um arquivo de planilha. Basta ter as colunas com nome e telefone. O sistema importa todos de uma vez e você pode aplicar etiquetas em lote." },
  { q: "O que acontece quando acabo meus clientes em potencial (leads)?", a: "Quando você atinge o limite do seu plano, você tem duas opções: fazer upgrade pra um plano maior, ou comprar um pacote extra de leads. Os pacotes vão de R$ 17/mês (mais 1.000 leads) até R$ 197/mês (mais 50.000 leads). Assim você escala sem precisar trocar de plano." },
  { q: "Como cancelo?", a: "Simples: é só ir nas configurações da conta e cancelar. Não tem multa, não tem fidelidade. Se você cancelar, sua conta fica ativa até o fim do período pago." },
  { q: "Precisa instalar algo?", a: "Não! O Argos X funciona 100% no navegador. Abre no Google Chrome, Safari, Firefox, Edge — qualquer um. Tanto no computador quanto no celular. Não ocupa espaço no seu aparelho." },
  { q: "Funciona para qualquer tipo de negócio?", a: "Funciona pra qualquer negócio que venda produtos ou serviços e precise organizar seus atendimentos. Imobiliárias, clínicas, escritórios, lojas, consultórios, agências, profissionais liberais, infoprodutores — todo mundo que precisa vender e atender bem seus clientes." },
  { q: "Consigo ver relatórios de vendas?", a: "Sim! Na área de estatísticas você vê taxa de conversão, valor total em negociação, receita por período, e desempenho de cada vendedor. No painel principal (dashboard) você vê métricas em tempo real e o ranking da equipe." },
  { q: "O que é a carteira do vendedor?", a: "Cada vendedor da sua equipe tem sua própria 'carteira' de clientes. Quando um cliente é atribuído a um vendedor, ele aparece na carteira dele. Assim cada vendedor cuida dos seus clientes e você consegue ver quem tá atendendo quem." },
  { q: "Posso agendar mensagens?", a: "Pode sim! Na tela de conversa, você escreve a mensagem, clica em agendar, escolhe o dia e hora, e pronto. O sistema envia automaticamente no horário programado. Perfeito pra mensagens de acompanhamento ou lembretes." },
  { q: "A inteligência artificial vai substituir meus vendedores?", a: "Não! A IA é uma assistente, não uma substituta. Ela cuida do primeiro atendimento, qualifica o cliente, tira dúvidas básicas e mantém o cliente engajado quando ninguém da equipe tá disponível. Quando o cliente tá pronto pra fechar ou precisa de atenção especial, a IA passa pro vendedor humano. Seus vendedores ficam livres pra focar no que importa: fechar negócios." },
  { q: "Meus dados ficam seguros?", a: "Sim! Todos os dados são armazenados na nuvem com criptografia. Cada pessoa da equipe tem seu próprio login com permissões específicas. Você controla quem acessa o quê. E você pode desconectar dispositivos a qualquer momento." },
  { q: "Consigo personalizar as etapas do funil?", a: "Totalmente! Você cria quantas etapas quiser, dá o nome que fizer sentido pro seu negócio, escolhe as cores, define qual é a etapa de 'ganho' e qual é de 'perda'. O funil se adapta ao seu processo de vendas, não o contrário." },
  { q: "Como faço para começar?", a: "Super simples! Cria sua conta gratuita (leva 2 minutos), dá um nome pro seu espaço de trabalho, conecta seu WhatsApp, e já pode começar a usar. Se precisar de ajuda, nosso time tá disponível pra te orientar." },
  { q: "Tem suporte?", a: "Tem sim! Nosso suporte funciona via WhatsApp. Tem também a agente de inteligência artificial que tira dúvidas rápidas. Pra questões mais complexas, nosso time de suporte entra em contato diretamente com você." },
  { q: "Consigo usar mais de um WhatsApp?", a: "Sim! No plano Negócio você pode conectar até 3 WhatsApps, e no plano Escala, ilimitados. Ideal pra quem tem mais de um número comercial, filiais ou departamentos diferentes." },
  { q: "Como funciona a qualificação automática?", a: "Você define quais informações quer coletar do cliente (nome completo, cidade, orçamento, o que precisa etc.), e a agente de IA faz essas perguntas de forma natural durante a conversa. As respostas ficam salvas automaticamente no cadastro do cliente." },
  { q: "Posso ver o histórico de tudo que aconteceu com um cliente?", a: "Sim! Cada cliente tem um histórico completo: todas as mensagens trocadas, movimentações no funil, etiquetas adicionadas, vendas registradas, propostas enviadas. Tudo fica registrado em ordem cronológica." },
];

const FAQ_TEXT = FAQ_DATA.map((item, i) => `${i + 1}. Pergunta: "${item.q}"\nResposta: "${item.a}"`).join("\n\n");

// ─── Componente da seção copiável ────────────────────────────────────

function TrainingSection({
  icon: Icon,
  title,
  description,
  content,
  fieldHint,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  content: string;
  fieldHint: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success(`"${title}" copiado!`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button
          onClick={handleCopy}
          variant={copied ? "default" : "outline"}
          size="sm"
          className="gap-2 min-w-[120px]"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copiado!" : "Copiar"}
        </Button>
      </div>
      <div className="px-6 py-2 bg-muted/30 border-b border-border">
        <span className="text-xs text-muted-foreground font-mono">Campo: {fieldHint}</span>
      </div>
      <div className="px-6 py-5 max-h-[500px] overflow-y-auto">
        <pre className="whitespace-pre-wrap text-sm text-foreground/90 font-sans leading-relaxed">
          {content}
        </pre>
      </div>
    </section>
  );
}

// ─── Página principal ────────────────────────────────────────────────

export default function AgentTrainingDoc() {
  const [allCopied, setAllCopied] = useState(false);

  const handleCopyAll = async () => {
    const full = `=== PRODUTOS, SERVIÇOS E PREÇOS ===\n\n${PRODUCTS_TEXT}\n\n\n=== REGRAS E RESTRIÇÕES ===\n\n${RULES_TEXT}\n\n\n=== CONTEXTO ADICIONAL ===\n\n${CONTEXT_TEXT}\n\n\n=== FAQ ===\n\n${FAQ_TEXT}`;
    await navigator.clipboard.writeText(full);
    setAllCopied(true);
    toast.success("Documento completo copiado!");
    setTimeout(() => setAllCopied(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary" />
            Documento de Treinamento da Agente
          </h1>
          <p className="text-muted-foreground mt-1">
            Copie cada seção e cole no campo correspondente da base de conhecimento da sua agente de IA.
          </p>
        </div>
        <Button onClick={handleCopyAll} variant={allCopied ? "default" : "secondary"} className="gap-2">
          {allCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {allCopied ? "Tudo copiado!" : "Copiar tudo"}
        </Button>
      </div>

      {/* Sections */}
      <TrainingSection
        icon={BookOpen}
        title="Produtos, Serviços e Preços"
        description="Tudo que a agente precisa saber sobre o Argos X e seus planos."
        content={PRODUCTS_TEXT}
        fieldHint="knowledge_products"
      />

      <TrainingSection
        icon={ShieldCheck}
        title="Regras e Restrições"
        description="O que a agente pode e não pode fazer durante o atendimento."
        content={RULES_TEXT}
        fieldHint="knowledge_rules"
      />

      <TrainingSection
        icon={Info}
        title="Contexto Adicional"
        description="Informações extras que ajudam a agente a entender o cenário."
        content={CONTEXT_TEXT}
        fieldHint="knowledge_extra"
      />

      <TrainingSection
        icon={HelpCircle}
        title="FAQ — Perguntas Frequentes"
        description={`${FAQ_DATA.length} perguntas e respostas prontas para a agente.`}
        content={FAQ_TEXT}
        fieldHint="knowledge_faq"
      />
    </div>
  );
}
