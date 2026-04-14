import { Tag, Zap, Users, Bell, Key, Webhook, Settings2, FileInput, Lock, ArrowUpRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TagManager } from "@/components/settings/TagManager";
import { AutoTagRules } from "@/components/settings/AutoTagRules";
import { TeamManager } from "@/components/settings/TeamManager";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { ApiKeysManager } from "@/components/settings/ApiKeysManager";
import { WebhooksManager } from "@/components/settings/WebhooksManager";
import { CustomFieldsManager } from "@/components/settings/CustomFieldsManager";
import { FormWebhookConfig } from "@/components/settings/FormWebhookConfig";
import { PermissionGuard } from "@/components/layout/PermissionGuard";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

function PlanLockedState({ feature }: { feature: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-muted-foreground">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <Lock className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">Recurso exclusivo do plano Escala</h2>
      <p className="text-sm text-center max-w-md">
        {feature} está disponível apenas para workspaces no plano Escala. Faça upgrade para desbloquear.
      </p>
      <Button onClick={() => navigate("/planos")} className="gap-2">
        <ArrowUpRight className="w-4 h-4" />
        Ver planos
      </Button>
    </div>
  );
}

export default function Configuracoes() {
  const { planName } = usePlanLimits();
  const isEscala = planName === "escala" || planName === "escala_semestral";

  return (
    <div className="space-y-6" data-tour="team-section">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Configurações
        </h1>
        <p className="text-muted-foreground">
          Gerencie equipe, tags, automações e alertas do sistema
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="team" className="space-y-6">
        <TabsList className="grid w-full max-w-5xl grid-cols-8">
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Equipe
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="tags" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Tags
          </TabsTrigger>
          <TabsTrigger value="automations" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Automações
          </TabsTrigger>
          <TabsTrigger value="fields" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Campos
          </TabsTrigger>
          <TabsTrigger value="forms" className={`flex items-center gap-2 ${!isEscala ? "opacity-50" : ""}`}>
            {!isEscala && <Lock className="h-3 w-3" />}
            <FileInput className="h-4 w-4" />
            Formulários
          </TabsTrigger>
          <TabsTrigger value="api" className={`flex items-center gap-2 ${!isEscala ? "opacity-50" : ""}`}>
            {!isEscala && <Lock className="h-3 w-3" />}
            <Key className="h-4 w-4" />
            API
          </TabsTrigger>
          <TabsTrigger value="webhooks" className={`flex items-center gap-2 ${!isEscala ? "opacity-50" : ""}`}>
            {!isEscala && <Lock className="h-3 w-3" />}
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team">
          <TeamManager />
        </TabsContent>

        <TabsContent value="notifications" data-tour="alerts-section">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="tags">
          <TagManager />
        </TabsContent>

        <TabsContent value="automations">
          <AutoTagRules />
        </TabsContent>

        <TabsContent value="fields">
          <PermissionGuard permission="canManageWorkspaceSettings">
            <CustomFieldsManager />
          </PermissionGuard>
        </TabsContent>

        <TabsContent value="forms">
          {isEscala ? (
            <PermissionGuard permission="canManageWorkspaceSettings">
              <FormWebhookConfig />
            </PermissionGuard>
          ) : (
            <PlanLockedState feature="Formulários de captura" />
          )}
        </TabsContent>

        <TabsContent value="api">
          {isEscala ? (
            <PermissionGuard permission="canManageWorkspaceSettings">
              <ApiKeysManager />
            </PermissionGuard>
          ) : (
            <PlanLockedState feature="Chaves de API" />
          )}
        </TabsContent>

        <TabsContent value="webhooks">
          {isEscala ? (
            <PermissionGuard permission="canManageWorkspaceSettings">
              <WebhooksManager />
            </PermissionGuard>
          ) : (
            <PlanLockedState feature="Webhooks" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}