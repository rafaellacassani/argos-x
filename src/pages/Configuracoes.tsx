import { Tag, Zap, Users, Bell } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TagManager } from "@/components/settings/TagManager";
import { AutoTagRules } from "@/components/settings/AutoTagRules";
import { TeamManager } from "@/components/settings/TeamManager";
import { NotificationSettings } from "@/components/settings/NotificationSettings";

export default function Configuracoes() {
  return (
    <div className="space-y-6">
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
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
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
        </TabsList>

        <TabsContent value="team">
          <TeamManager />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="tags">
          <TagManager />
        </TabsContent>

        <TabsContent value="automations">
          <AutoTagRules />
        </TabsContent>
      </Tabs>
    </div>
  );
}
