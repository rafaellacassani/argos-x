import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Download, Sparkles, Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import img1 from "@/assets/campanhas/campanha-01-dorme-vende.jpg";
import img2 from "@/assets/campanhas/campanha-02-caos-controle.jpg";
import img3 from "@/assets/campanhas/campanha-03-ia-responde.jpg";
import img4 from "@/assets/campanhas/campanha-04-leads-perdidos.jpg";
import img5 from "@/assets/campanhas/campanha-05-um-painel.jpg";
import img6 from "@/assets/campanhas/campanha-06-followup.jpg";

type Campanha = {
  id: number;
  imagem: string;
  imagemFile: string;
  conceito: string;
  publico: string;
  objetivo: string;
  headline: string;
  textoPrincipal: string;
  titulo: string;
  descricao: string;
  cta: string;
  cor: string;
};

const CTAs_META = [
  "SAIBA_MAIS", "CADASTRE_SE", "OBTER_OFERTA", "INSCREVA_SE",
  "AGENDAR", "ENVIAR_MENSAGEM", "SOLICITAR_TEMPO", "ASSISTIR_MAIS"
];

const campanhas: Campanha[] = [
  {
    id: 1,
    imagem: img1,
    imagemFile: "campanha-01-dorme-vende.jpg",
    conceito: "Vendas 24/7 — Automação como liberdade",
    publico: "Donos de negócio cansados de responder WhatsApp de madrugada",
    objetivo: "Mensagens / Conversões",
    headline: "Enquanto você dorme, seu CRM vende.",
    cor: "from-indigo-900 to-blue-600",
    textoPrincipal: `Você já perdeu uma venda porque demorou pra responder?

Enquanto você tava jantando, dormindo ou com a família… 3 clientes te chamaram no WhatsApp. E foram pro concorrente.

O Argos X é o único CRM brasileiro com IA que responde, qualifica e agenda reuniões 24h por dia — direto no seu WhatsApp.

✅ Atende em segundos, com a sua voz
✅ Qualifica antes de te passar o lead quente
✅ Agenda reuniões direto na sua agenda
✅ Funciona até quando você tá dormindo

Mais de 2.000 empresas brasileiras já recuperaram vendas que perdiam todo dia.

👉 Teste 7 dias grátis. Sem cartão.`,
    titulo: "O CRM que vende enquanto você dorme",
    descricao: "WhatsApp + IA + CRM em 1 só lugar. Teste grátis 7 dias.",
    cta: "CADASTRE_SE"
  },
  {
    id: 2,
    imagem: img2,
    imagemFile: "campanha-02-caos-controle.jpg",
    conceito: "Transformação — antes vs depois",
    publico: "Empresas usando planilha, papel ou Trello pra gerenciar clientes",
    objetivo: "Tráfego / Cadastros",
    headline: "Do caos ao controle.",
    cor: "from-slate-700 to-blue-700",
    textoPrincipal: `Planilha do Excel.
Post-it na parede.
Conversa esquecida no WhatsApp.
Lead perdido no e-mail.

Reconhece? A maioria dos negócios perde 40% das vendas porque nada está num lugar só.

Com o Argos X, todo cliente entra num funil visual, recebe atendimento automático, follow-up inteligente e nada — NADA — escapa.

🎯 Kanban com seus leads em tempo real
🤖 IA que conversa pelo WhatsApp
📅 Agenda integrada
📊 Dashboard com tudo que importa
💰 A partir de R$ 47/mês

Pare de perder cliente por desorganização. Comece hoje.`,
    titulo: "Organize seu negócio em 5 minutos",
    descricao: "WhatsApp, leads, agenda e IA num só painel. Comece grátis.",
    cta: "SAIBA_MAIS"
  },
  {
    id: 3,
    imagem: img3,
    imagemFile: "campanha-03-ia-responde.jpg",
    conceito: "IA como vendedora — alívio operacional",
    publico: "Donos que respondem WhatsApp o dia inteiro e não conseguem crescer",
    objetivo: "Conversões / Mensagens",
    headline: "Sua IA responde. Você fecha.",
    cor: "from-cyan-700 to-blue-900",
    textoPrincipal: `"Qual o preço?"
"Tem em estoque?"
"Posso parcelar?"
"Faz entrega?"

Você responde isso 50 vezes por dia, né?

Para. Respira. Deixa a IA do Argos X fazer isso por você.

Ela aprende sobre o seu negócio, responde no seu tom, qualifica o lead e SÓ te chama quando o cliente tá pronto pra fechar.

⚡ Ativação em 5 minutos
🧠 Treina com o seu conteúdo
💬 Conversa 100% humana
🎯 Te passa só lead quente

Você foi feito pra vender, não pra digitar respostas o dia todo.`,
    titulo: "Pare de responder WhatsApp manualmente",
    descricao: "IA treinada no seu negócio responde por você 24h. Teste grátis.",
    cta: "OBTER_OFERTA"
  },
  {
    id: 4,
    imagem: img4,
    imagemFile: "campanha-04-leads-perdidos.jpg",
    conceito: "Dor financeira — quanto você perde",
    publico: "Empresas com volume de leads que não sabem mensurar perda",
    objetivo: "Tráfego / Reflexão e cadastro",
    headline: "Quantos leads você perdeu hoje?",
    cor: "from-red-900 via-blue-900 to-blue-600",
    textoPrincipal: `Você investe em tráfego.
Investe em equipe.
Investe em estoque.

E perde lead todo santo dia porque:
❌ Demorou pra responder
❌ Esqueceu de fazer follow-up
❌ Não sabe em qual etapa o cliente parou
❌ Vendedor saiu e levou os contatos

A conta é dolorosa: a média do mercado perde R$ 47.000 por mês em vendas que estavam praticamente fechadas.

O Argos X recupera isso. Com IA, follow-up automático e funil visual onde NADA cai no esquecimento.

💡 Faça as contas: quanto custa NÃO ter Argos X?

Teste 7 dias. Sem cartão. Sem enrolação.`,
    titulo: "Calcule quanto você perde sem CRM",
    descricao: "A média de empresas perde R$ 47k/mês em leads esquecidos. Recupere.",
    cta: "SAIBA_MAIS"
  },
  {
    id: 5,
    imagem: img5,
    imagemFile: "campanha-05-um-painel.jpg",
    conceito: "All-in-one — fim das ferramentas múltiplas",
    publico: "Quem usa 4-5 ferramentas separadas (RD, Pipedrive, Calendly, Disparador)",
    objetivo: "Conversões / Cadastros premium",
    headline: "1 painel. Tudo que você precisa.",
    cor: "from-blue-900 to-indigo-700",
    textoPrincipal: `Quanto você paga hoje?

🔻 RD Station — R$ 1.200/mês
🔻 Calendly — R$ 80/mês
🔻 Disparador WhatsApp — R$ 300/mês
🔻 ChatGPT Plus pra IA — R$ 100/mês
🔻 Planilha + Trello + caos mental: incalculável

Total: mais de R$ 1.700/mês. E nada conversa entre si.

O Argos X faz TUDO isso. Num painel só. A partir de R$ 47/mês.

✨ WhatsApp oficial integrado
✨ IA própria treinada no seu negócio
✨ CRM visual em Kanban
✨ Agenda + Calendly nativos
✨ Campanhas em massa
✨ Suporte humano em português

Cancele tudo. Use Argos X.`,
    titulo: "Substitua 5 ferramentas por R$ 47/mês",
    descricao: "WhatsApp + CRM + IA + Agenda + Campanhas. Tudo num lugar só.",
    cta: "OBTER_OFERTA"
  },
  {
    id: 6,
    imagem: img6,
    imagemFile: "campanha-06-followup.jpg",
    conceito: "Follow-up automático — recuperar leads frios",
    publico: "Equipes comerciais com leads que esfriam por falta de cadência",
    objetivo: "Conversões / Demonstração",
    headline: "Lead frio? A IA esquenta.",
    cor: "from-blue-800 to-cyan-500",
    textoPrincipal: `80% das vendas acontecem entre o 5º e o 12º contato.

Mas 90% dos vendedores desistem no 2º.

O Argos X resolve isso de um jeito que ninguém mais resolve no Brasil:

🔥 Follow-up automático em 5 toques inteligentes
🔥 IA escreve cada mensagem com base no comportamento do lead
🔥 Para na hora que o cliente responde
🔥 Reaviva quem sumiu há 30, 60, 90 dias

Lead que tava morto, voltou a conversar. Lead que tava frio, virou venda.

Sem você precisar lembrar. Sem planilha. Sem CRM gringo caro.

Quer ver funcionando no seu negócio?`,
    titulo: "Recupere leads que você dava por perdidos",
    descricao: "IA faz follow-up automático em 5 toques. Reativa quem sumiu.",
    cta: "AGENDAR"
  }
];

function CampaignCard({ campanha }: { campanha: Campanha }) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copiado!");
    setTimeout(() => setCopiedField(null), 1500);
  };

  const downloadImage = () => {
    const link = document.createElement("a");
    link.href = campanha.imagem;
    link.download = campanha.imagemFile;
    link.click();
  };

  return (
    <Card className="overflow-hidden border-2 hover:shadow-2xl transition-all duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Imagem */}
        <div className="relative bg-muted">
          <img
            src={campanha.imagem}
            alt={campanha.headline}
            className="w-full h-full object-cover aspect-square"
            loading="lazy"
            width={1080}
            height={1080}
          />
          <div className="absolute top-4 left-4">
            <Badge className={`bg-gradient-to-r ${campanha.cor} text-white border-0 shadow-lg`}>
              Campanha #{String(campanha.id).padStart(2, "0")}
            </Badge>
          </div>
          <Button
            onClick={downloadImage}
            size="sm"
            className="absolute bottom-4 right-4 shadow-lg"
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar imagem
          </Button>
        </div>

        {/* Copy */}
        <div className="p-6 lg:p-8 space-y-5 bg-card">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Sparkles className="h-3 w-3" />
              <span className="uppercase tracking-wider">{campanha.conceito}</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-display font-extrabold text-foreground leading-tight">
              {campanha.headline}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <Target className="h-3 w-3" /> Público
              </div>
              <p className="font-medium text-foreground leading-snug">{campanha.publico}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <TrendingUp className="h-3 w-3" /> Objetivo
              </div>
              <p className="font-medium text-foreground leading-snug">{campanha.objetivo}</p>
            </div>
          </div>

          {/* Texto Principal */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Texto Principal (Meta)
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(campanha.textoPrincipal, `texto-${campanha.id}`)}
                className="h-7 px-2"
              >
                {copiedField === `texto-${campanha.id}` ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            <div className="bg-muted/30 border border-border rounded-lg p-3 text-sm text-foreground whitespace-pre-line max-h-48 overflow-y-auto">
              {campanha.textoPrincipal}
            </div>
          </div>

          {/* Título */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Título
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(campanha.titulo, `titulo-${campanha.id}`)}
                className="h-7 px-2"
              >
                {copiedField === `titulo-${campanha.id}` ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            <div className="bg-muted/30 border border-border rounded-lg p-3 text-sm font-semibold text-foreground">
              {campanha.titulo}
            </div>
          </div>

          {/* Descrição */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Descrição
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(campanha.descricao, `desc-${campanha.id}`)}
                className="h-7 px-2"
              >
                {copiedField === `desc-${campanha.id}` ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            <div className="bg-muted/30 border border-border rounded-lg p-3 text-sm text-foreground">
              {campanha.descricao}
            </div>
          </div>

          {/* CTA */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Botão de chamada (CTA Meta)
            </label>
            <Badge variant="secondary" className="text-sm py-1.5 px-3 font-mono">
              {campanha.cta.replace(/_/g, " ")}
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function Campanhas() {
  const copyAll = () => {
    const all = campanhas.map(c =>
      `═══════════════════════════════
CAMPANHA ${c.id} — ${c.conceito}
═══════════════════════════════
HEADLINE: ${c.headline}
PÚBLICO: ${c.publico}
OBJETIVO: ${c.objetivo}
CTA: ${c.cta}

📝 TEXTO PRINCIPAL:
${c.textoPrincipal}

🎯 TÍTULO:
${c.titulo}

📄 DESCRIÇÃO:
${c.descricao}
`).join("\n\n");
    navigator.clipboard.writeText(all);
    toast.success("Todas as campanhas copiadas!");
  };

  return (
    <>
      <Helmet>
        <title>Campanhas Meta Ads — Argos X</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Hero */}
        <div className="bg-gradient-to-br from-inboxia-navy via-primary to-inboxia-blue text-white">
          <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-cyan-300" />
              <span className="text-sm uppercase tracking-widest text-cyan-200 font-semibold">
                Kit de Campanhas Meta Ads
              </span>
            </div>
            <h1 className="text-4xl lg:text-6xl font-display font-extrabold mb-4 leading-tight">
              6 campanhas prontas<br />pra escalar o Argos X
            </h1>
            <p className="text-lg lg:text-xl text-blue-100 max-w-2xl mb-8">
              Criativos visuais + copy completo (texto principal, título, descrição e CTA).
              Pronto pra colar no Gerenciador de Anúncios da Meta.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={copyAll}
                className="bg-white text-primary hover:bg-blue-50 font-semibold"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar todos os textos
              </Button>
              <div className="flex items-center gap-6 text-sm text-blue-100 ml-2">
                <div><strong className="text-white text-2xl font-display">6</strong> criativos</div>
                <div><strong className="text-white text-2xl font-display">1080×1080</strong> px</div>
                <div><strong className="text-white text-2xl font-display">100%</strong> editáveis</div>
              </div>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
          {campanhas.map((c) => (
            <CampaignCard key={c.id} campanha={c} />
          ))}
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/30">
          <div className="max-w-7xl mx-auto px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Página interna · não indexada · Argos X by Mkt Boost
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
