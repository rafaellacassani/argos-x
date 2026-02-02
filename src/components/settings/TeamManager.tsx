import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Trash2,
  Phone,
  MessageSquare,
  Shield,
  UserCog,
  BadgeCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTeam, type AppRole, type UserProfile, type NotificationSettings } from "@/hooks/useTeam";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<AppRole, { label: string; icon: React.ElementType; color: string }> = {
  admin: { label: "Administrador", icon: Shield, color: "#EF4444" },
  manager: { label: "Gestor", icon: UserCog, color: "#8B5CF6" },
  seller: { label: "Vendedor", icon: BadgeCheck, color: "#22C55E" },
};

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface MemberEditorProps {
  member?: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    full_name: string;
    phone: string;
    email?: string;
    roles: AppRole[];
  }) => Promise<void>;
  onSaveNotifications?: (settings: Partial<NotificationSettings>) => Promise<void>;
  initialNotifications?: NotificationSettings | null;
  isNew?: boolean;
}

function MemberEditor({
  member,
  isOpen,
  onClose,
  onSave,
  onSaveNotifications,
  initialNotifications,
  isNew = false,
}: MemberEditorProps) {
  const [isActive, setIsActive] = useState(true);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("seller");
  
  // Notification settings
  const [notifyNoResponse, setNotifyNoResponse] = useState(true);
  const [noResponseMinutes, setNoResponseMinutes] = useState(10);
  const [notifyWeeklyReport, setNotifyWeeklyReport] = useState(true);
  const [weeklyReportDay, setWeeklyReportDay] = useState(1);
  const [weeklyReportHour, setWeeklyReportHour] = useState(9);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (member) {
      setFullName(member.full_name);
      setPhone(member.phone || "");
      setEmail(member.email || "");
      setSelectedRole(member.roles[0] || "seller");
      setIsActive(true);
    } else {
      setFullName("");
      setPhone("");
      setEmail("");
      setSelectedRole("seller");
      setIsActive(true);
    }
  }, [member, isOpen]);

  useEffect(() => {
    if (initialNotifications) {
      setNotifyNoResponse(initialNotifications.notify_no_response);
      setNoResponseMinutes(initialNotifications.no_response_minutes);
      setNotifyWeeklyReport(initialNotifications.notify_weekly_report);
      setWeeklyReportDay(initialNotifications.weekly_report_day);
      setWeeklyReportHour(initialNotifications.weekly_report_hour);
    } else {
      setNotifyNoResponse(true);
      setNoResponseMinutes(10);
      setNotifyWeeklyReport(true);
      setWeeklyReportDay(1);
      setWeeklyReportHour(9);
    }
  }, [initialNotifications, isOpen]);

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11)
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleSave = async () => {
    if (!fullName.trim() || !phone.trim()) return;

    setSaving(true);
    try {
      await onSave({
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        roles: [selectedRole],
      });

      if (onSaveNotifications && !isNew) {
        await onSaveNotifications({
          notify_no_response: notifyNoResponse,
          no_response_minutes: noResponseMinutes,
          notify_weekly_report: notifyWeeklyReport,
          weekly_report_day: weeklyReportDay,
          weekly_report_hour: weeklyReportHour,
        });
      }

      onClose();
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-background max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <span className="text-sm text-muted-foreground">
            {isNew ? "Novo membro" : "Editar membro"}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!fullName.trim() || !phone.trim() || saving}
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        {/* Profile Section */}
        <div className="p-6 border-b">
          <div className="flex gap-6">
            {/* Avatar */}
            <Avatar className="h-28 w-28 rounded-lg border-2 border-muted">
              <AvatarImage src={member?.avatar_url || undefined} />
              <AvatarFallback className="rounded-lg bg-gradient-to-br from-primary to-secondary text-primary-foreground text-2xl font-semibold">
                {fullName ? getInitials(fullName) : "?"}
              </AvatarFallback>
            </Avatar>

            {/* Form Fields */}
            <div className="flex-1 space-y-4">
              {/* Activity Toggle */}
              <div className="flex items-center gap-3">
                <Label className="text-muted-foreground">Atividade</Label>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  className="data-[state=checked]:bg-secondary"
                />
              </div>

              {/* Name */}
              <div className="grid grid-cols-[100px_1fr] items-center gap-2">
                <Label className="text-muted-foreground">Nome</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nome completo"
                  className="bg-background"
                />
              </div>

              {/* Email */}
              <div className="grid grid-cols-[100px_1fr] items-center gap-2">
                <Label className="text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="bg-background"
                />
              </div>

              {/* Phone - WhatsApp */}
              <div className="grid grid-cols-[100px_1fr] items-center gap-2">
                <Label className="text-muted-foreground flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  WhatsApp
                </Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(27) 99999-9999"
                  className="bg-background"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Role Tabs */}
        <div className="px-6 pt-4">
          <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
            <TabsList className="h-auto p-1 bg-muted/50">
                  {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => {
                    const { label, icon: Icon, color } = ROLE_LABELS[role];
                    return (
                      <TabsTrigger
                        key={role}
                        value={role}
                        className="flex items-center gap-2 px-4 py-2 data-[state=active]:shadow-sm"
                        style={{
                          color: selectedRole === role ? color : undefined,
                        }}
                      >
                    <Icon className="h-4 w-4" />
                    {label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* Notification Settings */}
        <div className="p-6 space-y-6">
          <div>
            <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-success" />
              Notificações via WhatsApp
            </h4>

            <div className="space-y-4">
              {/* No Response Alert */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                <div className="flex-1">
                  <p className="text-sm font-medium">Alerta de cliente sem resposta</p>
                  <p className="text-xs text-muted-foreground">
                    Receber aviso quando um cliente aguardar mais do que o tempo definido
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {notifyNoResponse && (
                    <Select
                      value={noResponseMinutes.toString()}
                      onValueChange={(v) => setNoResponseMinutes(Number(v))}
                    >
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="5">5 min</SelectItem>
                        <SelectItem value="10">10 min</SelectItem>
                        <SelectItem value="15">15 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="60">1 hora</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Switch
                    checked={notifyNoResponse}
                    onCheckedChange={setNotifyNoResponse}
                  />
                </div>
              </div>

              {/* Weekly Report - Only for managers */}
              {selectedRole === "manager" && (
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                  <div className="flex-1">
                    <p className="text-sm font-medium">Relatório semanal de vendas</p>
                    <p className="text-xs text-muted-foreground">
                      Receber resumo com ranking de vendedores e métricas
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {notifyWeeklyReport && (
                      <div className="flex gap-2">
                        <Select
                          value={weeklyReportDay.toString()}
                          onValueChange={(v) => setWeeklyReportDay(Number(v))}
                        >
                          <SelectTrigger className="w-24 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            {DAY_LABELS.map((day, idx) => (
                              <SelectItem key={idx} value={idx.toString()}>
                                {day}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={weeklyReportHour.toString()}
                          onValueChange={(v) => setWeeklyReportHour(Number(v))}
                        >
                          <SelectTrigger className="w-20 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover max-h-48">
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i.toString().padStart(2, "0")}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Switch
                      checked={notifyWeeklyReport}
                      onCheckedChange={setNotifyWeeklyReport}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
            <strong>📱 Importante:</strong> As notificações serão enviadas para o WhatsApp
            cadastrado acima, via Marketing Boost. Certifique-se de que o número está correto
            e ativo.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TeamManager() {
  const {
    loading,
    teamMembers,
    fetchTeamMembers,
    createTeamMember,
    updateTeamMember,
    deleteTeamMember,
    fetchNotificationSettings,
    updateNotificationSettings,
  } = useTeam();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);
  const [editingNotifications, setEditingNotifications] = useState<NotificationSettings | null>(null);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  const openCreate = () => {
    setEditingMember(null);
    setEditingNotifications(null);
    setIsEditorOpen(true);
  };

  const openEdit = async (member: UserProfile) => {
    setEditingMember(member);
    const settings = await fetchNotificationSettings(member.user_id);
    setEditingNotifications(settings);
    setIsEditorOpen(true);
  };

  const handleSave = async (data: {
    full_name: string;
    phone: string;
    email?: string;
    roles: AppRole[];
  }) => {
    if (editingMember) {
      await updateTeamMember(editingMember.user_id, data);
    } else {
      await createTeamMember(data);
    }
    await fetchTeamMembers();
  };

  const handleSaveNotifications = async (settings: Partial<NotificationSettings>) => {
    if (editingMember) {
      await updateNotificationSettings(editingMember.user_id, settings);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Equipe & Notificações
            </CardTitle>
            <CardDescription>
              Gerencie sua equipe e configure alertas por WhatsApp
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Membro
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando equipe...
          </div>
        ) : teamMembers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum membro cadastrado</p>
            <p className="text-sm">
              Adicione membros da equipe para receber alertas por WhatsApp
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="w-10"></div>
              <div>Nome</div>
              <div>Função</div>
              <div>WhatsApp</div>
              <div className="w-20 text-center">Ações</div>
            </div>

            {/* Table Body */}
            <AnimatePresence>
              {teamMembers.map((member, idx) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn(
                    "grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-3 items-center hover:bg-muted/30 transition-colors cursor-pointer",
                    idx !== teamMembers.length - 1 && "border-b"
                  )}
                  onClick={() => openEdit(member)}
                >
                  {/* Avatar */}
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground font-semibold text-sm">
                      {member.full_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name & Email */}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{member.full_name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {member.email || "Sem email"}
                    </p>
                  </div>

                  {/* Role */}
                  <div className="flex gap-1">
                    {member.roles.map((role) => {
                      const { label, color } = ROLE_LABELS[role];
                      return (
                        <Badge
                          key={role}
                          variant="secondary"
                          className="text-xs"
                          style={{
                            backgroundColor: color + "20",
                            color: color,
                          }}
                        >
                          {label}
                        </Badge>
                      );
                    })}
                  </div>

                  {/* Phone */}
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {member.phone || "—"}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-background">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {member.full_name} será removido da equipe e não receberá mais
                            notificações.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteTeamMember(member.user_id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Info box */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-dashed">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-success" />
            Como funcionam as notificações
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>
              • <strong>Administradores:</strong> Recebem alertas de TODOS os clientes sem
              resposta
            </li>
            <li>
              • <strong>Vendedores:</strong> Recebem alertas apenas dos SEUS clientes (leads
              atribuídos)
            </li>
            <li>
              • <strong>Gestores:</strong> Recebem relatório semanal com ranking de vendedores e
              métricas
            </li>
          </ul>
        </div>
      </CardContent>

      {/* Member Editor Modal */}
      <MemberEditor
        member={editingMember}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingMember(null);
          setEditingNotifications(null);
        }}
        onSave={handleSave}
        onSaveNotifications={editingMember ? handleSaveNotifications : undefined}
        initialNotifications={editingNotifications}
        isNew={!editingMember}
      />
    </Card>
  );
}
