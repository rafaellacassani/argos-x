import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useWhatsAppTemplates, WhatsAppTemplate } from "@/hooks/useWhatsAppTemplates";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, FileText, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface CloudConnection {
  id: string;
  inbox_name: string;
  phone_number: string;
  waba_id: string;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "APPROVED":
      return <Badge className="bg-green-500/15 text-green-600 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Aprovado</Badge>;
    case "REJECTED":
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejeitado</Badge>;
    case "PENDING":
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
    default:
      return <Badge variant="outline"><AlertTriangle className="w-3 h-3 mr-1" />{status}</Badge>;
  }
}

function getCategoryLabel(category: string) {
  const map: Record<string, string> = {
    MARKETING: "Marketing",
    UTILITY: "Utilidade",
    AUTHENTICATION: "Autenticação",
  };
  return map[category] || category;
}

function TemplatePreview({ template }: { template: WhatsAppTemplate }) {
  const bodyComponent = template.components.find((c: any) => c.type === "BODY");
  const headerComponent = template.components.find((c: any) => c.type === "HEADER");
  const footerComponent = template.components.find((c: any) => c.type === "FOOTER");
  const buttonsComponent = template.components.find((c: any) => c.type === "BUTTONS");

  return (
    <div className="max-w-xs bg-[#dcf8c6] rounded-lg p-3 text-sm text-[#111] space-y-1 border">
      {headerComponent?.text && (
        <p className="font-bold text-xs">{headerComponent.text}</p>
      )}
      {bodyComponent?.text && (
        <p className="whitespace-pre-wrap">{bodyComponent.text}</p>
      )}
      {footerComponent?.text && (
        <p className="text-[11px] text-gray-500">{footerComponent.text}</p>
      )}
      {buttonsComponent?.buttons && (
        <div className="pt-1 space-y-1 border-t mt-1">
          {buttonsComponent.buttons.map((btn: any, i: number) => (
            <div key={i} className="text-center text-xs text-blue-600 font-medium py-1 border rounded bg-white/50">
              {btn.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WhatsAppTemplatesPage() {
  const { workspaceId } = useWorkspace();
  const { templates, loading, syncing, fetchTemplates, syncTemplates } = useWhatsAppTemplates();
  const [connections, setConnections] = useState<CloudConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    const load = async () => {
      const { data } = await supabase
        .from("whatsapp_cloud_connections")
        .select("id, inbox_name, phone_number, waba_id")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true);
      const conns = (data || []) as CloudConnection[];
      setConnections(conns);
      if (conns.length === 1) {
        setSelectedConnection(conns[0].id);
      }
    };
    load();
  }, [workspaceId]);

  useEffect(() => {
    if (selectedConnection) {
      fetchTemplates(selectedConnection);
    }
  }, [selectedConnection, fetchTemplates]);

  const handleSync = async () => {
    if (!selectedConnection) return;
    await syncTemplates(selectedConnection);
  };

  const approvedCount = templates.filter(t => t.status === "APPROVED").length;
  const pendingCount = templates.filter(t => t.status === "PENDING").length;
  const rejectedCount = templates.filter(t => t.status === "REJECTED").length;

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Templates WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Templates de mensagem do WhatsApp Cloud API (Meta). Gerencie no Meta Business e sincronize aqui.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select value={selectedConnection} onValueChange={setSelectedConnection}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Selecione a conexão Cloud API" />
          </SelectTrigger>
          <SelectContent>
            {connections.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.inbox_name} ({c.phone_number})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleSync} disabled={!selectedConnection || syncing} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sincronizar"}
        </Button>
      </div>

      {selectedConnection && templates.length > 0 && (
        <div className="flex gap-3">
          <Badge variant="outline" className="text-green-600">{approvedCount} aprovados</Badge>
          <Badge variant="outline" className="text-amber-600">{pendingCount} pendentes</Badge>
          {rejectedCount > 0 && <Badge variant="outline" className="text-red-600">{rejectedCount} rejeitados</Badge>}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando templates...</div>
      ) : !selectedConnection ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Selecione uma conexão Cloud API para ver os templates</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum template encontrado</p>
          <p className="text-sm mt-1">Clique em "Sincronizar" para importar do Meta Business</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {templates.map(tpl => (
            <Card
              key={tpl.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setExpandedTemplate(expandedTemplate === tpl.id ? null : tpl.id)}
            >
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-sm font-medium">{tpl.template_name}</CardTitle>
                    <Badge variant="outline" className="text-xs">{tpl.language}</Badge>
                    <Badge variant="secondary" className="text-xs">{getCategoryLabel(tpl.category)}</Badge>
                  </div>
                  {getStatusBadge(tpl.status)}
                </div>
              </CardHeader>
              {expandedTemplate === tpl.id && (
                <CardContent className="pt-0 pb-4 px-4">
                  <TemplatePreview template={tpl} />
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Última sincronização: {new Date(tpl.synced_at).toLocaleString("pt-BR")}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
