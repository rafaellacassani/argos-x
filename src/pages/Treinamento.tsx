import { useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Rocket,
  Smartphone,
  Users,
  MessageCircle,
  Bot,
  Workflow,
  Megaphone,
  BarChart3,
  Contact,
  Calendar,
  Settings,
  CreditCard,
  HelpCircle,
  Printer,
  ChevronDown,
  Lightbulb,
  Star,
  Shield,
  Clock,
  Zap,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ─── helpers ─── */
function TipCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 my-3">
      <Lightbulb className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-foreground/90">{children}</div>
    </div>
  );
}

function ReadyPhrase({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4 my-3">
      <Star className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
      <div className="text-sm font-medium text-foreground/90 italic">"{children}"</div>
    </div>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2 my-3 pl-1">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 items-start text-sm">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
            {i + 1}
          </span>
          <span className="text-foreground/80 pt-0.5">{s}</span>
        </li>
      ))}
    </ol>
  );
}

/* ─── section data ─── */
interface Section {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  title: string;
  content: React.ReactNode;
}

const trainingSections: Section[] = [
  {
    id: "pitch",
    icon: Rocket,
    iconColor: "text-orange-500",
    title: "O que é o Argos X? (Discurso de Elevador)",
    content: (
      <>
        <ReadyPhrase>
          O Argos X é como ter uma secretária inteligente no seu WhatsApp que nunca esquece de responder ninguém.
        </ReadyPhrase>
        <p className="text-sm text-muted-foreground mb-3">
          Use essa frase logo no início da conversa. É simples e todo mundo entende.
        </p>
        <h4 className="font-semibold text-sm mb-2">3 benefícios que o cliente entende na hora:</h4>
        <div className="grid gap-2 sm:grid-cols-3 mb-4">
          {[
            { icon: Clock, text: "Nunca mais perde cliente por demora na resposta" },
            { icon: Zap, text: "Organiza todos os clientes num painel visual" },
            { icon: Shield, text: "Sabe exatamente quanto cada vendedor está vendendo" },
          ].map((b, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-3 flex gap-2 items-start">
                <b.icon className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-xs text-foreground/80">{b.text}</span>
              </CardContent>
            </Card>
          ))}
        </div>
        <h4 className="font-semibold text-sm mb-2">Para quem serve?</h4>
        <div className="flex flex-wrap gap-2">
          {["Clínicas", "Imobiliárias", "Lojas", "Escritórios", "Consultórios", "Academias", "Salões de beleza", "Agências"].map((n) => (
            <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>
          ))}
        </div>
        <TipCard>
          Foque em negócios que já usam WhatsApp para vender mas não têm nenhum controle. São esses que mais sentem a dor.
        </TipCard>
      </>
    ),
  },
  {
    id: "whatsapp",
    icon: Smartphone,
    iconColor: "text-green-500",
    title: "Conectar o WhatsApp",
    content: (
      <>
        <p className="text-sm text-muted-foreground mb-2">
          A primeira coisa que o cliente quer ver funcionando. É rápido e simples.
        </p>
        <StepList steps={[
          "Acesse Integrações no menu lateral",
          "Clique em \"Conectar WhatsApp\"",
          "Um QR Code aparece na tela",
          "O cliente abre o WhatsApp no celular → Configurações → Aparelhos conectados → Conectar aparelho",
          "Escaneia o QR Code e pronto!",
        ]} />
        <TipCard>
          O WhatsApp do cliente continua funcionando normal no celular. Ele NÃO perde conversas, NÃO perde contatos. É como conectar o WhatsApp Web — funciona em paralelo.
        </TipCard>
        <ReadyPhrase>
          É igual ao WhatsApp Web. Você escaneia o QR Code e o Argos começa a receber as mensagens. Seu celular continua funcionando normal.
        </ReadyPhrase>
      </>
    ),
  },
  {
    id: "funil",
    icon: Users,
    iconColor: "text-blue-500",
    title: "Funil de Vendas (Leads)",
    content: (
      <>
        <ReadyPhrase>
          É como um quadro de post-its onde você arrasta cada cliente pela jornada de compra.
        </ReadyPhrase>
        <h4 className="font-semibold text-sm mb-2">Etapas do Funil:</h4>
        <div className="flex flex-wrap gap-2 mb-4">
          {["Novo", "Qualificado", "Proposta", "Negociação", "Fechado"].map((e, i) => (
            <div key={e} className="flex items-center gap-1">
              <Badge variant={i === 4 ? "default" : "outline"} className="text-xs">{e}</Badge>
              {i < 4 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
            </div>
          ))}
        </div>
        <h4 className="font-semibold text-sm mb-2">O que mostrar para o cliente:</h4>
        <ul className="space-y-1 text-sm text-foreground/80 list-disc pl-5">
          <li>Arrastar cards de um estágio para outro (visual Kanban)</li>
          <li>Criar um lead manualmente clicando no "+"</li>
          <li>Filtro "Minha Carteira" — cada vendedor vê só os clientes dele</li>
          <li>Alternar entre vista Kanban (quadro) e Lista (tabela)</li>
        </ul>
        <TipCard>
          Empresários adoram ver o quadro Kanban. Mostre arrastando um card de "Novo" para "Qualificado" — é visual e impactante.
        </TipCard>
      </>
    ),
  },
  {
    id: "chats",
    icon: MessageCircle,
    iconColor: "text-purple-500",
    title: "Chats Centralizado",
    content: (
      <>
        <ReadyPhrase>
          Todas as conversas do WhatsApp, Instagram e Facebook em um só lugar. Ninguém fica sem resposta.
        </ReadyPhrase>
        <h4 className="font-semibold text-sm mb-2">Funcionalidades principais:</h4>
        <ul className="space-y-1 text-sm text-foreground/80 list-disc pl-5 mb-3">
          <li>Responder mensagens direto do Argos</li>
          <li>Enviar áudio, imagem e documentos</li>
          <li>Agendar mensagem para enviar depois</li>
          <li>Ver o painel lateral do lead (histórico, tags, dados)</li>
          <li>Atribuir conversa para outro vendedor</li>
        </ul>
        <TipCard>
          Mostre como o vendedor vê TODAS as conversas numa lista única — ele não precisa ficar alternando entre WhatsApp, Instagram e Facebook.
        </TipCard>
      </>
    ),
  },
  {
    id: "ia",
    icon: Bot,
    iconColor: "text-cyan-500",
    title: "Agentes de IA",
    content: (
      <>
        <ReadyPhrase>
          Um robô que responde seus clientes automaticamente, 24 horas, como se fosse você.
        </ReadyPhrase>
        <h4 className="font-semibold text-sm mb-2">O que ele faz:</h4>
        <ul className="space-y-1 text-sm text-foreground/80 list-disc pl-5 mb-3">
          <li>Responde perguntas frequentes automaticamente</li>
          <li>Qualifica o lead (pergunta nome, interesse, orçamento)</li>
          <li>Move o lead para a etapa correta do funil</li>
          <li>Funciona 24h, inclusive de madrugada e fim de semana</li>
        </ul>
        <h4 className="font-semibold text-sm mb-2">Como criar:</h4>
        <StepList steps={[
          "Dê um nome para o agente (ex: \"Assistente da Clínica\")",
          "Escolha a personalidade (formal, descontraído, etc.)",
          "Adicione perguntas e respostas na base de conhecimento (FAQ)",
          "Ative e pronto — ele começa a responder sozinho",
        ]} />
        <TipCard>
          Esse é o recurso que mais impressiona. Diga ao cliente: "Imagina seu WhatsApp respondendo sozinho à 1 da manhã, qualificando cliente enquanto você dorme."
        </TipCard>
      </>
    ),
  },
  {
    id: "salesbots",
    icon: Workflow,
    iconColor: "text-amber-500",
    title: "SalesBots (Automações)",
    content: (
      <>
        <ReadyPhrase>
          Sequências automáticas de mensagens, tipo um funil no WhatsApp.
        </ReadyPhrase>
        <h4 className="font-semibold text-sm mb-2">Exemplo prático:</h4>
        <div className="rounded-lg border border-border/50 bg-muted/30 p-4 text-sm space-y-2 mb-3">
          <p>1. Cliente manda <strong>"oi"</strong></p>
          <p>2. Bot responde: <strong>"Olá! Sobre qual produto você tem interesse?"</strong></p>
          <p>3. Cliente responde o interesse</p>
          <p>4. Bot move o lead para a etapa "Qualificado" automaticamente</p>
        </div>
        <ul className="space-y-1 text-sm text-foreground/80 list-disc pl-5">
          <li>Templates prontos para começar rápido</li>
          <li>Editor visual de arrastar e soltar (sem programação)</li>
          <li>Pode incluir condições: "Se respondeu X, faz Y"</li>
        </ul>
      </>
    ),
  },
  {
    id: "campanhas",
    icon: Megaphone,
    iconColor: "text-rose-500",
    title: "Campanhas em Massa",
    content: (
      <>
        <ReadyPhrase>
          Enviar a mesma mensagem para vários clientes de uma vez, tipo um disparo.
        </ReadyPhrase>
        <ul className="space-y-1 text-sm text-foreground/80 list-disc pl-5 mb-3">
          <li>Selecione os contatos por etapa do funil, tags ou responsável</li>
          <li>Escreva a mensagem (pode incluir imagem e arquivo)</li>
          <li>Defina horário de envio e intervalo entre mensagens</li>
        </ul>
        <TipCard>
          Explique que NÃO é spam. O sistema envia com intervalos para não bloquear o número. Ideal para promoções, lembretes e reativação de clientes inativos.
        </TipCard>
      </>
    ),
  },
  {
    id: "dashboard",
    icon: BarChart3,
    iconColor: "text-emerald-500",
    title: "Dashboard e Estatísticas",
    content: (
      <>
        <ReadyPhrase>
          Você sabe exatamente quem tá vendendo mais e quem tá deixando cliente sem resposta.
        </ReadyPhrase>
        <h4 className="font-semibold text-sm mb-2">O que o empresário vê:</h4>
        <ul className="space-y-1 text-sm text-foreground/80 list-disc pl-5">
          <li>Total de mensagens recebidas e enviadas</li>
          <li>Leads novos por período</li>
          <li>Vendas fechadas e valores</li>
          <li>Ranking de desempenho da equipe</li>
          <li>Tempo médio de resposta de cada vendedor</li>
        </ul>
        <TipCard>
          Esse é o argumento que fecha com donos de empresa. Mostre que ele pode ver tudo pelo celular e cobrar a equipe com dados reais.
        </TipCard>
      </>
    ),
  },
  {
    id: "contatos",
    icon: Contact,
    iconColor: "text-teal-500",
    title: "Contatos",
    content: (
      <>
        <ul className="space-y-1 text-sm text-foreground/80 list-disc pl-5">
          <li>Importar contatos de planilha Excel/CSV</li>
          <li>Tags para organizar por categoria (ex: "Cliente VIP", "Lead frio")</li>
          <li>Histórico completo de conversas por contato</li>
        </ul>
      </>
    ),
  },
  {
    id: "calendario",
    icon: Calendar,
    iconColor: "text-indigo-500",
    title: "Calendário e Email",
    content: (
      <>
        <ul className="space-y-1 text-sm text-foreground/80 list-disc pl-5">
          <li>Integração com Google Calendar — eventos sincronizados</li>
          <li>Centralizar emails recebidos e enviados</li>
          <li>Agendar reuniões e associar a leads</li>
        </ul>
      </>
    ),
  },
  {
    id: "config",
    icon: Settings,
    iconColor: "text-gray-500",
    title: "Configurações Essenciais",
    content: (
      <>
        <h4 className="font-semibold text-sm mb-2">O que configurar primeiro:</h4>
        <StepList steps={[
          "Equipe — convidar vendedores por email e definir permissões",
          "Tags — criar categorias para organizar clientes",
          "Notificações — ativar alerta de cliente sem resposta",
        ]} />
        <TipCard>
          Na demo, mostre que o dono pode definir o que cada vendedor acessa. Isso é importante para empresas com equipe grande.
        </TipCard>
      </>
    ),
  },
  {
    id: "planos",
    icon: CreditCard,
    iconColor: "text-pink-500",
    title: "Planos e Preços",
    content: (
      <>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-semibold">Plano</th>
                <th className="text-center py-2 px-3 font-semibold">Essencial</th>
                <th className="text-center py-2 px-3 font-semibold">Negócio</th>
                <th className="text-center py-2 px-3 font-semibold">Escala</th>
              </tr>
            </thead>
            <tbody className="text-foreground/80">
              <tr className="border-b border-border/50">
                <td className="py-2 px-3">Preço</td>
                <td className="py-2 px-3 text-center font-bold">R$ 97/mês</td>
                <td className="py-2 px-3 text-center font-bold">R$ 297/mês</td>
                <td className="py-2 px-3 text-center font-bold">R$ 697/mês</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3">Leads</td>
                <td className="py-2 px-3 text-center">200</td>
                <td className="py-2 px-3 text-center">1.000</td>
                <td className="py-2 px-3 text-center">5.000</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3">Usuários</td>
                <td className="py-2 px-3 text-center">2</td>
                <td className="py-2 px-3 text-center">5</td>
                <td className="py-2 px-3 text-center">15</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3">WhatsApp</td>
                <td className="py-2 px-3 text-center">1</td>
                <td className="py-2 px-3 text-center">3</td>
                <td className="py-2 px-3 text-center">10</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 px-3">IA</td>
                <td className="py-2 px-3 text-center">✓</td>
                <td className="py-2 px-3 text-center">✓</td>
                <td className="py-2 px-3 text-center">✓</td>
              </tr>
              <tr>
                <td className="py-2 px-3">Campanhas</td>
                <td className="py-2 px-3 text-center">—</td>
                <td className="py-2 px-3 text-center">✓</td>
                <td className="py-2 px-3 text-center">✓</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Pacotes extras de leads disponíveis para todos os planos (a partir de R$ 47).
        </p>
        <h4 className="font-semibold text-sm mb-2">Como responder "É caro?"</h4>
        <ReadyPhrase>
          Quanto você perde por mês quando um cliente manda mensagem e ninguém responde? O Argos se paga no primeiro cliente que você não perde.
        </ReadyPhrase>
        <ReadyPhrase>
          É menos de R$ 3 por dia no plano Essencial. Custa menos que um cafezinho e resolve um problema que te custa milhares.
        </ReadyPhrase>
      </>
    ),
  },
];

/* ─── FAQ data ─── */
const faqItems = [
  { q: "Vou perder minhas conversas do WhatsApp?", a: "Não! O Argos se conecta ao seu WhatsApp como um aparelho adicional, igual ao WhatsApp Web. Suas conversas, contatos e grupos continuam normais no celular." },
  { q: "Funciona no celular?", a: "Sim! O Argos é 100% online, funciona no navegador do celular, tablet ou computador. Não precisa instalar nada." },
  { q: "Posso usar meu número pessoal?", a: "Pode, mas recomendamos usar um número comercial para separar as conversas pessoais das profissionais." },
  { q: "Meus funcionários vão ver minhas conversas pessoais?", a: "Não! Cada vendedor só vê as conversas dos clientes atribuídos a ele. O dono controla quem vê o quê." },
  { q: "E se eu cancelar, perco meus dados?", a: "Seus dados ficam guardados por 90 dias após o cancelamento. Você pode exportar seus contatos e conversas a qualquer momento." },
  { q: "Preciso de computador pra usar?", a: "Não é obrigatório. Funciona no celular. Mas recomendamos o computador pra quem tem muitas conversas, porque a tela maior facilita." },
  { q: "Quantas pessoas podem usar?", a: "Depende do plano: Essencial (2 usuários), Negócio (5 usuários), Escala (15 usuários). Cada pessoa tem seu login individual." },
  { q: "Tem contrato de fidelidade?", a: "Não! É mensal, sem fidelidade. Você pode cancelar quando quiser, sem multa." },
  { q: "Como funciona o robô de IA?", a: "Você ensina o robô com as perguntas e respostas mais comuns do seu negócio. Ele responde automaticamente usando linguagem natural, como se fosse uma pessoa de verdade." },
  { q: "O que acontece se eu atingir o limite de leads?", a: "Você pode comprar pacotes extras de leads a qualquer momento, ou fazer upgrade para um plano maior. Os leads existentes continuam normais." },
  { q: "Posso testar antes de pagar?", a: "Sim! Oferecemos um período de teste gratuito para você conhecer todas as funcionalidades antes de decidir." },
  { q: "Consigo disparar mensagens em massa?", a: "Sim, a funcionalidade de Campanhas permite enviar mensagens em massa com intervalos seguros entre cada envio, evitando bloqueio do número." },
  { q: "Integra com Instagram e Facebook?", a: "Sim! Você conecta suas páginas do Facebook e Instagram e todas as mensagens do Messenger e Direct aparecem no mesmo lugar que o WhatsApp." },
  { q: "É seguro? Meus dados ficam protegidos?", a: "Sim! Usamos criptografia de ponta e servidores seguros. Seus dados são protegidos e nunca são compartilhados com terceiros." },
  { q: "Quanto tempo leva pra configurar tudo?", a: "A configuração básica (conectar WhatsApp + criar funil) leva menos de 10 minutos. Com IA e automações, em 30 minutos tá tudo rodando." },
];

/* ─── page ─── */
export default function Treinamento() {
  return (
    <>
      <Helmet>
        <title>Treinamento | Argos X</title>
        <meta name="description" content="Guia de treinamento para vendedoras do Argos X" />
      </Helmet>

      <div className="max-w-4xl mx-auto space-y-8 print:space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Rocket className="w-6 h-6 text-primary" />
              Treinamento de Vendas
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Guia completo para apresentar o Argos X para qualquer empresário.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="print:hidden self-start"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir / PDF
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="roteiro" className="print:hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="roteiro">📋 Roteiro de Demonstração</TabsTrigger>
            <TabsTrigger value="faq">❓ Perguntas Frequentes</TabsTrigger>
          </TabsList>

          <TabsContent value="roteiro" className="mt-6">
            <Accordion type="single" collapsible className="space-y-3">
              {trainingSections.map((section, idx) => (
                <AccordionItem
                  key={section.id}
                  value={section.id}
                  className="border border-border/50 rounded-lg px-4 data-[state=open]:bg-muted/20"
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3 text-left">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                        <section.icon className={`w-4 h-4 ${section.iconColor}`} />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground font-medium">Passo {idx + 1}</span>
                        <p className="font-semibold text-sm">{section.title}</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-0">
                    {section.content}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>

          <TabsContent value="faq" className="mt-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-primary" />
                Dúvidas que os Clientes Fazem
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Respostas prontas para você usar na hora da venda.
              </p>
            </div>
            <Accordion type="single" collapsible className="space-y-2">
              {faqItems.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="border border-border/50 rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline py-3 text-sm font-medium text-left">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 pt-0">
                    <div className="flex gap-3 items-start">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-foreground/80">{item.a}</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>
        </Tabs>

        {/* Print-only: show everything */}
        <div className="hidden print:block space-y-6">
          <h2 className="text-lg font-bold">Roteiro de Demonstração</h2>
          {trainingSections.map((section, idx) => (
            <div key={section.id} className="break-inside-avoid">
              <h3 className="font-bold text-sm mb-2">Passo {idx + 1} — {section.title}</h3>
              {section.content}
            </div>
          ))}
          <h2 className="text-lg font-bold mt-8">Perguntas Frequentes dos Clientes</h2>
          {faqItems.map((item, i) => (
            <div key={i} className="mb-3 break-inside-avoid">
              <p className="font-semibold text-sm">{item.q}</p>
              <p className="text-sm text-gray-600">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
