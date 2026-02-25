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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  MoreHorizontal,
  Link2,
  Mail,
  Trash2,
  Pencil,
  CreditCard,
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

  // Free workspace form state
  const [freeEmail, setFreeEmail] = useState("");
  const [freeName, setFreeName] = useState("");
  const [freePhone, setFreePhone] = useState("");
  const [freeLoading, setFreeLoading] = useState(false);
  const [freeRecoveryLink, setFreeRecoveryLink] = useState("");
  const [freeCopied, setFreeCopied] = useState(false);

  // Action states
  const [deleteClient, setDeleteClient] = useState<ClientData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editClient, setEditClient] = useState<ClientData | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editOwnerName, setEditOwnerName] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [planClient, setPlanClient] = useState<ClientData | null>(null);
  const [planSelected, setPlanSelected] = useState("semente");

  // Limits editor state
  const [limitsClient, setLimitsClient] = useState<ClientData | null>(null);
  const [limitsWhatsapp, setLimitsWhatsapp] = useState(1);
  const [limitsUsers, setLimitsUsers] = useState(1);
  const [limitsLeads, setLimitsLeads] = useState(300);
  const [limitsExtraLeads, setLimitsExtraLeads] = useState(0);
  const [limitsAI, setLimitsAI] = useState(100);
  const [limitsLoading, setLimitsLoading] = useState(false);

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
          successUrl: "https://argosx.com.br/auth",
          cancelUrl: "https://argosx.com.br/admin/clients",
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

  const handleCreateFreeWorkspace = async () => {
    if (!freeEmail || !freeName) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha pelo menos o e-mail e nome completo.",
        variant: "destructive",
      });
      return;
    }

    setFreeLoading(true);
    setFreeRecoveryLink("");
    try {
      const { data, error } = await supabase.functions.invoke("admin-clients", {
        body: {
          action: "create-free-workspace",
          email: freeEmail,
          fullName: freeName,
          phone: freePhone,
          redirectTo: "https://argosx.com.br",
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        return;
      }

      if (data?.recoveryLink) {
        setFreeRecoveryLink(data.recoveryLink);
      }

      toast({ title: "Workspace criado!", description: `Workspace gratuito criado para ${freeName}.` });
      fetchClients();
    } catch (err: any) {
      console.error("Error creating free workspace:", err);
      toast({ title: "Erro", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setFreeLoading(false);
    }
  };

  const handleResetForm = () => {
    setFormPlan("semente");
    setFormEmail("");
    setFormName("");
    setFormPhone("");
    setGeneratedUrl("");
  };

  const handleCopyWorkspaceLink = (client: ClientData) => {
    const link = `https://argos-x.lovable.app/auth`;
    navigator.clipboard.writeText(link);
    toast({ title: "Link copiado!", description: `Link de acesso copiado para ${client.name}.` });
  };

  const handleResendInvite = async (client: ClientData) => {
    if (!client.owner?.email) {
      toast({ title: "Erro", description: "Cliente sem e-mail cadastrado.", variant: "destructive" });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("admin-clients", {
        body: { action: "resend-invite", email: client.owner.email, redirectTo: "https://argosx.com.br" },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        return;
      }
      if (data?.recoveryLink) {
        setInviteLink(data.recoveryLink);
        await navigator.clipboard.writeText(data.recoveryLink);
        toast({ title: "Link de convite gerado e copiado!", description: "Envie ao cliente para ele definir a senha." });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Tente novamente.", variant: "destructive" });
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!deleteClient) return;
    setDeleteLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-clients", {
        body: { action: "delete-workspace", workspaceId: deleteClient.id },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Workspace excluído!", description: `"${deleteClient.name}" foi removido.` });
      setDeleteClient(null);
      fetchClients();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const openEditDialog = (client: ClientData) => {
    setEditClient(client);
    setEditName(client.name);
    setEditOwnerName(client.owner?.full_name || "");
    setEditEmail(client.owner?.email || "");
    setEditPhone(client.owner?.phone || "");
  };

  const handleUpdateWorkspace = async () => {
    if (!editClient) return;
    setEditLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-clients", {
        body: {
          action: "update-workspace",
          workspaceId: editClient.id,
          name: editName,
          ownerName: editOwnerName,
          ownerEmail: editEmail,
          ownerPhone: editPhone,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Atualizado!", description: "Dados do cliente atualizados com sucesso." });
      setEditClient(null);
      fetchClients();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setEditLoading(false);
    }
  };

  const handleActivatePlan = () => {
    toast({ title: "Em breve!", description: `Ativação do plano "${planSelected}" será implementada em breve.` });
    setPlanClient(null);
  };

  const openLimitsDialog = (client: ClientData) => {
    setLimitsClient(client);
    setLimitsWhatsapp(client.whatsapp_limit);
    setLimitsUsers(client.user_limit);
    setLimitsLeads(client.lead_limit);
    setLimitsExtraLeads(client.extra_leads || 0);
    setLimitsAI(client.ai_interactions_limit);
  };

  const handleUpdateLimits = async () => {
    if (!limitsClient) return;
    setLimitsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-clients", {
        body: {
          action: "update-limits",
          workspaceId: limitsClient.id,
          leadLimit: limitsLeads,
          extraLeads: limitsExtraLeads,
          whatsappLimit: limitsWhatsapp,
          userLimit: limitsUsers,
          aiInteractionsLimit: limitsAI,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Limites atualizados!", description: `Recursos de "${limitsClient.name}" foram ajustados.` });
      setLimitsClient(null);
      fetchClients();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLimitsLoading(false);
    }
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
        <TabsContent value="new-client" className="space-y-6">
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
                    {Object.entries(PLAN_DEFINITIONS)
                      .filter(([key]) => key !== 'gratuito')
                      .map(([key, plan]) => (
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

          {/* ───── CRIAR WORKSPACE GRATUITO ───── */}
          <Card className="max-w-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Criar Workspace Gratuito
              </CardTitle>
              <CardDescription>
                Crie um workspace diretamente sem passar pelo Stripe. O cliente já será ativado com o plano gratuito.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome completo *</Label>
                <Input
                  placeholder="João da Silva"
                  value={freeName}
                  onChange={(e) => setFreeName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>E-mail *</Label>
                <Input
                  type="email"
                  placeholder="joao@empresa.com"
                  value={freeEmail}
                  onChange={(e) => setFreeEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={freePhone}
                  onChange={(e) => setFreePhone(e.target.value)}
                />
              </div>

              <Button
                onClick={handleCreateFreeWorkspace}
                disabled={freeLoading}
                className="w-full"
                variant="secondary"
              >
                {freeLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Criar Workspace Gratuito
                  </>
                )}
              </Button>

              {/* Recovery link */}
              {freeRecoveryLink && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    ✅ Workspace criado! Envie o link abaixo para o cliente definir a senha:
                  </p>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={freeRecoveryLink}
                      className="text-xs bg-background"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(freeRecoveryLink);
                        setFreeCopied(true);
                        toast({ title: "Link copiado!" });
                        setTimeout(() => setFreeCopied(false), 2000);
                      }}
                      className="shrink-0"
                    >
                      {freeCopied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O cliente deve clicar neste link para criar a senha e acessar o sistema.
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setFreeRecoveryLink("");
                      setFreeEmail("");
                      setFreeName("");
                      setFreePhone("");
                    }}
                  >
                    Criar outro
                  </Button>
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
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
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
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => handleCopyWorkspaceLink(client)}>
                              <Link2 className="w-4 h-4 mr-2" />
                              Link do workspace
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleResendInvite(client)}>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Gerar link de login
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEditDialog(client)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setPlanClient(client); setPlanSelected("semente"); }}>
                              <CreditCard className="w-4 h-4 mr-2" />
                              Ativar plano
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openLimitsDialog(client)}>
                              <TrendingUp className="w-4 h-4 mr-2" />
                              Ajustar limites
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteClient(client)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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

      {/* ───────── DELETE CONFIRMATION ───────── */}
      <AlertDialog open={!!deleteClient} onOpenChange={(open) => !open && setDeleteClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o workspace <strong>"{deleteClient?.name}"</strong>? 
              Todos os dados (leads, conversas, agentes, etc.) serão permanentemente removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkspace}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ───────── EDIT DIALOG ───────── */}
      <Dialog open={!!editClient} onOpenChange={(open) => !open && setEditClient(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Editar Cliente
            </DialogTitle>
            <DialogDescription>Atualize os dados do workspace e do proprietário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do workspace</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nome do proprietário</Label>
              <Input value={editOwnerName} onChange={(e) => setEditOwnerName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClient(null)} disabled={editLoading}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateWorkspace} disabled={editLoading}>
              {editLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────── ACTIVATE PLAN DIALOG (simulated) ───────── */}
      <Dialog open={!!planClient} onOpenChange={(open) => !open && setPlanClient(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Ativar Plano
            </DialogTitle>
            <DialogDescription>
              Selecione o plano para <strong>{planClient?.name}</strong>. Um e-mail do Stripe será enviado ao cliente para ativação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={planSelected} onValueChange={setPlanSelected}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLAN_DEFINITIONS)
                    .filter(([key]) => key !== "gratuito")
                    .map(([key, plan]) => (
                      <SelectItem key={key} value={key}>
                        {plan.name} — R$ {plan.price}/mês
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanClient(null)}>
              Cancelar
            </Button>
            <Button onClick={handleActivatePlan}>
              Ativar plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────── INVITE LINK DIALOG ───────── */}
      <Dialog open={!!inviteLink} onOpenChange={(open) => !open && setInviteLink("")}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link de login gerado</DialogTitle>
            <DialogDescription>Envie este link ao cliente. Ao acessar, ele poderá criar sua senha e entrar no sistema.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={inviteLink} className="text-xs bg-background" />
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteLink);
                setInviteLinkCopied(true);
                toast({ title: "Link copiado!" });
                setTimeout(() => setInviteLinkCopied(false), 2000);
              }}
              className="shrink-0"
            >
              {inviteLinkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ───────── LIMITS EDITOR DIALOG ───────── */}
      <Dialog open={!!limitsClient} onOpenChange={(open) => !open && setLimitsClient(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Ajustar Limites
            </DialogTitle>
            <DialogDescription>
              Altere os recursos disponíveis para <strong>{limitsClient?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Limite de leads</Label>
                <Input
                  type="number"
                  min={0}
                  value={limitsLeads}
                  onChange={(e) => setLimitsLeads(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Leads extras</Label>
                <Input
                  type="number"
                  min={0}
                  value={limitsExtraLeads}
                  onChange={(e) => setLimitsExtraLeads(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Instâncias WhatsApp</Label>
                <Input
                  type="number"
                  min={1}
                  value={limitsWhatsapp}
                  onChange={(e) => setLimitsWhatsapp(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Usuários</Label>
                <Input
                  type="number"
                  min={1}
                  value={limitsUsers}
                  onChange={(e) => setLimitsUsers(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Interações IA</Label>
                <Input
                  type="number"
                  min={0}
                  value={limitsAI}
                  onChange={(e) => setLimitsAI(Number(e.target.value))}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Use 999999 para leads ou 999 para WhatsApp caso queira liberar ilimitado.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitsClient(null)} disabled={limitsLoading}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateLimits} disabled={limitsLoading}>
              {limitsLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar limites
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
