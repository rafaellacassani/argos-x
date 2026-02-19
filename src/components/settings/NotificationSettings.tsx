import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  AlertTriangle,
  Wifi,
  WifiOff,
  Settings2,
  Phone,
  Shield,
  UserCog,
  BadgeCheck,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ConnectionModal } from "@/components/whatsapp/ConnectionModal";
import { useEvolutionAPI, type EvolutionInstance } from "@/hooks/useEvolutionAPI";
import { useTeam, type UserProfile, type AppRole } from "@/hooks/useTeam";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const ROLE_LABELS: Record<AppRole, { label: string; icon: React.ElementType; color: string }> = {
  admin: { label: "Admin", icon: Shield, color: "#EF4444" },
  manager: { label: "Gestor", icon: UserCog, color: "#8B5CF6" },
  seller: { label: "Vendedor", icon: BadgeCheck, color: "#22C55E" },
};

interface NotificationPrefs {
  id?: string;
  user_profile_id: string;
  workspace_id: string;
  no_response_enabled: boolean;
  no_response_minutes: number;
  daily_report_enabled: boolean;
  daily_report_time: string;
  manager_report_enabled: boolean;
  manager_report_frequency: string;
  manager_report_time: string;
  manager_report_day_of_week: number;
  new_lead_alert_enabled: boolean;
}

const DEFAULT_PREFS: Omit<NotificationPrefs, "user_profile_id" | "workspace_id"> = {
  no_response_enabled: true,
  no_response_minutes: 30,
  daily_report_enabled: true,
  daily_report_time: "19:00",
  manager_report_enabled: false,
  manager_report_frequency: "daily",
  manager_report_time: "19:00",
  manager_report_day_of_week: 1,
  new_lead_alert_enabled: false,
};

const formatPhone = (value: string) => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 2) return `+55 (${numbers}`;
  if (numbers.length <= 4) return `+55 (${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 9)
    return `+55 (${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  return `+55 (${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

const cleanPhoneInput = (value: string) => {
  return value.replace(/\D/g, "").slice(0, 11);
};

export function NotificationSettings() {
  const { user } = useAuth();
  const { isAdmin, isAdminOrManager, isSeller, userProfileId } = useUserRole();
  const { workspace, workspaceId } = useWorkspace();
  const { teamMembers, fetchTeamMembers } = useTeam();
  const { listInstances, getConnectionState } = useEvolutionAPI();

  // Alert instance state
  const [alertInstanceMode, setAlertInstanceMode] = useState<"existing" | "new">("existing");
  const [alertInstanceName, setAlertInstanceName] = useState<string>("");
  const [instances, setInstances] = useState<(EvolutionInstance & { instanceType?: string })[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [alertInstanceStatus, setAlertInstanceStatus] = useState<"open" | "close" | "connecting" | "unknown">("unknown");
  const [showConnectionModal, setShowConnectionModal] = useState(false);

  // Member alerts modal
  const [selectedMember, setSelectedMember] = useState<UserProfile | null>(null);
  const [memberPrefs, setMemberPrefs] = useState<NotificationPrefs | null>(null);
  const [memberWhatsapp, setMemberWhatsapp] = useState("");
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(false);

  // Load instances and alert config
  const loadInstances = useCallback(async () => {
    setLoadingInstances(true);
    try {
      // Load all instances from DB (including alerts type)
      const { data: localInstances } = await supabase
        .from("whatsapp_instances")
        .select("*");

      if (!localInstances?.length) {
        setInstances([]);
        setLoadingInstances(false);
        return;
      }

      // Get Evolution API status
      const data = await listInstances();
      
      const merged = localInstances.map((local) => {
        const remote = data.find((d) => d.instanceName === local.instance_name);
        return {
          instanceName: local.instance_name,
          instanceId: remote?.instanceId,
          profileName: remote?.profileName || local.display_name || local.instance_name,
          connectionStatus: remote?.connectionStatus || ("close" as const),
          ownerJid: remote?.ownerJid,
          instanceType: (local as any).instance_type || "commercial",
        };
      });

      setInstances(merged);

      // Load current workspace alert instance
      if (workspace?.alert_instance_name) {
        setAlertInstanceName(workspace.alert_instance_name);
        const matched = merged.find((i) => i.instanceName === workspace.alert_instance_name);
        if (matched) {
          const state = await getConnectionState(matched.instanceName);
          setAlertInstanceStatus(state?.instance?.state || "close");
        }
      }
    } catch (err) {
      console.error("Error loading instances:", err);
    } finally {
      setLoadingInstances(false);
    }
  }, [listInstances, getConnectionState, workspace]);

  useEffect(() => {
    loadInstances();
    fetchTeamMembers();
  }, []);

  // Save alert instance selection
  const handleSaveAlertInstance = async (instanceName: string) => {
    if (!workspaceId) return;
    try {
      const { error } = await supabase
        .from("workspaces")
        .update({ alert_instance_name: instanceName } as any)
        .eq("id", workspaceId);
      if (error) throw error;
      setAlertInstanceName(instanceName);
      
      // Check connection status
      const state = await getConnectionState(instanceName);
      setAlertInstanceStatus(state?.instance?.state || "close");
      
      toast({ title: "WhatsApp de alertas configurado", description: `Instância "${instanceName}" definida para envio de alertas.` });
    } catch (err) {
      console.error("Error saving alert instance:", err);
      toast({ title: "Erro", description: "Não foi possível salvar a configuração.", variant: "destructive" });
    }
  };

  // Handle new alert instance connected
  const handleAlertInstanceConnected = async () => {
    await loadInstances();
    // The ConnectionModal saves with instance_type = 'alerts' if we pass it
  };

  // Open member alert config modal
  const openMemberAlerts = async (member: UserProfile) => {
    // Sellers can't edit their own alerts
    if (isSeller && member.user_id === user?.id) {
      toast({ title: "Acesso restrito", description: "Seus alertas são configurados pelo seu gestor." });
      return;
    }

    setSelectedMember(member);
    setLoadingPrefs(true);

    // Load personal_whatsapp
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("personal_whatsapp")
      .eq("id", member.id)
      .single();
    setMemberWhatsapp((profile as any)?.personal_whatsapp || "");

    // Load notification preferences
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_profile_id", member.id)
      .eq("workspace_id", workspaceId!)
      .maybeSingle();

    if (prefs) {
      setMemberPrefs(prefs as any);
    } else {
      setMemberPrefs({
        user_profile_id: member.id,
        workspace_id: workspaceId!,
        ...DEFAULT_PREFS,
      });
    }
    setLoadingPrefs(false);
  };

  // Save member preferences
  const handleSavePrefs = async () => {
    if (!memberPrefs || !selectedMember || !workspaceId) return;

    // Validate whatsapp
    const cleanedPhone = memberWhatsapp.replace(/\D/g, "");
    if (
      (memberPrefs.no_response_enabled || memberPrefs.daily_report_enabled || 
       memberPrefs.manager_report_enabled || memberPrefs.new_lead_alert_enabled) &&
      cleanedPhone.length < 10
    ) {
      toast({ title: "WhatsApp obrigatório", description: "Informe o WhatsApp pessoal antes de ativar alertas.", variant: "destructive" });
      return;
    }

    // Validate alert instance
    if (
      (memberPrefs.no_response_enabled || memberPrefs.daily_report_enabled || 
       memberPrefs.manager_report_enabled || memberPrefs.new_lead_alert_enabled) &&
      !alertInstanceName
    ) {
      toast({ title: "Instância não configurada", description: "Configure o WhatsApp de alertas nas configurações acima.", variant: "destructive" });
      return;
    }

    setSavingPrefs(true);
    try {
      // Save personal_whatsapp
      await supabase
        .from("user_profiles")
        .update({ personal_whatsapp: memberWhatsapp || null } as any)
        .eq("id", selectedMember.id);

      // Upsert notification preferences
      const { id, ...prefsData } = memberPrefs;
      if (id) {
        await supabase
          .from("notification_preferences")
          .update(prefsData as any)
          .eq("id", id);
      } else {
        await supabase
          .from("notification_preferences")
          .insert(prefsData as any);
      }

      toast({ title: "Alertas salvos", description: `Preferências de ${selectedMember.full_name} atualizadas.` });
      setSelectedMember(null);
    } catch (err) {
      console.error("Error saving preferences:", err);
      toast({ title: "Erro ao salvar", description: "Não foi possível salvar as preferências.", variant: "destructive" });
    } finally {
      setSavingPrefs(false);
    }
  };

  const isMemberSeller = (member: UserProfile) => member.roles.includes("seller") && !member.roles.includes("admin") && !member.roles.includes("manager");

  const commercialInstances = instances.filter((i) => i.instanceType === "commercial");
  const alertInstances = instances.filter((i) => i.instanceType === "alerts");
  const allAvailableInstances = [...commercialInstances, ...alertInstances];

  return (
    <div className="space-y-6">
      {/* AREA 1: WhatsApp de Alertas (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              WhatsApp de Alertas
            </CardTitle>
            <CardDescription>
              Defina qual número WhatsApp será usado para enviar alertas e relatórios para sua equipe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!alertInstanceName && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-warning text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Configure um WhatsApp para alertas para ativar notificações da equipe
              </div>
            )}

            <RadioGroup
              value={alertInstanceMode}
              onValueChange={(v) => setAlertInstanceMode(v as "existing" | "new")}
              className="space-y-3"
            >
              {/* Option 1: Use existing */}
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
                <RadioGroupItem value="existing" id="existing" className="mt-0.5" />
                <div className="flex-1 space-y-2">
                  <Label htmlFor="existing" className="font-medium cursor-pointer">
                    Usar conexão existente
                  </Label>
                  {alertInstanceMode === "existing" && (
                    <Select
                      value={alertInstanceName || "__none__"}
                      onValueChange={(v) => {
                        if (v !== "__none__") handleSaveAlertInstance(v);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione uma instância" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecione...</SelectItem>
                        {allAvailableInstances.map((inst) => (
                          <SelectItem key={inst.instanceName} value={inst.instanceName}>
                            📱 {inst.profileName || inst.instanceName}
                            {inst.instanceType === "alerts" ? " (alertas)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Option 2: Connect new */}
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
                <RadioGroupItem value="new" id="new" className="mt-0.5" />
                <div className="flex-1 space-y-2">
                  <Label htmlFor="new" className="font-medium cursor-pointer">
                    Conectar novo número dedicado a alertas
                  </Label>
                  {alertInstanceMode === "new" && (
                    <Button
                      variant="outline"
                      onClick={() => setShowConnectionModal(true)}
                      className="w-full"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Conectar via QR Code
                    </Button>
                  )}
                </div>
              </div>
            </RadioGroup>

            {/* Connection status */}
            {alertInstanceName && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">Status:</span>
                {alertInstanceStatus === "open" ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    <Wifi className="h-3 w-3 mr-1" />
                    Conectado
                  </Badge>
                ) : (
                  <>
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                      <WifiOff className="h-3 w-3 mr-1" />
                      Desconectado
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowConnectionModal(true)}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Reconectar
                    </Button>
                  </>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {alertInstanceName}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AREA 2: Alertas por Membro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Alertas por Membro
          </CardTitle>
          <CardDescription>
            Configure alertas individuais para cada membro da equipe
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">Nenhum membro cadastrado</p>
          ) : (
            <div className="space-y-2">
              {teamMembers.map((member) => {
                const roleKey = member.roles[0] || "seller";
                const { label: roleLabel, color: roleColor } = ROLE_LABELS[roleKey];
                const canEdit = isAdmin || (isAdminOrManager && isMemberSeller(member));
                const isSelf = member.user_id === user?.id;
                const canOpenModal = isAdmin || (isAdminOrManager && (isMemberSeller(member) || isSelf));

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground font-semibold text-sm">
                        {member.full_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{member.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {(member as any).personal_whatsapp || member.phone || "Sem WhatsApp"}
                      </p>
                    </div>

                    <Badge
                      variant="secondary"
                      className="text-xs shrink-0"
                      style={{ backgroundColor: roleColor + "20", color: roleColor }}
                    >
                      {roleLabel}
                    </Badge>

                    {canOpenModal ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => openMemberAlerts(member)}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 opacity-50"
                        disabled
                        title="Seus alertas são configurados pelo seu gestor"
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Member Alert Config Modal */}
      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Alertas de {selectedMember?.full_name}
              {selectedMember && (
                <Badge
                  variant="secondary"
                  className="text-xs"
                  style={{
                    backgroundColor: ROLE_LABELS[selectedMember.roles[0] || "seller"].color + "20",
                    color: ROLE_LABELS[selectedMember.roles[0] || "seller"].color,
                  }}
                >
                  {ROLE_LABELS[selectedMember.roles[0] || "seller"].label}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Configure quais alertas este membro recebe via WhatsApp
            </DialogDescription>
          </DialogHeader>

          {loadingPrefs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : memberPrefs && (
            <div className="space-y-5">
              {/* Personal WhatsApp */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  WhatsApp pessoal
                </Label>
                <Input
                  value={memberWhatsapp ? formatPhone(cleanPhoneInput(memberWhatsapp)) : ""}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, "").slice(0, 11);
                    setMemberWhatsapp(cleaned);
                  }}
                  placeholder="+55 (27) 99999-0000"
                />
              </div>

              <Separator />

              {/* Seller-specific alerts */}
              {selectedMember && isMemberSeller(selectedMember) && (
                <>
                  {/* No-response alert */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Alerta sem resposta</Label>
                      <Switch
                        checked={memberPrefs.no_response_enabled}
                        onCheckedChange={(v) => setMemberPrefs({ ...memberPrefs, no_response_enabled: v })}
                      />
                    </div>
                    {memberPrefs.no_response_enabled && (
                      <div className="ml-1">
                        <Label className="text-xs text-muted-foreground">Lead fica sem resposta por:</Label>
                        <Select
                          value={String(memberPrefs.no_response_minutes)}
                          onValueChange={(v) => setMemberPrefs({ ...memberPrefs, no_response_minutes: Number(v) })}
                        >
                          <SelectTrigger className="w-32 h-8 mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10 min</SelectItem>
                            <SelectItem value="30">30 min</SelectItem>
                            <SelectItem value="60">60 min</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Daily report */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Relatório diário</Label>
                      <Switch
                        checked={memberPrefs.daily_report_enabled}
                        onCheckedChange={(v) => setMemberPrefs({ ...memberPrefs, daily_report_enabled: v })}
                      />
                    </div>
                    {memberPrefs.daily_report_enabled && (
                      <div className="ml-1">
                        <Label className="text-xs text-muted-foreground">Horário:</Label>
                        <Select
                          value={memberPrefs.daily_report_time}
                          onValueChange={(v) => setMemberPrefs({ ...memberPrefs, daily_report_time: v })}
                        >
                          <SelectTrigger className="w-32 h-8 mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["08:00", "09:00", "12:00", "17:00", "18:00", "19:00", "20:00"].map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">Resumo do dia enviado no WhatsApp</p>
                      </div>
                    )}
                  </div>

                  {/* New lead alert */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Alerta de novo lead</Label>
                      <p className="text-xs text-muted-foreground">Notificar quando novo lead chegar</p>
                    </div>
                    <Switch
                      checked={memberPrefs.new_lead_alert_enabled}
                      onCheckedChange={(v) => setMemberPrefs({ ...memberPrefs, new_lead_alert_enabled: v })}
                    />
                  </div>
                </>
              )}

              {/* Admin/Manager-specific alerts */}
              {selectedMember && !isMemberSeller(selectedMember) && (
                <>
                  {/* Manager report */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Relatório da equipe</Label>
                      <Switch
                        checked={memberPrefs.manager_report_enabled}
                        onCheckedChange={(v) => setMemberPrefs({ ...memberPrefs, manager_report_enabled: v })}
                      />
                    </div>
                    {memberPrefs.manager_report_enabled && (
                      <div className="ml-1 space-y-2">
                        <div>
                          <Label className="text-xs text-muted-foreground">Frequência:</Label>
                          <Select
                            value={memberPrefs.manager_report_frequency}
                            onValueChange={(v) => setMemberPrefs({ ...memberPrefs, manager_report_frequency: v })}
                          >
                            <SelectTrigger className="w-32 h-8 mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Diário</SelectItem>
                              <SelectItem value="weekly">Semanal</SelectItem>
                              <SelectItem value="monthly">Mensal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Horário:</Label>
                          <Select
                            value={memberPrefs.manager_report_time}
                            onValueChange={(v) => setMemberPrefs({ ...memberPrefs, manager_report_time: v })}
                          >
                            <SelectTrigger className="w-32 h-8 mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["08:00", "09:00", "12:00", "17:00", "18:00", "19:00", "20:00"].map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {memberPrefs.manager_report_frequency === "weekly" && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Dia da semana:</Label>
                            <Select
                              value={String(memberPrefs.manager_report_day_of_week)}
                              onValueChange={(v) => setMemberPrefs({ ...memberPrefs, manager_report_day_of_week: Number(v) })}
                            >
                              <SelectTrigger className="w-32 h-8 mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">Domingo</SelectItem>
                                <SelectItem value="1">Segunda</SelectItem>
                                <SelectItem value="2">Terça</SelectItem>
                                <SelectItem value="3">Quarta</SelectItem>
                                <SelectItem value="4">Quinta</SelectItem>
                                <SelectItem value="5">Sexta</SelectItem>
                                <SelectItem value="6">Sábado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {memberPrefs.manager_report_frequency === "monthly" && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Dia do mês:</Label>
                            <Select
                              value={String(memberPrefs.manager_report_day_of_week)}
                              onValueChange={(v) => setMemberPrefs({ ...memberPrefs, manager_report_day_of_week: Number(v) })}
                            >
                              <SelectTrigger className="w-32 h-8 mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 28 }, (_, i) => (
                                  <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* New lead alert */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Alerta de novo lead</Label>
                      <p className="text-xs text-muted-foreground">Notificar quando novo lead chegar</p>
                    </div>
                    <Switch
                      checked={memberPrefs.new_lead_alert_enabled}
                      onCheckedChange={(v) => setMemberPrefs({ ...memberPrefs, new_lead_alert_enabled: v })}
                    />
                  </div>

                  {/* No-response alert for team */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Alerta sem resposta da equipe</Label>
                        <p className="text-xs text-muted-foreground">Receber alerta quando leads dos seus vendedores ficam sem resposta</p>
                      </div>
                      <Switch
                        checked={memberPrefs.no_response_enabled}
                        onCheckedChange={(v) => setMemberPrefs({ ...memberPrefs, no_response_enabled: v })}
                      />
                    </div>
                    {memberPrefs.no_response_enabled && (
                      <div className="ml-1">
                        <Label className="text-xs text-muted-foreground">Tempo:</Label>
                        <Select
                          value={String(memberPrefs.no_response_minutes)}
                          onValueChange={(v) => setMemberPrefs({ ...memberPrefs, no_response_minutes: Number(v) })}
                        >
                          <SelectTrigger className="w-32 h-8 mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10 min</SelectItem>
                            <SelectItem value="30">30 min</SelectItem>
                            <SelectItem value="60">60 min</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMember(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePrefs} disabled={savingPrefs}>
              {savingPrefs ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connection Modal for dedicated alert instance */}
      <ConnectionModal
        open={showConnectionModal}
        onOpenChange={setShowConnectionModal}
        onSuccess={handleAlertInstanceConnected}
        instanceType="alerts"
      />
    </div>
  );
}
