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
  Bell,
  RefreshCw,
  MoreVertical,
  Pencil,
  Send,
  Lock,
  Globe,
} from "lucide-react";
import { SetPasswordDialog } from "@/components/shared/SetPasswordDialog";
import { SessionViewer } from "@/components/settings/SessionViewer";
import { useUserRole } from "@/hooks/useUserRole";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTeam, type AppRole, type UserProfile, type NotificationType } from "@/hooks/useTeam";
import { useWorkspace, type WorkspaceMember } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<AppRole, { label: string; icon: React.ElementType; color: string }> = {
  admin: { label: "Administrador", icon: Shield, color: "#EF4444" },
  manager: { label: "Gestor", icon: UserCog, color: "#8B5CF6" },
  seller: { label: "Vendedor", icon: BadgeCheck, color: "#22C55E" },
};

const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  weekly_report: "Dashboard semanal",
  no_response: "Sem resposta",
  both: "Ambos",
  none: "Nenhum",
};

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
  isNew?: boolean;
}

function MemberEditor({
  member,
  isOpen,
  onClose,
  onSave,
  isNew = false,
}: MemberEditorProps) {
  const [isActive, setIsActive] = useState(true);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("seller");
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

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11)
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSave = async () => {
    if (!fullName.trim() || !phone.trim()) return;
    if (isNew && (!email.trim() || !isValidEmail(email.trim()))) return;

    setSaving(true);
    try {
      await onSave({
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        roles: [selectedRole],
      });
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
              disabled={!fullName.trim() || !phone.trim() || (isNew && (!email.trim() || !isValidEmail(email.trim()))) || saving}
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
                <Label className="text-muted-foreground">
                  Email {isNew && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="bg-background"
                  required={isNew}
                />
              </div>
              {isNew && (
                <p className="text-xs text-muted-foreground ml-[108px]">
                  Um convite será enviado para este email
                </p>
              )}

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
        <div className="p-6">
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

          {/* Info */}
          <div className="mt-6 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
            <strong>📱 Importante:</strong> As notificações serão enviadas para o WhatsApp
            cadastrado acima. Configure as preferências de notificação na tabela principal.
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
    updateNotificationSettings,
    resendInvite,
  } = useTeam();

  const { fetchMembers } = useWorkspace();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [resendingFor, setResendingFor] = useState<string | null>(null);
  const [deletingMember, setDeletingMember] = useState<UserProfile | null>(null);
  const [passwordMember, setPasswordMember] = useState<UserProfile | null>(null);
  const [sessionMember, setSessionMember] = useState<UserProfile | null>(null);
  const { isAdmin } = useUserRole();

  useEffect(() => {
    fetchTeamMembers();
    fetchMembers().then(setWorkspaceMembers);
  }, [fetchTeamMembers, fetchMembers]);

  const getMemberStatus = (member: UserProfile): "active" | "pending" => {
    const wm = workspaceMembers.find(
      (m) => m.user_id === member.user_id || m.invited_email === member.email
    );
    if (!wm || !wm.accepted_at) return "pending";
    return "active";
  };

  const getWorkspaceMember = (member: UserProfile): WorkspaceMember | undefined => {
    return workspaceMembers.find(
      (m) => m.user_id === member.user_id || m.invited_email === member.email
    );
  };

  const handleResendInvite = async (member: UserProfile) => {
    if (!member.email) return;
    setResendingFor(member.user_id);
    const wm = getWorkspaceMember(member);
    await resendInvite(member.email, member.full_name, wm?.role || member.roles[0] || "seller");
    setResendingFor(null);
  };

  const openCreate = () => {
    setEditingMember(null);
    setIsEditorOpen(true);
  };

  const openEdit = (member: UserProfile) => {
    setEditingMember(member);
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
      await createTeamMember({
        ...data,
        email: data.email || "",
      });
    }
    await fetchTeamMembers();
  };

  const handleNotificationChange = async (userId: string, type: NotificationType) => {
    const settings = {
      notify_no_response: type === "no_response" || type === "both",
      notify_weekly_report: type === "weekly_report" || type === "both",
    };
    await updateNotificationSettings(userId, settings);
    await fetchTeamMembers();
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
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="w-10"></div>
              <div>Nome</div>
              <div>Função</div>
              <div>Status</div>
              <div>WhatsApp</div>
              <div className="w-40">
                <div className="flex items-center gap-1">
                  <Bell className="h-3 w-3" />
                  Notificações
                </div>
              </div>
              <div className="w-12 text-center">Ações</div>
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
                    "grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-3 items-center hover:bg-muted/30 transition-colors",
                    idx !== teamMembers.length - 1 && "border-b"
                  )}
                >
                  {/* Avatar */}
                  <Avatar 
                    className="h-10 w-10 cursor-pointer" 
                    onClick={() => openEdit(member)}
                  >
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground font-semibold text-sm">
                      {member.full_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name & Email */}
                  <div 
                    className="min-w-0 cursor-pointer" 
                    onClick={() => openEdit(member)}
                  >
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

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    {getMemberStatus(member) === "pending" ? (
                      <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-600">
                        Pendente
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs bg-emerald-500/20 text-emerald-600">
                        Ativo
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {member.phone || "—"}
                  </div>

                  {/* Notifications Select */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={member.notification_type}
                      onValueChange={(value: NotificationType) => 
                        handleNotificationChange(member.user_id, value)
                      }
                    >
                      <SelectTrigger className="w-40 h-8 text-xs">
                        <SelectValue placeholder="Selecionar..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="weekly_report">
                          {NOTIFICATION_LABELS.weekly_report}
                        </SelectItem>
                        <SelectItem value="no_response">
                          {NOTIFICATION_LABELS.no_response}
                        </SelectItem>
                        <SelectItem value="both">
                          {NOTIFICATION_LABELS.both}
                        </SelectItem>
                        <SelectItem value="none">
                          {NOTIFICATION_LABELS.none}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Actions Dropdown */}
                  <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover w-48">
                        <DropdownMenuItem onClick={() => openEdit(member)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        {getMemberStatus(member) === "pending" && (
                          <DropdownMenuItem
                            disabled={resendingFor === member.user_id}
                            onClick={() => handleResendInvite(member)}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Reenviar convite
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setPasswordMember(member)}>
                          <Lock className="h-4 w-4 mr-2" />
                          Definir senha
                        </DropdownMenuItem>
                        {isAdmin && (
                          <DropdownMenuItem onClick={() => setSessionMember(member)}>
                            <Globe className="h-4 w-4 mr-2" />
                            Ver sessões
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeletingMember(member)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
              • <strong>Dashboard semanal:</strong> Relatório com ranking de vendedores e métricas
            </li>
            <li>
              • <strong>Sem resposta:</strong> Alertas quando leads estão aguardando resposta
            </li>
            <li>
              • <strong>Ambos:</strong> Recebe dashboard semanal E alertas de sem resposta
            </li>
            <li>
              • <strong>Nenhum:</strong> Não recebe notificações via WhatsApp
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
        }}
        onSave={handleSave}
        isNew={!editingMember}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingMember} onOpenChange={(open) => !open && setDeletingMember(null)}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingMember?.full_name} será removido da equipe e não receberá mais notificações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingMember) deleteTeamMember(deletingMember.user_id);
                setDeletingMember(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SetPasswordDialog
        open={!!passwordMember}
        onOpenChange={(open) => !open && setPasswordMember(null)}
        targetUserId={passwordMember?.user_id}
        targetUserName={passwordMember?.full_name}
      />

      {isAdmin && (
        <SessionViewer
          open={!!sessionMember}
          onOpenChange={(open) => !open && setSessionMember(null)}
          targetUserId={sessionMember?.user_id || ""}
          targetUserName={sessionMember?.full_name || ""}
        />
      )}
    </Card>
  );
}
