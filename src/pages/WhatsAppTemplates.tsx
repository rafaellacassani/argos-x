import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useWhatsAppTemplates, WhatsAppTemplate } from "@/hooks/useWhatsAppTemplates";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RefreshCw, FileText, Clock, CheckCircle, XCircle, AlertTriangle, Plus } from "lucide-react";

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
  const { templates, loading, syncing, creating, fetchTemplates, syncTemplates, createTemplate } = useWhatsAppTemplates();
  const [connections, setConnections] = useState<CloudConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [tplName, setTplName] = useState("");
  const [tplLanguage, setTplLanguage] = useState("pt_BR");
  const [tplCategory, setTplCategory] = useState("MARKETING");
  const [tplHeaderText, setTplHeaderText] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [tplFooter, setTplFooter] = useState("");
  const [tplButtons, setTplButtons] = useState<{ type: string; text: string; url?: string; phone_number?: string }[]>([]);

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

  const resetForm = () => {
    setTplName("");
    setTplLanguage("pt_BR");
    setTplCategory("MARKETING");
    setTplHeaderText("");
    setTplBody("");
    setTplFooter("");
    setTplButtons([]);
  };

  const handleCreate = async () => {
    if (!selectedConnection || !tplName.trim() || !tplBody.trim()) return;

    const components: any[] = [];

    if (tplHeaderText.trim()) {
      components.push({ type: "HEADER", format: "TEXT", text: tplHeaderText.trim() });
    }

    components.push({ type: "BODY", text: tplBody.trim() });

    if (tplFooter.trim()) {
      components.push({ type: "FOOTER", text: tplFooter.trim() });
    }

    if (tplButtons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: tplButtons.map((btn) => {
          if (btn.type === "URL") return { type: "URL", text: btn.text, url: btn.url };
          if (btn.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: btn.text, phone_number: btn.phone_number };
          return { type: "QUICK_REPLY", text: btn.text };
        }),
      });
    }

    const result = await createTemplate(selectedConnection, {
      name: tplName.trim(),
      language: tplLanguage,
      category: tplCategory,
      components,
    });

    if (result) {
      setShowCreate(false);
      resetForm();
    }
  };

  const addButton = (type: string) => {
    if (tplButtons.length >= 3) return;
    setTplButtons([...tplButtons, { type, text: "", url: "", phone_number: "" }]);
  };

  const updateButton = (index: number, field: string, value: string) => {
    setTplButtons(tplButtons.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  };

  const removeButton = (index: number) => {
    setTplButtons(tplButtons.filter((_, i) => i !== index));
  };

  const approvedCount = templates.filter(t => t.status === "APPROVED").length;
  const pendingCount = templates.filter(t => t.status === "PENDING").length;
  const rejectedCount = templates.filter(t => t.status === "REJECTED").length;

  // Sanitized name preview
  const sanitizedName = tplName.toLowerCase().replace(/[^a-z0-9_]/g, "_");

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Templates WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie e gerencie templates de mensagem do WhatsApp Cloud API (Meta).
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

        <Button onClick={() => setShowCreate(true)} disabled={!selectedConnection}>
          <Plus className="w-4 h-4 mr-2" />
          Criar Template
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
          <p className="text-sm mt-1">Clique em "Criar Template" ou "Sincronizar"</p>
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

      {/* Create Template Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Template WhatsApp</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Template</Label>
                <Input
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="ex: boas_vindas_cliente"
                />
                {tplName && (
                  <p className="text-xs text-muted-foreground">
                    Nome final: <code className="bg-muted px-1 rounded">{sanitizedName}</code>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Idioma</Label>
                <Select value={tplLanguage} onValueChange={setTplLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt_BR">Português (BR)</SelectItem>
                    <SelectItem value="en_US">English (US)</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={tplCategory} onValueChange={setTplCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="UTILITY">Utilidade</SelectItem>
                  <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cabeçalho (opcional)</Label>
              <Input
                value={tplHeaderText}
                onChange={(e) => setTplHeaderText(e.target.value)}
                placeholder="Texto do cabeçalho"
              />
            </div>

            <div className="space-y-2">
              <Label>Corpo da mensagem *</Label>
              <Textarea
                value={tplBody}
                onChange={(e) => setTplBody(e.target.value)}
                placeholder={"Olá {{1}}, tudo bem?\n\nSomos da {{2}} e gostaríamos de..."}
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{1}}"}, {"{{2}}"}, etc. para variáveis dinâmicas (nome, empresa, etc.)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Rodapé (opcional)</Label>
              <Input
                value={tplFooter}
                onChange={(e) => setTplFooter(e.target.value)}
                placeholder="Responda SAIR para não receber mais mensagens"
              />
            </div>

            {/* Buttons */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Botões (opcional, máx. 3)</Label>
                {tplButtons.length < 3 && (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => addButton("QUICK_REPLY")}>
                      + Resposta rápida
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => addButton("URL")}>
                      + Link
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => addButton("PHONE_NUMBER")}>
                      + Telefone
                    </Button>
                  </div>
                )}
              </div>

              {tplButtons.map((btn, i) => (
                <div key={i} className="flex gap-2 items-start p-2 border rounded-md">
                  <div className="flex-1 space-y-1">
                    <div className="flex gap-2 items-center">
                      <Badge variant="secondary" className="text-[10px]">
                        {btn.type === "QUICK_REPLY" ? "Resposta" : btn.type === "URL" ? "Link" : "Telefone"}
                      </Badge>
                      <Input
                        value={btn.text}
                        onChange={(e) => updateButton(i, "text", e.target.value)}
                        placeholder="Texto do botão"
                        className="h-8 text-sm"
                      />
                    </div>
                    {btn.type === "URL" && (
                      <Input
                        value={btn.url || ""}
                        onChange={(e) => updateButton(i, "url", e.target.value)}
                        placeholder="https://..."
                        className="h-8 text-sm"
                      />
                    )}
                    {btn.type === "PHONE_NUMBER" && (
                      <Input
                        value={btn.phone_number || ""}
                        onChange={(e) => updateButton(i, "phone_number", e.target.value)}
                        placeholder="+5511999999999"
                        className="h-8 text-sm"
                      />
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeButton(i)}>
                    <XCircle className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Preview */}
            {tplBody && (
              <div className="space-y-2">
                <Label>Pré-visualização</Label>
                <div className="max-w-xs bg-[#dcf8c6] rounded-lg p-3 text-sm text-[#111] space-y-1 border">
                  {tplHeaderText && <p className="font-bold text-xs">{tplHeaderText}</p>}
                  <p className="whitespace-pre-wrap">{tplBody}</p>
                  {tplFooter && <p className="text-[11px] text-gray-500">{tplFooter}</p>}
                  {tplButtons.length > 0 && (
                    <div className="pt-1 space-y-1 border-t mt-1">
                      {tplButtons.map((btn, i) => (
                        <div key={i} className="text-center text-xs text-blue-600 font-medium py-1 border rounded bg-white/50">
                          {btn.text || "..."}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !tplName.trim() || !tplBody.trim()}>
              {creating ? "Criando..." : "Criar Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
