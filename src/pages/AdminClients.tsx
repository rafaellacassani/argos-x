import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Timer,
  Send,
  CalendarClock,
  Eye,
  Filter,
  Plus,
  ArrowUp,
  ArrowDown,
  Music,
  Type,
  Upload,
  Activity,
  BarChart3,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import WorkspaceHealthTab from "@/components/admin/WorkspaceHealthTab";
import ExecutiveDashboardTab from "@/components/admin/ExecutiveDashboardTab";
import CadenceMetricsPanel from "@/components/admin/CadenceMetricsPanel";
import PreBillingCadencePanel from "@/components/admin/PreBillingCadencePanel";
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

interface InviteData {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  plan: string;
  invite_type: string;
  status: string;
  checkout_url: string | null;
  stripe_customer_id: string | null;
  workspace_id: string | null;
  created_at: string;
}

export default function AdminClients() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [invites, setInvites] = useState<InviteData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [formPlan, setFormPlan] = useState("essencial");
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
  const [planSelected, setPlanSelected] = useState("essencial");

  // Limits editor state
  const [limitsClient, setLimitsClient] = useState<ClientData | null>(null);
  const [limitsWhatsapp, setLimitsWhatsapp] = useState(1);
  const [limitsUsers, setLimitsUsers] = useState(1);
  const [limitsLeads, setLimitsLeads] = useState(300);
  const [limitsExtraLeads, setLimitsExtraLeads] = useState(0);
  const [limitsAI, setLimitsAI] = useState(100);
  const [limitsLoading, setLimitsLoading] = useState(false);

  // Cadence config state
  const [cadenceConfig, setCadenceConfig] = useState<{
    id: string;
    is_active: boolean;
    cadence_days: number[];
    whatsapp_instance_name: string | null;
    whatsapp_template: string;
    email_subject: string;
    email_template: string;
    send_whatsapp: boolean;
    send_email: boolean;
    welcome_message_template: string | null;
  } | null>(null);
  const [cadenceLoading, setCadenceLoading] = useState(false);
  const [cadenceSaving, setCadenceSaving] = useState(false);
  const normalizeCadenceDays = (days: number[] | null | undefined) =>
    [...new Set((days || []).filter((day): day is number => typeof day === "number"))].sort((a, b) => a - b);
  const [reactivationLog, setReactivationLog] = useState<any[]>([]);
  const [evolutionInstances, setEvolutionInstances] = useState<{ instance_name: string; display_name: string | null; instance_type: string; workspace_id: string }[]>([]);

  // Cadence messages state
  interface CadenceMessage {
    id?: string;
    config_id: string;
    cadence_day: number;
    channel: string;
    message_type: string;
    content: string | null;
    audio_url: string | null;
    subject: string | null;
    position: number;
    is_active: boolean;
  }
  const [cadenceMessages, setCadenceMessages] = useState<CadenceMessage[]>([]);
  const [cadenceMessagesSaving, setCadenceMessagesSaving] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk WhatsApp state
  const [bulkWhatsappOpen, setBulkWhatsappOpen] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("Olá, {nome}! 👋\n\n");
  const [bulkInstance, setBulkInstance] = useState("");
  const [bulkSending, setBulkSending] = useState(false);

  // New client modal state
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientMode, setNewClientMode] = useState<"checkout" | "free">("checkout");

  // Communication sub-tab state
  const [commSubTab, setCommSubTab] = useState<"cadence" | "prebilling">("cadence");

  // Clients sub-tab state (clients vs invites)
  const [clientsSubTab, setClientsSubTab] = useState<"all" | "invites">("all");

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
    if (isAdmin) {
      fetchClients();
      fetchCadenceConfig();
    }
    setLoading(false);
  };

  const fetchCadenceConfig = async () => {
    setCadenceLoading(true);
    try {
      const [configRes, logsRes, instancesRes] = await Promise.all([
        supabase.from("reactivation_cadence_config").select("*").limit(1).single(),
        supabase.from("reactivation_log").select("*").order("sent_at", { ascending: false }).limit(50),
        supabase.from("whatsapp_instances").select("instance_name, display_name, instance_type, workspace_id"),
      ]);

      if (configRes.data) {
        // Fetch cadence messages
        const { data: msgs } = await supabase
          .from("cadence_messages")
          .select("*")
          .eq("config_id", configRes.data.id)
          .order("position", { ascending: true });

        const persistedDays = Array.isArray(configRes.data.cadence_days)
          ? (configRes.data.cadence_days as number[])
          : [-2, -1, 0, 3, 7];

        setCadenceConfig({
          ...configRes.data,
          cadence_days: normalizeCadenceDays(persistedDays),
          welcome_message_template: (configRes.data as any).welcome_message_template || null,
        });
        setCadenceMessages((msgs || []) as CadenceMessage[]);
      }
      setReactivationLog(logsRes.data || []);
      setEvolutionInstances(instancesRes.data || []);
    } catch (err) {
      console.error("Error fetching cadence config:", err);
    } finally {
      setCadenceLoading(false);
    }
  };

  const handleSaveCadence = async () => {
    if (!cadenceConfig) return;
    setCadenceSaving(true);
    try {
      const { error } = await supabase
        .from("reactivation_cadence_config")
        .update({
          is_active: cadenceConfig.is_active,
          cadence_days: cadenceConfig.cadence_days,
          whatsapp_instance_name: cadenceConfig.whatsapp_instance_name,
          whatsapp_template: cadenceConfig.whatsapp_template,
          email_subject: cadenceConfig.email_subject,
          email_template: cadenceConfig.email_template,
          send_whatsapp: cadenceConfig.send_whatsapp,
          send_email: cadenceConfig.send_email,
          welcome_message_template: cadenceConfig.welcome_message_template,
        } as any)
        .eq("id", cadenceConfig.id);

      if (error) throw error;
      toast({ title: "Cadência salva!", description: "Configurações de reativação atualizadas." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setCadenceSaving(false);
    }
  };

  const handleSaveCadenceMessages = async () => {
    if (!cadenceConfig) return;
    setCadenceMessagesSaving(true);
    try {
      const messageDays = normalizeCadenceDays(cadenceMessages.map((message) => message.cadence_day));
      const syncedCadenceDays = normalizeCadenceDays([...cadenceConfig.cadence_days, ...messageDays]);

      // Delete all existing messages for this config
      await supabase
        .from("cadence_messages")
        .delete()
        .eq("config_id", cadenceConfig.id);

      // Insert all current messages
      if (cadenceMessages.length > 0) {
        const toInsert = cadenceMessages.map((m, idx) => ({
          config_id: cadenceConfig.id,
          cadence_day: m.cadence_day,
          channel: m.channel,
          message_type: m.message_type,
          content: m.content,
          audio_url: m.audio_url,
          subject: m.subject,
          position: idx,
          is_active: m.is_active,
        }));
        const { error } = await supabase.from("cadence_messages").insert(toInsert);
        if (error) throw error;
      }

      const { error: configError } = await supabase
        .from("reactivation_cadence_config")
        .update({ cadence_days: syncedCadenceDays } as any)
        .eq("id", cadenceConfig.id);

      if (configError) throw configError;

      setCadenceConfig({
        ...cadenceConfig,
        cadence_days: syncedCadenceDays,
      });

      toast({ title: "Mensagens salvas!", description: "Mensagens de cadência atualizadas com sucesso." });
      // Refresh
      const { data: msgs } = await supabase
        .from("cadence_messages")
        .select("*")
        .eq("config_id", cadenceConfig.id)
        .order("position", { ascending: true });
      setCadenceMessages((msgs || []) as CadenceMessage[]);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setCadenceMessagesSaving(false);
    }
  };

  const addCadenceMessage = (day: number, channel: string = "whatsapp") => {
    if (!cadenceConfig) return;
    const dayMsgs = cadenceMessages.filter(m => m.cadence_day === day);
    setCadenceMessages([...cadenceMessages, {
      config_id: cadenceConfig.id,
      cadence_day: day,
      channel,
      message_type: "text",
      content: "",
      audio_url: null,
      subject: null,
      position: dayMsgs.length,
      is_active: true,
    }]);
  };

  const removeCadenceMessage = (index: number) => {
    setCadenceMessages(cadenceMessages.filter((_, i) => i !== index));
  };

  const updateCadenceMessage = (index: number, updates: Partial<CadenceMessage>) => {
    setCadenceMessages(cadenceMessages.map((m, i) => i === index ? { ...m, ...updates } : m));
  };

  const moveCadenceMessage = (index: number, direction: "up" | "down") => {
    const dayMsgs = cadenceMessages.filter(m => m.cadence_day === cadenceMessages[index].cadence_day);
    if (dayMsgs.length <= 1) return;
    const newMsgs = [...cadenceMessages];
    const sameDayIndices = cadenceMessages
      .map((m, i) => m.cadence_day === cadenceMessages[index].cadence_day ? i : -1)
      .filter(i => i >= 0);
    const posInDay = sameDayIndices.indexOf(index);
    const swapPos = direction === "up" ? posInDay - 1 : posInDay + 1;
    if (swapPos < 0 || swapPos >= sameDayIndices.length) return;
    const swapIndex = sameDayIndices[swapPos];
    [newMsgs[index], newMsgs[swapIndex]] = [newMsgs[swapIndex], newMsgs[index]];
    setCadenceMessages(newMsgs);
  };

  const handleAudioUpload = async (file: File, messageIndex: number) => {
    if (!cadenceConfig) return;
    setUploadingAudio(String(messageIndex));
    try {
      const ext = file.name.split(".").pop() || "ogg";
      const filePath = `${cadenceConfig.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("cadence-audio")
        .upload(filePath, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("cadence-audio")
        .getPublicUrl(filePath);

      updateCadenceMessage(messageIndex, { audio_url: urlData.publicUrl });
      toast({ title: "Áudio enviado!" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAudio(null);
    }
  };

  const fetchClients = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-clients", {
        body: { action: "list" },
      });

      setClients(data?.clients || []);
      setInvites(data?.invites || []);
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

  // Open or create a chat with this client's owner inside the CURRENT workspace.
  // Creates a lead with the owner's WhatsApp number (preferring personal_whatsapp,
  // falling back to phone) and navigates to /chats with the phone pre-searched.
  const handleStartConversation = async (client: ClientData) => {
    if (!workspace?.id) {
      toast({ title: "Sem workspace ativo", variant: "destructive" });
      return;
    }
    const rawPhone = client.owner?.personal_whatsapp || client.owner?.phone || "";
    const digits = (rawPhone || "").replace(/[^0-9]/g, "");
    if (digits.length < 10) {
      toast({
        title: "Telefone inválido",
        description: "O proprietário deste cliente não possui WhatsApp/telefone cadastrado.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Look for an existing lead in the current workspace with this phone
      const { data: existing } = await supabase
        .from("leads")
        .select("id, phone")
        .eq("workspace_id", workspace.id)
        .or(`phone.eq.${digits},phone.ilike.%${digits.slice(-10)}%`)
        .limit(1)
        .maybeSingle();

      if (!existing) {
        // Find the first stage of the default funnel in current workspace
        const { data: stage } = await supabase
          .from("funnel_stages")
          .select("id")
          .eq("workspace_id", workspace.id)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();

        const { error: insertError } = await supabase.from("leads").insert({
          workspace_id: workspace.id,
          name: client.owner?.full_name || client.name,
          phone: digits,
          whatsapp_jid: `${digits}@s.whatsapp.net`,
          stage_id: stage?.id || null,
          source: "admin-clients",
        } as any);

        if (insertError) throw insertError;
        toast({ title: "Lead criado", description: "Abrindo conversa..." });
      }

      setSelectedClient(null);
      // Navigate to chat with the phone pre-searched so it auto-loads the conversation
      navigate(`/chats?search=${encodeURIComponent(digits)}`);
    } catch (err: any) {
      toast({
        title: "Erro ao iniciar conversa",
        description: err.message,
        variant: "destructive",
      });
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
        const channels: string[] = [];
        if (data.emailSent) channels.push("e-mail");
        if (data.whatsappSent) channels.push("WhatsApp");
        const channelMsg = channels.length > 0
          ? `Link enviado via ${channels.join(" e ")}!`
          : "Link gerado! Copie e envie ao cliente manualmente.";
        toast({
          title: channels.length > 0 ? "Convite enviado! ✉️" : "Link gerado!",
          description: channelMsg,
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

      const waMsg = data?.whatsappSent ? " Convite também enviado via WhatsApp!" : "";
      toast({ title: "Workspace criado!", description: `Workspace gratuito criado para ${freeName}.${waMsg}` });
      fetchClients();
    } catch (err: any) {
      console.error("Error creating free workspace:", err);
      toast({ title: "Erro", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setFreeLoading(false);
    }
  };

  const handleResetForm = () => {
    setFormPlan("essencial");
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

  const getClientStatusKey = (client: ClientData) => {
    const now = new Date();
    const trialEnd = client.trial_end ? new Date(client.trial_end) : null;
    if (client.plan_type === "active") return "active";
    if (client.plan_type === "past_due") return "past_due";
    if (client.plan_type === "canceled") return "canceled";
    if (client.blocked_at || (trialEnd && trialEnd <= now)) return "expired";
    if ((client.plan_type === "trialing" || client.plan_type === "trial_manual") && trialEnd && trialEnd > now) return "trialing";
    return "other";
  };

  const filteredClients = clients.filter((c) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      c.name?.toLowerCase().includes(term) ||
      c.owner?.full_name?.toLowerCase().includes(term) ||
      c.owner?.email?.toLowerCase().includes(term);
    if (!matchesSearch) return false;

    // Plan filter
    if (filterPlan !== "all") {
      const planName = c.plan_name || c.plan_type || "";
      if (filterPlan === "trial") {
        if (c.plan_type !== "trialing" && c.plan_type !== "trial_manual") return false;
      } else if (planName.toLowerCase() !== filterPlan.toLowerCase()) {
        return false;
      }
    }

    // Status filter
    if (filterStatus !== "all") {
      if (getClientStatusKey(c) !== filterStatus) return false;
    }

    // Date filter
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      if (new Date(c.created_at) < from) return false;
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(c.created_at) > to) return false;
    }

    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredClients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredClients.map(c => c.id)));
    }
  };

  const handleBulkWhatsapp = async () => {
    if (!bulkInstance || !bulkMessage || selectedIds.size === 0) return;
    setBulkSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-clients", {
        body: {
          action: "bulk-whatsapp",
          workspaceIds: Array.from(selectedIds),
          message: bulkMessage,
          instanceName: bulkInstance,
        },
      });
      if (error) throw error;
      toast({
        title: "Envio concluído!",
        description: `${data?.sent || 0} enviados, ${data?.failed || 0} falharam.`,
      });
      if (data?.errors?.length) {
        console.warn("Bulk WhatsApp errors:", data.errors);
      }
      setBulkWhatsappOpen(false);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setBulkSending(false);
    }
  };

  

  const getClientStatusInfo = (client: ClientData) => {
    const now = new Date();
    const trialEnd = client.trial_end ? new Date(client.trial_end) : null;
    const daysRemaining = trialEnd ? Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000) : null;
    const daysSinceExpiry = trialEnd ? Math.ceil((now.getTime() - trialEnd.getTime()) / 86400000) : null;

    if (client.plan_type === "active") {
      return { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "Ativo", className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" };
    }
    if (client.plan_type === "past_due") {
      return { icon: <CreditCard className="w-3.5 h-3.5" />, label: "Pagamento pendente", className: "bg-amber-500/10 text-amber-600 border-amber-200" };
    }
    if (client.plan_type === "canceled") {
      return { icon: <XCircle className="w-3.5 h-3.5" />, label: "Cancelado", className: "bg-red-500/10 text-red-600 border-red-200" };
    }
    if (client.blocked_at || (trialEnd && trialEnd <= now)) {
      return {
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        label: `Trial expirado${daysSinceExpiry ? ` (${daysSinceExpiry}d)` : ""}`,
        className: "bg-red-500/10 text-red-600 border-red-200",
      };
    }
    if ((client.plan_type === "trialing" || client.plan_type === "trial_manual") && trialEnd && trialEnd > now) {
      return {
        icon: <Timer className="w-3.5 h-3.5" />,
        label: `Trial (${daysRemaining}d restantes)`,
        className: "bg-blue-500/10 text-blue-600 border-blue-200",
      };
    }
    return { icon: <Clock className="w-3.5 h-3.5" />, label: client.plan_type, className: "bg-muted text-muted-foreground" };
  };

  const getPlanBadge = (client: ClientData) => {
    const info = getClientStatusInfo(client);
    return (
      <Badge variant="outline" className={`gap-1 ${info.className}`}>
        {info.icon}
        {info.label}
      </Badge>
    );
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

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-2">
            <Users className="w-4 h-4" />
            Clientes ({clients.length})
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-2">
            <Activity className="w-4 h-4" />
            Saúde
          </TabsTrigger>
          <TabsTrigger value="communication" className="gap-2">
            <CalendarClock className="w-4 h-4" />
            Comunicação
          </TabsTrigger>
        </TabsList>

        {/* ───────── TAB: VISÃO GERAL (Dashboard Executivo) ───────── */}
        <TabsContent value="overview">
          <ExecutiveDashboardTab />
        </TabsContent>

        {/* Conteúdo "Novo Cliente" — agora dentro do Dialog acionado pelo botão no header da aba Clientes */}
        <Dialog open={newClientOpen} onOpenChange={setNewClientOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Cliente</DialogTitle>
              <DialogDescription>
                Crie via link de pagamento (Stripe) ou um workspace gratuito direto.
              </DialogDescription>
            </DialogHeader>
            <Tabs value={newClientMode} onValueChange={(v) => setNewClientMode(v as "checkout" | "free")} className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="checkout">Link Stripe</TabsTrigger>
                <TabsTrigger value="free">Workspace Gratuito</TabsTrigger>
              </TabsList>
              <TabsContent value="checkout" className="space-y-4 mt-2">
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
                        {plan.name} — R$ {plan.price}/{('billingPeriod' in plan && plan.billingPeriod) ? plan.billingPeriod : 'mês'}
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

              <TabsContent value="free" className="space-y-4 mt-2">
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
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* ───────── TAB: CLIENTES ───────── */}
        <TabsContent value="clients" className="space-y-4">
          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger className="w-[150px]">
                <Filter className="w-3.5 h-3.5 mr-1.5" />
                <SelectValue placeholder="Plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os planos</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="semente">Semente</SelectItem>
                <SelectItem value="essencial">Essencial</SelectItem>
                <SelectItem value="negocio">Negócio</SelectItem>
                <SelectItem value="escala">Escala</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="trialing">Em trial</SelectItem>
                <SelectItem value="expired">Trial expirado</SelectItem>
                <SelectItem value="past_due">Pagamento pendente</SelectItem>
                <SelectItem value="canceled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                placeholder="De"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-[140px] text-xs"
              />
              <span className="text-muted-foreground text-xs">até</span>
              <Input
                type="date"
                placeholder="Até"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-[140px] text-xs"
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

          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <span className="text-sm font-medium">
                {selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setBulkWhatsappOpen(true)}
              >
                <MessageSquare className="w-4 h-4" />
                Enviar WhatsApp em massa
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              >
                Limpar seleção
              </Button>
            </div>
          )}

          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredClients.length > 0 && selectedIds.size === filteredClients.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
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
                      colSpan={8}
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
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(client.id)}
                          onCheckedChange={() => toggleSelect(client.id)}
                        />
                      </TableCell>
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
                      <TableCell>{getPlanBadge(client)}</TableCell>
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
                            <DropdownMenuItem
                              onClick={() => {
                                const url = `${window.location.origin}/dashboard?admin_ws=${client.id}`;
                                window.open(url, "_blank");
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Abrir workspace
                            </DropdownMenuItem>
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
                            <DropdownMenuItem onClick={() => { setPlanClient(client); setPlanSelected("essencial"); }}>
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

        {/* ───────── TAB: CONVITES PENDENTES ───────── */}
        <TabsContent value="invites" className="space-y-4">
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum convite pendente.
                    </TableCell>
                  </TableRow>
                ) : (
                  invites.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell className="font-medium">{invite.full_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{invite.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{invite.plan}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={invite.invite_type === "checkout" ? "secondary" : "outline"}>
                          {invite.invite_type === "checkout" ? "Stripe" : "Gratuito"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="bg-amber-500/10 text-amber-600 border-amber-200">
                          Aguardando
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(invite.created_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        {invite.checkout_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={async () => {
                              await navigator.clipboard.writeText(invite.checkout_url!);
                              toast({ title: "Link de checkout copiado!" });
                            }}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ───────── TAB: CADÊNCIA DE REATIVAÇÃO ───────── */}
        <TabsContent value="cadence" className="space-y-6">
          {cadenceLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : cadenceConfig ? (
            <>
              {/* General config card */}
              <Card className="max-w-2xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CalendarClock className="w-5 h-5" />
                        Cadência de Reativação
                      </CardTitle>
                      <CardDescription>
                        Envio automático de cobranças para clientes com trial expirado.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {cadenceConfig.is_active ? "Ativa" : "Pausada"}
                      </span>
                      <Switch
                        checked={cadenceConfig.is_active}
                        onCheckedChange={(v) => setCadenceConfig({ ...cadenceConfig, is_active: v })}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Cadence days */}
                  <div className="space-y-2">
                    <Label>Dias de envio (relativo ao vencimento do trial)</Label>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">📩 Signup & Trial (antes do vencimento)</p>
                        <div className="flex flex-wrap gap-2">
                          {[-7, -6, -5, -4, -3, -2, -1].map((day) => {
                            const isSelected = cadenceConfig.cadence_days.includes(day);
                            const dayLabels: Record<number, string> = {
                              [-7]: "Signup",
                              [-6]: "Dia 2",
                              [-5]: "Dia 3",
                              [-4]: "Dia 4",
                              [-3]: "Dia 5",
                              [-2]: "Dia 6",
                              [-1]: "Último dia",
                            };
                            return (
                              <Button
                                key={day}
                                type="button"
                                size="sm"
                                variant={isSelected ? "default" : "outline"}
                                className="h-8"
                                onClick={() => {
                                  const newDays = isSelected
                                    ? cadenceConfig.cadence_days.filter((d) => d !== day)
                                    : [...cadenceConfig.cadence_days, day].sort((a, b) => a - b);
                                  setCadenceConfig({ ...cadenceConfig, cadence_days: newDays });
                                }}
                              >
                                {dayLabels[day] || day}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">🔒 Vencimento & Pós-trial</p>
                        <div className="flex flex-wrap gap-2">
                          {[0, 1, 2, 3, 5, 7, 10, 14, 21, 30].map((day) => {
                            const isSelected = cadenceConfig.cadence_days.includes(day);
                            return (
                              <Button
                                key={day}
                                type="button"
                                size="sm"
                                variant={isSelected ? "default" : "outline"}
                                className="h-8 min-w-10"
                                onClick={() => {
                                  const newDays = isSelected
                                    ? cadenceConfig.cadence_days.filter((d) => d !== day)
                                    : [...cadenceConfig.cadence_days, day].sort((a, b) => a - b);
                                  setCadenceConfig({ ...cadenceConfig, cadence_days: newDays });
                                }}
                              >
                                {day === 0 ? "Vencimento" : `+${day}`}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Selecionados: {cadenceConfig.cadence_days.map(d => {
                        const labels: Record<number, string> = { [-7]: "Signup", [-6]: "Dia 2", [-5]: "Dia 3", [-4]: "Dia 4", [-3]: "Dia 5", [-2]: "Dia 6", [-1]: "Último dia", [0]: "Vencimento" };
                        return labels[d] || (d > 0 ? `+${d}` : String(d));
                      }).join(", ")}
                    </p>
                  </div>

                  <Separator />

                  {/* Channels */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium">WhatsApp</span>
                      </div>
                      <Switch
                        checked={cadenceConfig.send_whatsapp}
                        onCheckedChange={(v) => setCadenceConfig({ ...cadenceConfig, send_whatsapp: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium">E-mail</span>
                      </div>
                      <Switch
                        checked={cadenceConfig.send_email}
                        onCheckedChange={(v) => setCadenceConfig({ ...cadenceConfig, send_email: v })}
                      />
                    </div>
                  </div>

                  {/* WhatsApp instance */}
                  {cadenceConfig.send_whatsapp && (
                    <div className="space-y-2">
                      <Label>Instância WhatsApp (Evolution API)</Label>
                      <Select
                        value={cadenceConfig.whatsapp_instance_name || ""}
                        onValueChange={(v) =>
                          setCadenceConfig({ ...cadenceConfig, whatsapp_instance_name: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma instância" />
                        </SelectTrigger>
                        <SelectContent>
                          {evolutionInstances.length === 0 ? (
                            <SelectItem value="__none" disabled>
                              Nenhuma instância encontrada
                            </SelectItem>
                          ) : (
                            evolutionInstances.map((inst) => (
                              <SelectItem key={inst.instance_name} value={inst.instance_name}>
                                <div className="flex items-center gap-2">
                                  <span>{inst.display_name || inst.instance_name}</span>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {inst.instance_type}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Separator />

                  {/* Email fallback template */}
                  {cadenceConfig.send_email && (
                    <>
                      <div className="space-y-2">
                        <Label>Assunto do e-mail (fallback)</Label>
                        <Input
                          value={cadenceConfig.email_subject}
                          onChange={(e) =>
                            setCadenceConfig({ ...cadenceConfig, email_subject: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Template do e-mail (fallback)</Label>
                        <Textarea
                          rows={6}
                          value={cadenceConfig.email_template}
                          onChange={(e) =>
                            setCadenceConfig({ ...cadenceConfig, email_template: e.target.value })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Variáveis: {"{nome}"}, {"{link}"}, {"{dias_expirado}"}
                        </p>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div className="rounded-lg border border-dashed p-3 bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      💡 <strong>Mensagem de boas-vindas (signup):</strong> Para configurar mensagens enviadas no momento do cadastro, 
                      ative o dia <strong>"Signup"</strong> acima e adicione suas mensagens (texto ou áudio) na seção abaixo.
                      Se nenhuma mensagem for configurada para o dia do signup, o sistema usará a mensagem padrão.
                    </p>
                  </div>

                  <Button onClick={handleSaveCadence} disabled={cadenceSaving} className="w-full">
                    {cadenceSaving ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
                    ) : (
                      <><Check className="w-4 h-4 mr-2" /> Salvar configurações gerais</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* ── Mensagens por dia de cadência ── */}
              <Card className="max-w-2xl">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Mensagens por dia de cadência
                  </CardTitle>
                  <CardDescription>
                    Configure múltiplas mensagens (texto ou áudio) para cada dia. 
                    Elas são enviadas em ordem, com intervalo de ~2s entre cada.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept=".ogg,.mp3,.m4a,.wav,audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      const idx = audioInputRef.current?.dataset.messageIndex;
                      if (file && idx !== undefined) {
                        handleAudioUpload(file, Number(idx));
                      }
                      e.target.value = "";
                    }}
                  />

                  <Accordion type="multiple" className="w-full">
                    {cadenceConfig.cadence_days.map((day) => {
                      const dayMsgs = cadenceMessages
                        .map((m, idx) => ({ ...m, _idx: idx }))
                        .filter(m => m.cadence_day === day);
                      const dayLabelsMap: Record<number, string> = {
                        [-7]: "📩 Signup (boas-vindas)",
                        [-6]: "📅 Dia 2 do trial",
                        [-5]: "📅 Dia 3 do trial",
                        [-4]: "📅 Dia 4 do trial",
                        [-3]: "📅 Dia 5 do trial",
                        [-2]: "⚠️ Dia 6 (penúltimo)",
                        [-1]: "🚨 Último dia do trial",
                        [0]: "🔒 Dia do vencimento",
                      };
                      const dayLabel = dayLabelsMap[day] || (day > 0 ? `+${day} dias após vencimento` : `${day} dias`);
                      const whatsappCount = dayMsgs.filter(m => m.channel === "whatsapp").length;
                      const emailCount = dayMsgs.filter(m => m.channel === "email").length;

                      return (
                        <AccordionItem key={day} value={`day-${day}`}>
                          <AccordionTrigger className="text-sm">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="font-mono text-xs">
                                {day === -7 ? "Signup" : day > 0 ? `+${day}` : day}
                              </Badge>
                              <span>{dayLabel}</span>
                              {whatsappCount > 0 && (
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <MessageSquare className="w-3 h-3" />{whatsappCount}
                                </Badge>
                              )}
                              {emailCount > 0 && (
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <Mail className="w-3 h-3" />{emailCount}
                                </Badge>
                              )}
                              {dayMsgs.length === 0 && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">sem mensagens</Badge>
                              )}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3 pt-2">
                            {dayMsgs.length === 0 && (
                              <p className="text-xs text-muted-foreground text-center py-2">
                                Nenhuma mensagem configurada. {day === -7 ? "O sistema usará a mensagem padrão de boas-vindas." : "O sistema usará os templates padrão."}
                              </p>
                            )}

                            {dayMsgs.map((msg, posInDay) => (
                              <div key={msg._idx} className="rounded-lg border p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="text-xs">
                                      #{posInDay + 1}
                                    </Badge>
                                    {/* Channel toggle */}
                                    <div className="flex rounded-md border overflow-hidden">
                                      <button
                                        type="button"
                                        className={`px-2 py-1 text-xs flex items-center gap-1 ${msg.channel === "whatsapp" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                                        onClick={() => updateCadenceMessage(msg._idx, { channel: "whatsapp" })}
                                      >
                                        <MessageSquare className="w-3 h-3" /> WhatsApp
                                      </button>
                                      <button
                                        type="button"
                                        className={`px-2 py-1 text-xs flex items-center gap-1 ${msg.channel === "email" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                                        onClick={() => updateCadenceMessage(msg._idx, { channel: "email", message_type: "text" })}
                                      >
                                        <Mail className="w-3 h-3" /> E-mail
                                      </button>
                                    </div>
                                    {/* Type toggle (only for whatsapp) */}
                                    {msg.channel === "whatsapp" && (
                                      <div className="flex rounded-md border overflow-hidden">
                                        <button
                                          type="button"
                                          className={`px-2 py-1 text-xs flex items-center gap-1 ${msg.message_type === "text" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                                          onClick={() => updateCadenceMessage(msg._idx, { message_type: "text" })}
                                        >
                                          <Type className="w-3 h-3" /> Texto
                                        </button>
                                        <button
                                          type="button"
                                          className={`px-2 py-1 text-xs flex items-center gap-1 ${msg.message_type === "audio" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                                          onClick={() => updateCadenceMessage(msg._idx, { message_type: "audio" })}
                                        >
                                          <Music className="w-3 h-3" /> Áudio
                                        </button>
                                      </div>
                                    )}
                                    <Switch
                                      checked={msg.is_active}
                                      onCheckedChange={(v) => updateCadenceMessage(msg._idx, { is_active: v })}
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      disabled={posInDay === 0}
                                      onClick={() => moveCadenceMessage(msg._idx, "up")}
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      disabled={posInDay === dayMsgs.length - 1}
                                      onClick={() => moveCadenceMessage(msg._idx, "down")}
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive"
                                      onClick={() => removeCadenceMessage(msg._idx)}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>

                                {msg.channel === "email" && msg.message_type === "text" && (
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Assunto do e-mail</Label>
                                    <Input
                                      value={msg.subject || ""}
                                      onChange={(e) => updateCadenceMessage(msg._idx, { subject: e.target.value })}
                                      placeholder="Ex: {nome}, seu trial acaba em breve!"
                                    />
                                  </div>
                                )}

                                {msg.message_type === "text" ? (
                                  <div className="space-y-1">
                                    <Textarea
                                      rows={4}
                                      value={msg.content || ""}
                                      onChange={(e) => updateCadenceMessage(msg._idx, { content: e.target.value })}
                                      placeholder="Digite a mensagem... Variáveis: {nome}, {link}, {dias_expirado}"
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                      Variáveis: {"{nome}"}, {"{link}"}, {"{dias_expirado}"}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {msg.audio_url ? (
                                      <div className="flex items-center gap-2">
                                        <audio controls src={msg.audio_url} className="flex-1 h-8" />
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-destructive"
                                          onClick={() => updateCadenceMessage(msg._idx, { audio_url: null })}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={uploadingAudio === String(msg._idx)}
                                        onClick={() => {
                                          if (audioInputRef.current) {
                                            audioInputRef.current.dataset.messageIndex = String(msg._idx);
                                            audioInputRef.current.click();
                                          }
                                        }}
                                      >
                                        {uploadingAudio === String(msg._idx) ? (
                                          <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Enviando...</>
                                        ) : (
                                          <><Upload className="w-3 h-3 mr-1" /> Enviar áudio (.ogg, .mp3)</>
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}

                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => addCadenceMessage(day, "whatsapp")}
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                <MessageSquare className="w-3 h-3 mr-1" /> WhatsApp
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => addCadenceMessage(day, "email")}
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                <Mail className="w-3 h-3 mr-1" /> E-mail
                              </Button>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>

                  <Button onClick={handleSaveCadenceMessages} disabled={cadenceMessagesSaving} className="w-full">
                    {cadenceMessagesSaving ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando mensagens...</>
                    ) : (
                      <><Check className="w-4 h-4 mr-2" /> Salvar mensagens de cadência</>
                    )}
                  </Button>
                </CardContent>
              </Card>


              {/* ── Métricas de Conversão da Cadência ── */}
              <CadenceMetricsPanel />

              {/* Recent reactivation log */}
              <Card className="max-w-2xl">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Histórico de envios recentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {reactivationLog.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum envio de reativação realizado ainda.
                    </p>
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Canal</TableHead>
                            <TableHead>Dia</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reactivationLog.slice(0, 20).map((log: any) => (
                            <TableRow key={log.id}>
                              <TableCell className="text-sm">
                                {format(new Date(log.sent_at), "dd/MM/yyyy HH:mm")}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="gap-1">
                                  {log.channel === "whatsapp" ? (
                                    <MessageSquare className="w-3 h-3" />
                                  ) : (
                                    <Mail className="w-3 h-3" />
                                  )}
                                  {log.channel === "whatsapp" ? "WhatsApp" : "E-mail"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">Dia {log.cadence_day}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={log.status === "sent" ? "default" : "destructive"}
                                  className={log.status === "sent" ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" : ""}
                                >
                                  {log.status === "sent" ? "Enviado" : log.status === "failed" ? "Falhou" : "Pulado"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="text-muted-foreground text-center py-8">Erro ao carregar configuração.</p>
          )}
        </TabsContent>

        {/* ───────── TAB: PRÉ-COBRANÇA ───────── */}
        <TabsContent value="pre-billing">
          <PreBillingCadencePanel />
        </TabsContent>

        {/* ───────── TAB: SAÚDE & MONITORAMENTO ───────── */}
        <TabsContent value="health">
          <WorkspaceHealthTab />
        </TabsContent>

        {/* ───────── TAB: DASHBOARD EXECUTIVO ───────── */}
        <TabsContent value="executive">
          <ExecutiveDashboardTab />
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

              {(selectedClient.owner?.personal_whatsapp || selectedClient.owner?.phone) && (
                <Button
                  onClick={() => handleStartConversation(selectedClient)}
                  className="w-full"
                  variant="default"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Abrir conversa com este cliente
                </Button>
              )}

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
                  {getPlanBadge(selectedClient)}
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

      {/* ───────── BULK WHATSAPP DIALOG ───────── */}
      <Dialog open={bulkWhatsappOpen} onOpenChange={setBulkWhatsappOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Enviar WhatsApp em massa
            </DialogTitle>
            <DialogDescription>
              Enviar mensagem para {selectedIds.size} cliente{selectedIds.size > 1 ? "s" : ""} selecionado{selectedIds.size > 1 ? "s" : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Instância WhatsApp</Label>
              <Select value={bulkInstance} onValueChange={setBulkInstance}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma instância" />
                </SelectTrigger>
                <SelectContent>
                  {evolutionInstances.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      Nenhuma instância encontrada
                    </SelectItem>
                  ) : (
                    evolutionInstances.map((inst) => (
                      <SelectItem key={inst.instance_name} value={inst.instance_name}>
                        <div className="flex items-center gap-2">
                          <span>{inst.display_name || inst.instance_name}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {inst.instance_type}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                rows={6}
                value={bulkMessage}
                onChange={(e) => setBulkMessage(e.target.value)}
                placeholder="Digite a mensagem..."
              />
              <p className="text-xs text-muted-foreground">
                Variáveis: {"{nome}"}, {"{workspace}"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkWhatsappOpen(false)} disabled={bulkSending}>
              Cancelar
            </Button>
            <Button onClick={handleBulkWhatsapp} disabled={bulkSending || !bulkInstance || !bulkMessage}>
              {bulkSending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Enviando...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Enviar para {selectedIds.size}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
