import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Download, Sparkles, Target, TrendingUp, Layers, RectangleHorizontal, Smartphone, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";

import feed1 from "@/assets/campanhas/feed/01-dorme-vende.jpg";
import story1 from "@/assets/campanhas/stories/01-dorme-vende.jpg";
import feed2 from "@/assets/campanhas/feed/02-caos-controle.jpg";
import story2 from "@/assets/campanhas/stories/02-caos-controle.jpg";
import feed3 from "@/assets/campanhas/feed/03-ia-responde.jpg";
import story3 from "@/assets/campanhas/stories/03-ia-responde.jpg";
import feed4 from "@/assets/campanhas/feed/04-leads-perdidos.jpg";
import story4 from "@/assets/campanhas/stories/04-leads-perdidos.jpg";
import feed5 from "@/assets/campanhas/feed/05-um-painel.jpg";
import story5 from "@/assets/campanhas/stories/05-um-painel.jpg";
import feed6 from "@/assets/campanhas/feed/06-followup.jpg";
import story6 from "@/assets/campanhas/stories/06-followup.jpg";
import feed7 from "@/assets/campanhas/feed/07-leads-perdidos-noite.jpg";
import story7 from "@/assets/campanhas/stories/07-leads-perdidos-noite.jpg";
import feed8 from "@/assets/campanhas/feed/08-concorrente-automatizou.jpg";
import story8 from "@/assets/campanhas/stories/08-concorrente-automatizou.jpg";
import feed9 from "@/assets/campanhas/feed/09-vende-dormindo.jpg";
import story9 from "@/assets/campanhas/stories/09-vende-dormindo.jpg";

type Campanha = {
  id: number;
  imagens: {
    feed: { src: string; file: string };
    stories: { src: string; file: string };
  };
  conceito: string;
  publico: string;
  objetivo: string;
  headline: string;
  textoPrincipal: string;
  titulo: string;
  descricao: string;
  cta: string;
};

const campanhas: Campanha[] = [
  {
    id: 1,
    imagens: {
      feed: { src: feed1, file: "feed-01-dorme-vende.jpg" },
      stories: { src: story1, file: "stories-01-dorme-vende.jpg" },
    },
    conceito: "Vendas 24/7 — Automação como liberdade",
    publico: "Donos de negócio cansados de responder WhatsApp de madrugada",
    objetivo: "Mensagens / Conversões",
    headline: "Enquanto você dorme, seu CRM vende.",
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
    cta: "CADASTRE_SE",
  },
  {
    id: 2,
    imagens: {
      feed: { src: feed2, file: "feed-02-caos-controle.jpg" },
      stories: { src: story2, file: "stories-02-caos-controle.jpg" },
    },
    conceito: "Transformação — antes vs depois",
    publico: "Empresas usando planilha, papel ou Trello pra gerenciar clientes",
    objetivo: "Tráfego / Cadastros",
    headline: "Do caos ao controle.",
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
    cta: "SAIBA_MAIS",
  },
  {
    id: 3,
    imagens: {
      feed: { src: feed3, file: "feed-03-ia-responde.jpg" },
      stories: { src: story3, file: "stories-03-ia-responde.jpg" },
    },
    conceito: "IA como vendedora — alívio operacional",
    publico: "Donos que respondem WhatsApp o dia inteiro e não conseguem crescer",
    objetivo: "Conversões / Mensagens",
    headline: "Sua IA responde. Você fecha.",
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
    cta: "OBTER_OFERTA",
  },
  {
    id: 4,
    imagens: {
      feed: { src: feed4, file: "feed-04-leads-perdidos.jpg" },
      stories: { src: story4, file: "stories-04-leads-perdidos.jpg" },
    },
    conceito: "Dor financeira — quanto você perde",
    publico: "Empresas com volume de leads que não sabem mensurar perda",
    objetivo: "Tráfego / Reflexão e cadastro",
    headline: "Quantos leads você perdeu hoje?",
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
    cta: "SAIBA_MAIS",
  },
  {
    id: 5,
    imagens: {
      feed: { src: feed5, file: "feed-05-um-painel.jpg" },
      stories: { src: story5, file: "stories-05-um-painel.jpg" },
    },
    conceito: "All-in-one — fim das ferramentas múltiplas",
    publico: "Quem usa 4-5 ferramentas separadas (RD, Pipedrive, Calendly, Disparador)",
    objetivo: "Conversões / Cadastros premium",
    headline: "1 painel. Tudo que você precisa.",
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
    cta: "OBTER_OFERTA",
  },
  {
    id: 6,
    imagens: {
      feed: { src: feed6, file: "feed-06-followup.jpg" },
      stories: { src: story6, file: "stories-06-followup.jpg" },
    },
    conceito: "Follow-up automático — recuperar leads frios",
    publico: "Equipes comerciais com leads que esfriam por falta de cadência",
    objetivo: "Conversões / Demonstração",
    headline: "Lead frio? A IA esquenta.",
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
    cta: "AGENDAR",
  },
];

function AssetPreview({ src, label, ratio }: { src: string; label: string; ratio: "square" | "stories" }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {ratio === "square" ? <RectangleHorizontal className="h-4 w-4 text-muted-foreground" /> : <Smartphone className="h-4 w-4 text-muted-foreground" />}
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-muted/30 shadow-sm">
        <img
          src={src}
          alt={label}
          className={`w-full object-cover ${ratio === "square" ? "aspect-square" : "aspect-[9/16]"}`}
          loading="lazy"
          width={ratio === "square" ? 1080 : 768}
          height={ratio === "square" ? 1080 : 1376}
        />
      </div>
    </div>
  );
}

function CampaignCard({ campanha }: { campanha: Campanha }) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copiado!");
    setTimeout(() => setCopiedField(null), 1500);
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  };

  return (
    <Card className="overflow-hidden border border-border shadow-sm transition-all duration-300 hover:shadow-xl">
      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-0">
        <div className="border-b xl:border-b-0 xl:border-r border-border bg-muted/20 p-5 lg:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
              Campanha #{String(campanha.id).padStart(2, "0")}
            </Badge>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              Feed + Stories
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <AssetPreview src={campanha.imagens.feed.src} label="Feed 1080×1080" ratio="square" />
            <AssetPreview src={campanha.imagens.stories.src} label="Stories 1080×1920" ratio="stories" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => downloadImage(campanha.imagens.feed.src, campanha.imagens.feed.file)}>
              <Download className="h-4 w-4 mr-2" />
              Baixar Feed
            </Button>
            <Button size="sm" variant="secondary" onClick={() => downloadImage(campanha.imagens.stories.src, campanha.imagens.stories.file)}>
              <Download className="h-4 w-4 mr-2" />
              Baixar Stories
            </Button>
          </div>
        </div>

        <div className="bg-card p-6 lg:p-8 space-y-5">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="uppercase tracking-wider">{campanha.conceito}</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-display font-extrabold text-foreground leading-tight">
              {campanha.headline}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <Target className="h-3.5 w-3.5" /> Público
              </div>
              <p className="font-medium text-foreground leading-snug">{campanha.publico}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center gap-1 text-muted-foreground mb-1">
                <TrendingUp className="h-3.5 w-3.5" /> Objetivo
              </div>
              <p className="font-medium text-foreground leading-snug">{campanha.objetivo}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Texto principal (Meta)</label>
              <Button variant="ghost" size="sm" onClick={() => copy(campanha.textoPrincipal, `texto-${campanha.id}`)} className="h-7 px-2">
                {copiedField === `texto-${campanha.id}` ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <div className="max-h-52 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground whitespace-pre-line">
              {campanha.textoPrincipal}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Título</label>
                <Button variant="ghost" size="sm" onClick={() => copy(campanha.titulo, `titulo-${campanha.id}`)} className="h-7 px-2">
                  {copiedField === `titulo-${campanha.id}` ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm font-semibold text-foreground">{campanha.titulo}</div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</label>
                <Button variant="ghost" size="sm" onClick={() => copy(campanha.descricao, `desc-${campanha.id}`)} className="h-7 px-2">
                  {copiedField === `desc-${campanha.id}` ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">{campanha.descricao}</div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Botão de chamada (CTA Meta)</label>
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
  const copyAll = async () => {
    const all = campanhas
      .map(
        (c) => `═══════════════════════════════
CAMPANHA ${c.id} — ${c.conceito}
═══════════════════════════════
HEADLINE: ${c.headline}
PÚBLICO: ${c.publico}
OBJETIVO: ${c.objetivo}
CTA: ${c.cta}
ARQUIVOS: ${c.imagens.feed.file} | ${c.imagens.stories.file}

📝 TEXTO PRINCIPAL:
${c.textoPrincipal}

🎯 TÍTULO:
${c.titulo}

📄 DESCRIÇÃO:
${c.descricao}`,
      )
      .join("\n\n");

    await navigator.clipboard.writeText(all);
    toast.success("Todas as campanhas copiadas!");
  };

  return (
    <>
      <Helmet>
        <title>Campanhas Meta Ads — Argos X</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="bg-gradient-to-br from-inboxia-navy via-primary to-inboxia-blue text-primary-foreground">
          <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary-foreground/80" />
              <span className="text-sm uppercase tracking-widest text-primary-foreground/80 font-semibold">Kit de Campanhas Meta Ads</span>
            </div>
            <h1 className="text-4xl lg:text-6xl font-display font-extrabold mb-4 leading-tight text-primary-foreground">
              6 campanhas refinadas<br />em Feed + Stories
            </h1>
            <p className="text-lg lg:text-xl text-primary-foreground/85 max-w-3xl mb-8">
              Criativos sem logo embarcado, com composição mais forte, melhor hierarquia e versão pronta para os 2 formatos que mais performam na Meta.
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <Button size="lg" onClick={copyAll} variant="secondary" className="font-semibold">
                <Copy className="h-4 w-4 mr-2" />
                Copiar todos os textos
              </Button>
              <div className="flex flex-wrap items-center gap-5 text-sm text-primary-foreground/85">
                <div><strong className="text-primary-foreground text-2xl font-display">12</strong> artes</div>
                <div><strong className="text-primary-foreground text-2xl font-display">6</strong> campanhas</div>
                <div><strong className="text-primary-foreground text-2xl font-display">2</strong> formatos por campanha</div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
          {campanhas.map((c) => (
            <CampaignCard key={c.id} campanha={c} />
          ))}
        </div>

        <div className="border-t border-border bg-muted/20">
          <div className="max-w-7xl mx-auto px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">Página interna · não indexada · versão otimizada para Meta Feed e Stories</p>
          </div>
        </div>
      </div>
    </>
  );
}
