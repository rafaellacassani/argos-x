import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, Building2, Mail, Lock, ShieldCheck, Loader2, Check, Trash2, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";

export default function ProfileSettings() {
  const { user } = useAuth();
  const { workspace, membership, refreshWorkspace } = useWorkspace();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();

  // Profile state
  const [fullName, setFullName] = useState("");
  const [loadingName, setLoadingName] = useState(false);

  // Workspace state
  const [workspaceName, setWorkspaceName] = useState("");
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);

  // Email state
  const [newEmail, setNewEmail] = useState("");
  const [loadingEmail, setLoadingEmail] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loadingPassword, setLoadingPassword] = useState(false);

  // 2FA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loadingMfa, setLoadingMfa] = useState(true);
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaVerifyCode, setMfaVerifyCode] = useState("");
  const [enrollingMfa, setEnrollingMfa] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || "");
      setNewEmail(user.email || "");
    }
    if (workspace) {
      setWorkspaceName(workspace.name);
    }
  }, [user, workspace]);

  // Check MFA status
  useEffect(() => {
    const checkMfa = async () => {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        const totp = data?.totp || [];
        const verified = totp.find((f: any) => f.status === "verified");
        if (verified) {
          setMfaEnabled(true);
          setMfaFactorId(verified.id);
        } else {
          setMfaEnabled(false);
        }
      } catch (e) {
        console.error("Error checking MFA:", e);
      } finally {
        setLoadingMfa(false);
      }
    };
    checkMfa();
  }, []);

  // === HANDLERS ===

  const handleUpdateName = async () => {
    if (!fullName.trim()) return toast.error("Nome não pode estar vazio");
    setLoadingName(true);
    try {
      // Update auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });
      if (authError) throw authError;

      // Update user_profiles
      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({ full_name: fullName.trim() })
        .eq("user_id", user!.id);
      if (profileError) throw profileError;

      toast.success("Nome atualizado com sucesso!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar nome");
    } finally {
      setLoadingName(false);
    }
  };

  const handleUpdateWorkspaceName = async () => {
    if (!workspaceName.trim()) return toast.error("Nome do workspace não pode estar vazio");
    setLoadingWorkspace(true);
    try {
      const { error } = await supabase
        .from("workspaces")
        .update({ name: workspaceName.trim() })
        .eq("id", workspace!.id);
      if (error) throw error;
      refreshWorkspace();
      toast.success("Nome do workspace atualizado!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar workspace");
    } finally {
      setLoadingWorkspace(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim() || newEmail === user?.email) return;
    setLoadingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
      toast.success("Um e-mail de confirmação foi enviado para o novo endereço. Verifique sua caixa de entrada.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar e-mail");
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres");
    if (newPassword !== confirmPassword) return toast.error("As senhas não coincidem");
    setLoadingPassword(true);
    try {
      // Re-authenticate with current password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPassword,
      });
      if (signInError) {
        toast.error("Senha atual incorreta");
        setLoadingPassword(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha atualizada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar senha");
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleEnrollMfa = async () => {
    setEnrollingMfa(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      setMfaQr(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
      setMfaFactorId(data.id);
    } catch (e: any) {
      toast.error(e.message || "Erro ao ativar 2FA");
      setEnrollingMfa(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!mfaVerifyCode || mfaVerifyCode.length !== 6) return toast.error("Insira o código de 6 dígitos");
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId!,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId!,
        challengeId: challengeData.id,
        code: mfaVerifyCode,
      });
      if (verifyError) throw verifyError;

      setMfaEnabled(true);
      setMfaQr(null);
      setMfaSecret(null);
      setMfaVerifyCode("");
      setEnrollingMfa(false);
      toast.success("Autenticação de dois fatores ativada!");
    } catch (e: any) {
      toast.error(e.message || "Código inválido");
    }
  };

  const handleDisableMfa = async () => {
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId! });
      if (error) throw error;
      setMfaEnabled(false);
      setMfaFactorId(null);
      toast.success("Autenticação de dois fatores desativada");
    } catch (e: any) {
      toast.error(e.message || "Erro ao desativar 2FA");
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Perfil & Segurança</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas informações pessoais e configurações de segurança</p>
        </div>
      </div>

      {/* Name */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Nome de exibição</CardTitle>
          </div>
          <CardDescription>Como você aparece para sua equipe</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome completo"
              className="flex-1"
            />
            <Button onClick={handleUpdateName} disabled={loadingName}>
              {loadingName ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Workspace Name - only for admins */}
      {isAdmin && workspace && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">Nome do Workspace</CardTitle>
            </div>
            <CardDescription>Nome da sua empresa/equipe</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <Input
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Nome do workspace"
                className="flex-1"
              />
              <Button onClick={handleUpdateWorkspaceName} disabled={loadingWorkspace}>
                {loadingWorkspace ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Email */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">E-mail de acesso</CardTitle>
          </div>
          <CardDescription>
            E-mail atual: <span className="font-medium text-foreground">{user?.email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="novo@email.com"
              className="flex-1"
            />
            <Button
              onClick={handleUpdateEmail}
              disabled={loadingEmail || newEmail === user?.email}
            >
              {loadingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : "Alterar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Um e-mail de confirmação será enviado para o novo endereço.</p>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Alterar senha</CardTitle>
          </div>
          <CardDescription>Use uma senha forte com pelo menos 6 caracteres</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Senha atual</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <Button
            onClick={handleUpdatePassword}
            disabled={loadingPassword || !currentPassword || !newPassword || !confirmPassword}
          >
            {loadingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : "Atualizar senha"}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* 2FA */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Autenticação de dois fatores (2FA)</CardTitle>
            {!loadingMfa && (
              <Badge variant={mfaEnabled ? "default" : "secondary"}>
                {mfaEnabled ? "Ativo" : "Desativado"}
              </Badge>
            )}
          </div>
          <CardDescription>Adicione uma camada extra de segurança à sua conta com um app autenticador (Google Authenticator, Authy, etc.)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingMfa ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verificando status...
            </div>
          ) : mfaEnabled ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-primary">
                <Check className="w-4 h-4" />
                Autenticação de dois fatores está ativa
              </div>
              <Button variant="destructive" size="sm" onClick={handleDisableMfa}>
                Desativar 2FA
              </Button>
            </div>
          ) : mfaQr ? (
            <div className="space-y-4">
              <p className="text-sm">Escaneie o QR code abaixo com seu app autenticador:</p>
              <div className="flex justify-center">
                <img src={mfaQr} alt="QR Code 2FA" className="w-48 h-48 rounded-lg border" />
              </div>
              {mfaSecret && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Ou insira o código manualmente:</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded select-all">{mfaSecret}</code>
                </div>
              )}
              <div className="space-y-2">
                <Label>Código de verificação</Label>
                <div className="flex gap-3">
                  <Input
                    value={mfaVerifyCode}
                    onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="flex-1"
                  />
                  <Button onClick={handleVerifyMfa} disabled={mfaVerifyCode.length !== 6}>
                    Verificar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button onClick={handleEnrollMfa} disabled={enrollingMfa}>
              {enrollingMfa ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Ativar 2FA
            </Button>
          )}
        </CardContent>
      </Card>
      <Separator />

      {/* Danger Zone */}
      <DangerZone />
    </div>
  );
}

function DangerZone() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDeleteAccount = async () => {
    if (confirmText !== "EXCLUIR") return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const res = await supabase.functions.invoke("cancel-account", {
        body: { confirmation: "EXCLUIR" },
      });

      if (res.error) throw new Error(res.error.message || "Erro ao excluir conta");

      toast.success("Conta excluída com sucesso");
      await signOut();
      navigate("/auth");
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir conta");
      setDeleting(false);
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-destructive" />
          <CardTitle className="text-lg text-destructive">Zona de perigo</CardTitle>
        </div>
        <CardDescription>
          Esta ação é <strong>irreversível</strong>. Todos os seus dados serão apagados permanentemente:
          leads, conversas, conexões WhatsApp, agentes de IA, campanhas e configurações.
          Sua assinatura será cancelada automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmText(""); }}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir minha conta
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Tem certeza absoluta?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  Esta ação <strong>não pode ser desfeita</strong>. Isso irá excluir permanentemente
                  sua conta, workspace e todos os dados associados:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Todos os leads e histórico de conversas</li>
                  <li>Conexões WhatsApp e instâncias</li>
                  <li>Agentes de IA e configurações</li>
                  <li>Campanhas e automações</li>
                  <li>Assinatura e dados de cobrança</li>
                </ul>
                <p className="font-medium">
                  Digite <code className="bg-muted px-1.5 py-0.5 rounded text-destructive font-bold">EXCLUIR</code> para confirmar:
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Digite EXCLUIR"
              className="border-destructive/50"
            />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={confirmText !== "EXCLUIR" || deleting}
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Excluir permanentemente
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
