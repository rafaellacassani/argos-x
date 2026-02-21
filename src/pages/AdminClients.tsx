import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Loader2,
  Copy,
  Search,
  UserPlus,
  Shield,
  MessageSquare,
  Bot,
  TrendingUp,
  ExternalLink,
  Check,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { PLAN_DEFINITIONS } from "@/hooks/usePlanLimits";

interface ClientData {
  id: string;
  name: string;
  plan_type: string;
  plan_name: string;
  subscription_status: string;
  trial_end: string | null;
  blocked_at: string | null;
  created_at: string;
  created_by: string;
  lead_limit: number;
  extra_leads: number;
  whatsapp_limit: number;
  user_limit: number;
  ai_interactions_limit: number;
  ai_interactions_used: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  owner: {
    full_name: string;
    email: string;
    phone: string | null;
    personal_whatsapp: string | null;
  } | null;
  leads_count: number;
  members_count: number;
  instances_count: number;
}

export default function AdminClients() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [formPlan, setFormPlan] = useState("semente");
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkAccess();
  }, [user]);

  const checkAccess = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    const isAdmin = !!(data && data.length > 0);
    setIsSuperAdmin(isAdmin);
    if (isAdmin) fetchClients();
    setLoading(false);
  };

  const fetchClients = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-clients", {
        body: { action: "list" },
      });

      if (error) throw error;
      setClients(data?.clients || []);
    } catch (err) {
      console.error("Error fetching clients:", err);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os clientes.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateCheckout = async () => {
    if (!formEmail || !formName) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha pelo menos o e-mail e nome completo.",
        variant: "destructive",
      });
      return;
    }

    setFormLoading(true);
    setGeneratedUrl("");

    try {
      const { data, error } = await supabase.functions.invoke("admin-clients", {
        body: {
          action: "create-checkout",
          plan: formPlan,
          email: formEmail,
          fullName: formName,
          phone: formPhone,
          successUrl: window.location.origin + "/auth",
          cancelUrl: window.location.origin + "/admin/clients",
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "Erro",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      if (data?.url) {
        setGeneratedUrl(data.url);
        toast({
          title: "Link gerado!",
          description: "Copie o link e envie ao cliente.",
        });
      }
    } catch (err: any) {
      console.error("Error creating checkout:", err);
      toast({
        title: "Erro ao gerar link",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    toast({ title: "Link copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetForm = () => {
    setFormPlan("semente");
    setFormEmail("");
    setFormName("");
    setFormPhone("");
    setGeneratedUrl("");
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const filteredClients = clients.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.name?.toLowerCase().includes(term) ||
      c.owner?.full_name?.toLowerCase().includes(term) ||
      c.owner?.email?.toLowerCase().includes(term)
    );
  });

  const getPlanBadge = (planType: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      active: { variant: "default", label: "Ativo" },
      trialing: { variant: "secondary", label: "Trial" },
      trial_manual: { variant: "secondary", label: "Trial Manual" },
      past_due: { variant: "destructive", label: "Pendente" },
      canceled: { variant: "destructive", label: "Cancelado" },
      blocked: { variant: "destructive", label: "Bloqueado" },
    };
    const badge = map[planType] || { variant: "outline" as const, label: planType };
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  const getUsagePercent = (used: number, limit: number) => {
    if (limit <= 0 || limit >= 999999) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão de Clientes</h1>
            <p className="text-sm text-muted-foreground">
              Crie assinaturas e gerencie seus clientes
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="new-client" className="space-y-6">
        <TabsList>
          <TabsTrigger value="new-client" className="gap-2">
            <UserPlus className="w-4 h-4" />
            Novo Cliente
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-2">
            <Users className="w-4 h-4" />
            Clientes ({clients.length})
          </TabsTrigger>
        </TabsList>

        {/* ───────── TAB: NOVO CLIENTE ───────── */}
        <TabsContent value="new-client">
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Criar Link de Assinatura
              </CardTitle>
              <CardDescription>
                Preencha os dados do cliente e gere um link de pagamento do Stripe.
                Após concluir, o cliente será redirecionado para criar a conta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={formPlan} onValueChange={setFormPlan}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLAN_DEFINITIONS).map(([key, plan]) => (
                      <SelectItem key={key} value={key}>
                        {plan.name} — R$ {plan.price}/mês
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Nome completo *</Label>
                <Input
                  placeholder="João da Silva"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>E-mail *</Label>
                <Input
                  type="email"
                  placeholder="joao@empresa.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleCreateCheckout}
                  disabled={formLoading}
                  className="flex-1"
                >
                  {formLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Gerar Link de Pagamento
                    </>
                  )}
                </Button>
                {generatedUrl && (
                  <Button variant="outline" onClick={handleResetForm}>
                    Novo
                  </Button>
                )}
              </div>

              {/* Generated URL */}
              {generatedUrl && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    ✅ Link gerado com sucesso!
                  </p>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={generatedUrl}
                      className="text-xs bg-background"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopy}
                      className="shrink-0"
                    >
                      {copied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Envie este link ao cliente. Após o pagamento, ele será redirecionado
                    para criar a conta no sistema.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────── TAB: CLIENTES ───────── */}
        <TabsContent value="clients" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchClients}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-center">Usuários</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {refreshing
                        ? "Carregando..."
                        : "Nenhum cliente encontrado."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => (
                    <TableRow
                      key={client.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedClient(client)}
                    >
                      <TableCell className="font-medium">
                        {client.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {client.owner?.email || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {client.plan_name || client.plan_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {client.members_count}/{client.user_limit}
                      </TableCell>
                      <TableCell>{getPlanBadge(client.plan_type)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(client.created_at), "dd/MM/yyyy")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ───────── DETAIL DIALOG ───────── */}
      <Dialog
        open={!!selectedClient}
        onOpenChange={(open) => !open && setSelectedClient(null)}
      >
        {selectedClient && (
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                {selectedClient.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              {/* Owner info */}
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Proprietário</p>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <p>{selectedClient.owner?.full_name || "—"}</p>
                  <p>{selectedClient.owner?.email || "—"}</p>
                  {selectedClient.owner?.phone && (
                    <p>{selectedClient.owner.phone}</p>
                  )}
                  {selectedClient.owner?.personal_whatsapp && (
                    <p>WhatsApp: {selectedClient.owner.personal_whatsapp}</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Plan & status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Plano</p>
                  <Badge variant="outline" className="capitalize">
                    {selectedClient.plan_name || selectedClient.plan_type}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  {getPlanBadge(selectedClient.plan_type)}
                </div>
                {selectedClient.trial_end && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Trial até</p>
                    <p className="text-sm font-medium">
                      {format(new Date(selectedClient.trial_end), "dd/MM/yyyy")}
                    </p>
                  </div>
                )}
                {selectedClient.stripe_customer_id && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Stripe Customer</p>
                    <p className="text-xs font-mono break-all">
                      {selectedClient.stripe_customer_id}
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Usage metrics */}
              <div className="space-y-4">
                <p className="text-sm font-medium text-foreground">Consumo</p>

                {/* Leads */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      Leads
                    </span>
                    <span className="font-medium">
                      {selectedClient.leads_count.toLocaleString("pt-BR")} /{" "}
                      {(selectedClient.lead_limit + (selectedClient.extra_leads || 0)) >= 999999
                        ? "∞"
                        : (selectedClient.lead_limit + (selectedClient.extra_leads || 0)).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <Progress
                    value={getUsagePercent(
                      selectedClient.leads_count,
                      selectedClient.lead_limit + (selectedClient.extra_leads || 0)
                    )}
                    className="h-2"
                  />
                </div>

                {/* AI Tokens */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Bot className="w-3.5 h-3.5" />
                      Interações IA
                    </span>
                    <span className="font-medium">
                      {selectedClient.ai_interactions_used?.toLocaleString("pt-BR") || 0} /{" "}
                      {selectedClient.ai_interactions_limit?.toLocaleString("pt-BR") || 0}
                    </span>
                  </div>
                  <Progress
                    value={getUsagePercent(
                      selectedClient.ai_interactions_used || 0,
                      selectedClient.ai_interactions_limit || 0
                    )}
                    className="h-2"
                  />
                </div>

                {/* WhatsApp Instances */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Conexões WhatsApp
                    </span>
                    <span className="font-medium">
                      {selectedClient.instances_count} /{" "}
                      {selectedClient.whatsapp_limit >= 999 ? "∞" : selectedClient.whatsapp_limit}
                    </span>
                  </div>
                  <Progress
                    value={getUsagePercent(
                      selectedClient.instances_count,
                      selectedClient.whatsapp_limit
                    )}
                    className="h-2"
                  />
                </div>

                {/* Users */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      Usuários
                    </span>
                    <span className="font-medium">
                      {selectedClient.members_count} / {selectedClient.user_limit}
                    </span>
                  </div>
                  <Progress
                    value={getUsagePercent(
                      selectedClient.members_count,
                      selectedClient.user_limit
                    )}
                    className="h-2"
                  />
                </div>
              </div>

              <Separator />

              {/* Extra info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Leads extras</p>
                  <p className="font-medium">
                    {selectedClient.extra_leads?.toLocaleString("pt-BR") || 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Criado em</p>
                  <p className="font-medium">
                    {format(new Date(selectedClient.created_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
                {selectedClient.stripe_subscription_id && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Stripe Subscription</p>
                    <p className="text-xs font-mono break-all">
                      {selectedClient.stripe_subscription_id}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
