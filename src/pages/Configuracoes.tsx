import { Tag, Zap, Users, Bell, Key, Webhook, Settings2, FileInput } from "lucide-react";
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

export default function Configuracoes() {
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
          <TabsTrigger value="forms" className="flex items-center gap-2">
            <FileInput className="h-4 w-4" />
            Formulários
          </TabsTrigger>
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-2">
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
          <PermissionGuard permission="canManageWorkspaceSettings">
            <FormWebhookConfig />
          </PermissionGuard>
        </TabsContent>

        <TabsContent value="api">
          <PermissionGuard permission="canManageWorkspaceSettings">
            <ApiKeysManager />
          </PermissionGuard>
        </TabsContent>

        <TabsContent value="webhooks">
          <PermissionGuard permission="canManageWorkspaceSettings">
            <WebhooksManager />
          </PermissionGuard>
        </TabsContent>
      </Tabs>
    </div>
  );
}