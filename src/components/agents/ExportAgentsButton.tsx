import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/hooks/use-toast";
import { downloadTextFile, formatDateTimeBR, sanitizeFilename } from "@/lib/exportUtils";

const SEP = "═══════════════════════════════════════════════════════════════";
const SUB = "───────────────────────────────────────────────────────────────";

function renderBlock(title: string, value: any): string {
  const out: string[] = [];
  out.push(`▸ ${title}`);
  if (value === null || value === undefined || value === "") {
    out.push("  (não definido)");
    return out.join("\n");
  }
  if (typeof value === "string") {
    value.split("\n").forEach(line => out.push(`  ${line}`));
    return out.join("\n");
  }
  if (typeof value === "boolean") {
    out.push(`  ${value ? "Sim" : "Não"}`);
    return out.join("\n");
  }
  if (typeof value === "number") {
    out.push(`  ${value}`);
    return out.join("\n");
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.push("  (vazio)");
      return out.join("\n");
    }
    value.forEach((item, idx) => {
      if (typeof item === "object") {
        out.push(`  ${idx + 1}. ${JSON.stringify(item, null, 2).split("\n").join("\n     ")}`);
      } else {
        out.push(`  ${idx + 1}. ${item}`);
      }
    });
    return out.join("\n");
  }
  // object
  const entries = Object.entries(value);
  if (entries.length === 0) {
    out.push("  (vazio)");
    return out.join("\n");
  }
  entries.forEach(([k, v]) => {
    out.push(`  • ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  });
  return out.join("\n");
}

export function ExportAgentsButton() {
  const { workspaceId, workspace } = useWorkspace();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { data: agents, error } = await supabase
        .from("ai_agents")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!agents || agents.length === 0) {
        toast({ title: "Nenhum agente encontrado" });
        setLoading(false);
        return;
      }

      const wsName = workspace?.name || "Workspace";
      const header = [
        SEP,
        `  EXPORTAÇÃO COMPLETA DE AGENTES DE IA — ${wsName}`,
        `  Total de agentes: ${agents.length}`,
        `  Gerado em: ${formatDateTimeBR(new Date())}`,
        SEP,
        "",
      ].join("\n");

      const blocks: string[] = [];
      agents.forEach((a: any, idx) => {
        blocks.push("");
        blocks.push(SEP);
        blocks.push(`  AGENTE ${idx + 1} de ${agents.length}: ${a.name}`);
        blocks.push(`  ID: ${a.id}`);
        blocks.push(`  Status: ${a.is_active ? "ATIVO" : "INATIVO"}`);
        blocks.push(`  Tipo: ${a.type}`);
        blocks.push(`  Criado em: ${formatDateTimeBR(a.created_at)}`);
        blocks.push(`  Atualizado em: ${formatDateTimeBR(a.updated_at)}`);
        blocks.push(SEP);
        blocks.push("");

        blocks.push(SUB);
        blocks.push("  IDENTIDADE & PERSONALIDADE");
        blocks.push(SUB);
        blocks.push(renderBlock("Nome", a.name));
        blocks.push(renderBlock("Descrição", a.description));
        blocks.push(renderBlock("Cargo/Papel", a.agent_role));
        blocks.push(renderBlock("Tom de voz", a.tone_of_voice));
        blocks.push(renderBlock("Usa emojis", a.use_emojis));
        blocks.push(renderBlock("Objetivo principal", a.main_objective));
        blocks.push(renderBlock("Nicho", a.niche));
        blocks.push("");

        blocks.push(SUB);
        blocks.push("  EMPRESA");
        blocks.push(SUB);
        blocks.push(renderBlock("Informações da empresa", a.company_info));
        blocks.push("");

        blocks.push(SUB);
        blocks.push("  BASE DE CONHECIMENTO");
        blocks.push(SUB);
        blocks.push(renderBlock("Produtos/Serviços/Preços", a.knowledge_products));
        blocks.push(renderBlock("Regras", a.knowledge_rules));
        blocks.push(renderBlock("Conhecimento extra", a.knowledge_extra));
        blocks.push(renderBlock("FAQ", a.knowledge_faq));
        blocks.push("");

        blocks.push(SUB);
        blocks.push("  SITE & ESTILO");
        blocks.push(SUB);
        blocks.push(renderBlock("URL do site", a.website_url));
        blocks.push(renderBlock("Site sincronizado em", a.website_scraped_at ? formatDateTimeBR(a.website_scraped_at) : null));
        blocks.push(renderBlock("Conteúdo do site (preview)", (a.website_content || "").slice(0, 2000) + (a.website_content?.length > 2000 ? "\n[...truncado...]" : "")));
        blocks.push(renderBlock("Análise de estilo", a.style_analysis));
        blocks.push(renderBlock("Telefone do treinador", a.trainer_phone));
        blocks.push("");

        blocks.push(SUB);
        blocks.push("  COMPORTAMENTO");
        blocks.push(SUB);
        blocks.push(renderBlock("Responder a", a.respond_to));
        blocks.push(renderBlock("Etapas que responde", a.respond_to_stages));
        blocks.push(renderBlock("Delay de resposta (s)", a.response_delay_seconds));
        blocks.push(renderBlock("Tamanho da resposta", a.response_length));
        blocks.push(renderBlock("Instância vinculada", a.instance_name));
        blocks.push(renderBlock("Código de pausa", a.pause_code));
        blocks.push(renderBlock("Palavra de retomada", a.resume_keyword));
        blocks.push(renderBlock("Quebra de mensagem ativa", a.message_split_enabled));
        blocks.push(renderBlock("Tamanho da quebra", a.message_split_length));
        blocks.push(renderBlock("Apenas janela 24h (Cloud)", a.cloud_24h_window_only));
        blocks.push(renderBlock("Handoff de mídia", a.media_handoff_enabled));
        blocks.push(renderBlock("Máx. mensagens improdutivas", a.max_unproductive_messages));
        blocks.push("");

        blocks.push(SUB);
        blocks.push("  QUALIFICAÇÃO");
        blocks.push(SUB);
        blocks.push(renderBlock("Qualificação ativa", a.qualification_enabled));
        blocks.push(renderBlock("Campos de qualificação", a.qualification_fields));
        blocks.push("");

        blocks.push(SUB);
        blocks.push("  FERRAMENTAS & AÇÕES");
        blocks.push(SUB);
        blocks.push(renderBlock("Ferramentas habilitadas", a.tools));
        blocks.push(renderBlock("Ações ao iniciar atendimento", a.on_start_actions));
        blocks.push(renderBlock("Configuração de calendário", a.calendar_config));
        blocks.push("");

        blocks.push(SUB);
        blocks.push("  FOLLOW-UP");
        blocks.push(SUB);
        blocks.push(renderBlock("Follow-up ativo", a.followup_enabled));
        blocks.push(renderBlock("Sequência de follow-up", a.followup_sequence));
        blocks.push(renderBlock("Etapa de encerramento", a.followup_end_stage_id));
        blocks.push("");

        blocks.push(SUB);
        blocks.push("  AVANÇADO (MODELO IA)");
        blocks.push(SUB);
        blocks.push(renderBlock("Modelo", a.model));
        blocks.push(renderBlock("Temperatura", a.temperature));
        blocks.push(renderBlock("Máx. tokens", a.max_tokens));
        blocks.push(renderBlock("Configuração de fallback", a.fallback_config));
        blocks.push(renderBlock("Configuração de gatilho", a.trigger_config));
        blocks.push("");

        blocks.push(SUB);
        blocks.push("  PROMPT DO SISTEMA (gerado)");
        blocks.push(SUB);
        blocks.push(a.system_prompt || "(vazio)");
        blocks.push("");
      });

      const finalText = header + blocks.join("\n");
      const filename = `agentes_ia_${sanitizeFilename(wsName)}_${new Date().toISOString().split("T")[0]}.txt`;
      downloadTextFile(filename, finalText);

      toast({ title: "Exportação concluída", description: `${agents.length} agentes exportados.` });
    } catch (err: any) {
      console.error("[ExportAgents] error:", err);
      toast({ title: "Erro ao exportar", description: err.message || "Falha desconhecida", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading} className="gap-2">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      Exportar Agentes
    </Button>
  );
}
