import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, Mail, CheckCircle2, XCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface EmailConfig {
  id: string;
  email_type: string;
  ativo: boolean;
  assunto: string;
  corpo: string;
  updated_at: string;
}

interface EmailLog {
  id: string;
  workspace_id: string | null;
  tipo_email: string;
  timestamp_envio: string;
  status_entrega: string;
  resend_message_id: string | null;
  error_message: string | null;
}

const EMAIL_TYPE_LABELS: Record<string, string> = {
  d3: "D-3 (3 dias antes)",
  d1: "D-1 (1 dia antes)",
  dia_cobranca: "Dia da Cobrança",
};

const VARIABLES_LEGEND = [
  { var: "{nome}", desc: "Nome do cliente" },
  { var: "{data_vencimento}", desc: "Data de fim do trial" },
  { var: "{nome_plano}", desc: "Nome do plano contratado" },
  { var: "{valor_plano}", desc: "Valor mensal do plano" },
  { var: "{proxima_data_renovacao}", desc: "Data da próxima renovação" },
  { var: "{data_cobranca}", desc: "Data em que a cobrança foi feita" },
  { var: "{link_cancelamento}", desc: "Link do portal Stripe para cancelar" },
  { var: "{link_gerenciar_assinatura}", desc: "Link para gerenciar assinatura" },
];

const LOG_TYPE_LABELS: Record<string, string> = {
  pre_cobranca_d3: "D-3",
  pre_cobranca_d1: "D-1",
  cobranca_confirmada: "Dia Cobrança",
};

export default function PreBillingCadencePanel() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<EmailConfig[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, logsRes] = await Promise.all([
        supabase
          .from("pre_billing_cadence_config")
          .select("*")
          .order("email_type", { ascending: true }),
        supabase
          .from("pre_billing_email_logs")
          .select("*")
          .order("timestamp_envio", { ascending: false })
          .limit(20),
      ]);

      setConfigs((configRes.data as any[]) || []);
      setLogs((logsRes.data as any[]) || []);
    } catch (err) {
      console.error("Error fetching pre-billing config:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (index: number, updates: Partial<EmailConfig>) => {
    setConfigs(configs.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const config of configs) {
        const { error } = await supabase
          .from("pre_billing_cadence_config")
          .update({
            ativo: config.ativo,
            assunto: config.assunto,
            corpo: config.corpo,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", config.id);
        if (error) throw error;
      }
      toast({ title: "Salvo!", description: "Configurações de pré-cobrança atualizadas." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Sort: d3, d1, dia_cobranca
  const sortOrder = ["d3", "d1", "dia_cobranca"];
  const sorted = [...configs].sort(
    (a, b) => sortOrder.indexOf(a.email_type) - sortOrder.indexOf(b.email_type)
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Cadência Pré-Cobrança
          </CardTitle>
          <CardDescription>
            E-mails automáticos enviados antes da cobrança do plano. Canal: somente e-mail via Resend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {sorted.map((config, idx) => {
            const realIndex = configs.findIndex((c) => c.id === config.id);
            return (
              <div key={config.id} className="space-y-4">
                {idx > 0 && <Separator />}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {EMAIL_TYPE_LABELS[config.email_type] || config.email_type}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`toggle-${config.id}`} className="text-sm text-muted-foreground">
                      {config.ativo ? "Ativo" : "Desativado"}
                    </Label>
                    <Switch
                      id={`toggle-${config.id}`}
                      checked={config.ativo}
                      onCheckedChange={(v) => updateConfig(realIndex, { ativo: v })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Assunto do e-mail</Label>
                  <Input
                    value={config.assunto}
                    onChange={(e) => updateConfig(realIndex, { assunto: e.target.value })}
                    placeholder="Assunto..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Corpo do e-mail</Label>
                  <Textarea
                    value={config.corpo}
                    onChange={(e) => updateConfig(realIndex, { corpo: e.target.value })}
                    rows={8}
                    placeholder="Corpo do e-mail..."
                    className="font-mono text-sm"
                  />
                </div>

                {/* Variables legend */}
                <div className="rounded-md bg-muted/50 p-3">
                  <div className="flex items-center gap-1 mb-2">
                    <Info className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Variáveis disponíveis:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {VARIABLES_LEGEND.map((v) => (
                      <span key={v.var} className="text-xs text-muted-foreground">
                        <code className="bg-background px-1 rounded text-foreground">{v.var}</code> — {v.desc}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar alterações
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de envios recentes</CardTitle>
          <CardDescription>Últimos 20 e-mails pré-cobrança enviados.</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum e-mail enviado ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {LOG_TYPE_LABELS[log.tipo_email] || log.tipo_email}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.status_entrega === "enviado" ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Enviado
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="w-3 h-3 mr-1" />
                          Falha
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(log.timestamp_envio), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {log.error_message || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
