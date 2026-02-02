import { Tag, Zap, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TagManager } from "@/components/settings/TagManager";
import { AutoTagRules } from "@/components/settings/AutoTagRules";
import { TeamManager } from "@/components/settings/TeamManager";

export default function Configuracoes() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Configurações
        </h1>
        <p className="text-muted-foreground">
          Gerencie equipe, tags e automações do sistema
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="team" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Equipe
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
