import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Bell,
  Phone,
  Mail,
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useTeam, type AppRole, type UserProfile, type NotificationSettings } from "@/hooks/useTeam";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<AppRole, { label: string; icon: React.ElementType; color: string }> = {
  admin: { label: "Administrador", icon: Shield, color: "#EF4444" },
  manager: { label: "Gestor", icon: UserCog, color: "#8B5CF6" },
  seller: { label: "Vendedor", icon: BadgeCheck, color: "#22C55E" },
};

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

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);
  const [notificationMember, setNotificationMember] = useState<UserProfile | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);

  // Notification form state
  const [notifyNoResponse, setNotifyNoResponse] = useState(true);
  const [noResponseMinutes, setNoResponseMinutes] = useState(10);
  const [notifyWeeklyReport, setNotifyWeeklyReport] = useState(true);
  const [weeklyReportDay, setWeeklyReportDay] = useState(1);
  const [weeklyReportHour, setWeeklyReportHour] = useState(9);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  const resetForm = () => {
    setFullName("");
    setPhone("");
    setEmail("");
    setSelectedRoles([]);
    setEditingMember(null);
  };

  const handleRoleToggle = (role: AppRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleCreate = async () => {
    if (!fullName.trim() || !phone.trim() || selectedRoles.length === 0) return;

    await createTeamMember({
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      roles: selectedRoles,
    });

    setIsCreateOpen(false);
    resetForm();
  };

  const handleUpdate = async () => {
    if (!editingMember || !fullName.trim() || !phone.trim()) return;

    await updateTeamMember(editingMember.user_id, {
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      roles: selectedRoles,
    });

    resetForm();
  };

  const openEditDialog = (member: UserProfile) => {
    setEditingMember(member);
    setFullName(member.full_name);
    setPhone(member.phone || "");
    setEmail(member.email || "");
    setSelectedRoles(member.roles);
  };

  const openNotificationDialog = async (member: UserProfile) => {
    setNotificationMember(member);
    const settings = await fetchNotificationSettings(member.user_id);
    if (settings) {
      setNotificationSettings(settings);
      setNotifyNoResponse(settings.notify_no_response);
      setNoResponseMinutes(settings.no_response_minutes);
      setNotifyWeeklyReport(settings.notify_weekly_report);
      setWeeklyReportDay(settings.weekly_report_day);
      setWeeklyReportHour(settings.weekly_report_hour);
    } else {
      setNotificationSettings(null);
      setNotifyNoResponse(true);
      setNoResponseMinutes(10);
      setNotifyWeeklyReport(true);
      setWeeklyReportDay(1);
      setWeeklyReportHour(9);
    }
  };

  const handleSaveNotifications = async () => {
    if (!notificationMember) return;

    await updateNotificationSettings(notificationMember.user_id, {
      notify_no_response: notifyNoResponse,
      no_response_minutes: noResponseMinutes,
      notify_weekly_report: notifyWeeklyReport,
      weekly_report_day: weeklyReportDay,
      weekly_report_hour: weeklyReportHour,
    });

    setNotificationMember(null);
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11)
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
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
          <Dialog
            open={isCreateOpen}
            onOpenChange={(open) => {
              setIsCreateOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Membro
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-background">
              <DialogHeader>
                <DialogTitle>Adicionar Membro da Equipe</DialogTitle>
                <DialogDescription>
                  Cadastre um novo membro para receber notificações e acessar o sistema.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome Completo *</Label>
                  <Input
                    placeholder="Ex: João Silva"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>WhatsApp *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-10"
                      placeholder="(27) 99999-9999"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Email (opcional)</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      className="pl-10"
                      placeholder="email@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Funções *</Label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => {
                      const { label, icon: Icon, color } = ROLE_LABELS[role];
                      const isSelected = selectedRoles.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => handleRoleToggle(role)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all",
                            isSelected
                              ? "border-current bg-current/10"
                              : "border-muted hover:border-muted-foreground/50"
                          )}
                          style={{ color: isSelected ? color : undefined }}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-medium">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!fullName.trim() || !phone.trim() || selectedRoles.length === 0}
                >
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
          <div className="space-y-3">
            <AnimatePresence>
              {teamMembers.map((member) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-4 p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold">
                    {member.full_name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{member.full_name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {member.phone || "Sem telefone"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {member.roles.map((role) => {
                      const { label, color } = ROLE_LABELS[role];
                      return (
                        <Badge
                          key={role}
                          variant="secondary"
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

                  <div className="flex items-center gap-1">
                    {/* Notifications Dialog */}
                    <Dialog
                      open={notificationMember?.id === member.id}
                      onOpenChange={(open) => {
                        if (!open) setNotificationMember(null);
                        else openNotificationDialog(member);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Bell className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-background">
                        <DialogHeader>
                          <DialogTitle>Notificações - {member.full_name}</DialogTitle>
                          <DialogDescription>
                            Configure os alertas que este membro receberá no WhatsApp
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-6 py-4">
                          {/* Alerta de sem resposta */}
                          <div className="space-y-4 p-4 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label className="text-base font-medium">
                                  Alerta de cliente sem resposta
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                  Receber aviso quando cliente esperar muito tempo
                                </p>
                              </div>
                              <Switch
                                checked={notifyNoResponse}
                                onCheckedChange={setNotifyNoResponse}
                              />
                            </div>

                            {notifyNoResponse && (
                              <div className="space-y-2">
                                <Label>Tempo limite (minutos)</Label>
                                <Select
                                  value={noResponseMinutes.toString()}
                                  onValueChange={(v) => setNoResponseMinutes(Number(v))}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-popover">
                                    <SelectItem value="5">5 minutos</SelectItem>
                                    <SelectItem value="10">10 minutos</SelectItem>
                                    <SelectItem value="15">15 minutos</SelectItem>
                                    <SelectItem value="30">30 minutos</SelectItem>
                                    <SelectItem value="60">1 hora</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>

                          {/* Relatório semanal */}
                          {member.roles.includes("manager") && (
                            <div className="space-y-4 p-4 border rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <Label className="text-base font-medium">
                                    Relatório semanal
                                  </Label>
                                  <p className="text-sm text-muted-foreground">
                                    Receber resumo de vendas e métricas
                                  </p>
                                </div>
                                <Switch
                                  checked={notifyWeeklyReport}
                                  onCheckedChange={setNotifyWeeklyReport}
                                />
                              </div>

                              {notifyWeeklyReport && (
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Dia da semana</Label>
                                    <Select
                                      value={weeklyReportDay.toString()}
                                      onValueChange={(v) => setWeeklyReportDay(Number(v))}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="bg-popover">
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
                                  <div className="space-y-2">
                                    <Label>Horário</Label>
                                    <Select
                                      value={weeklyReportHour.toString()}
                                      onValueChange={(v) => setWeeklyReportHour(Number(v))}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="bg-popover">
                                        {Array.from({ length: 24 }, (_, i) => (
                                          <SelectItem key={i} value={i.toString()}>
                                            {i.toString().padStart(2, "0")}:00
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <DialogFooter>
                          <Button variant="outline" onClick={() => setNotificationMember(null)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleSaveNotifications}>Salvar</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Edit Dialog */}
                    <Dialog
                      open={editingMember?.id === member.id}
                      onOpenChange={(open) => {
                        if (!open) resetForm();
                        else openEditDialog(member);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-background">
                        <DialogHeader>
                          <DialogTitle>Editar Membro</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Nome Completo</Label>
                            <Input
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>WhatsApp</Label>
                            <Input
                              value={phone}
                              onChange={(e) => setPhone(formatPhone(e.target.value))}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Funções</Label>
                            <div className="flex flex-wrap gap-2">
                              {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => {
                                const { label, icon: Icon, color } = ROLE_LABELS[role];
                                const isSelected = selectedRoles.includes(role);
                                return (
                                  <button
                                    key={role}
                                    type="button"
                                    onClick={() => handleRoleToggle(role)}
                                    className={cn(
                                      "flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all",
                                      isSelected
                                        ? "border-current bg-current/10"
                                        : "border-muted hover:border-muted-foreground/50"
                                    )}
                                    style={{ color: isSelected ? color : undefined }}
                                  >
                                    <Icon className="h-4 w-4" />
                                    <span className="text-sm font-medium">{label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <DialogFooter>
                          <Button variant="outline" onClick={resetForm}>
                            Cancelar
                          </Button>
                          <Button onClick={handleUpdate}>Salvar</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Delete */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
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
            <Bell className="h-4 w-4" />
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
    </Card>
  );
}
