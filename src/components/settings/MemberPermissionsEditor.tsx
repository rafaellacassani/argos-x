import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Eye,
  MessageCircle,
  Users,
  Plug,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { ALL_PAGES, type MemberPermissions } from "@/hooks/useMemberPermissions";

interface Instance {
  id: string;
  instance_name: string;
  display_name: string | null;
}

interface MemberPermissionsEditorProps {
  userId: string;
  isAdminRole: boolean;
  fetchUserPermissions: (userId: string) => Promise<MemberPermissions | null>;
  saveUserPermissions: (
    userId: string,
    perms: Partial<Omit<MemberPermissions, "id" | "workspace_id" | "user_id">>
  ) => Promise<boolean>;
}

export function MemberPermissionsEditor({
  userId,
  isAdminRole,
  fetchUserPermissions,
  saveUserPermissions,
}: MemberPermissionsEditorProps) {
  const { workspaceId } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [instances, setInstances] = useState<Instance[]>([]);

  // Permission state
  const [allPages, setAllPages] = useState(true);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [allInstances, setAllInstances] = useState(true);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [canCreateLeads, setCanCreateLeads] = useState(true);
  const [canEditLeads, setCanEditLeads] = useState(true);
  const [canDeleteLeads, setCanDeleteLeads] = useState(false);
  const [canCreateInstances, setCanCreateInstances] = useState(false);

  // Load data
  useEffect(() => {
    if (!userId || !workspaceId) return;

    const load = async () => {
      setLoading(true);

      const [perms, instancesRes] = await Promise.all([
        fetchUserPermissions(userId),
        supabase
          .from("whatsapp_instances")
          .select("id, instance_name, display_name")
          .eq("workspace_id", workspaceId)
          .neq("instance_type", "alerts"),
      ]);

      setInstances((instancesRes.data as Instance[]) || []);

      if (perms) {
        setAllPages(perms.allowed_pages === null);
        setSelectedPages(perms.allowed_pages || ALL_PAGES.map((p) => p.path));
        setAllInstances(perms.allowed_instance_ids === null);
        setSelectedInstanceIds(perms.allowed_instance_ids || []);
        setCanCreateLeads(perms.can_create_leads);
        setCanEditLeads(perms.can_edit_leads);
        setCanDeleteLeads(perms.can_delete_leads);
        setCanCreateInstances(perms.can_create_instances);
      } else {
        // Defaults
        setAllPages(true);
        setSelectedPages(ALL_PAGES.map((p) => p.path));
        setAllInstances(true);
        setSelectedInstanceIds([]);
        setCanCreateLeads(true);
        setCanEditLeads(true);
        setCanDeleteLeads(false);
        setCanCreateInstances(false);
      }

      setLoading(false);
    };

    load();
  }, [userId, workspaceId, fetchUserPermissions]);

  // Auto-save on change
  const save = async (overrides?: Partial<Omit<MemberPermissions, "id" | "workspace_id" | "user_id">>) => {
    setSaving(true);
    await saveUserPermissions(userId, {
      allowed_pages: allPages ? null : selectedPages,
      allowed_instance_ids: allInstances ? null : selectedInstanceIds,
      can_create_leads: canCreateLeads,
      can_edit_leads: canEditLeads,
      can_delete_leads: canDeleteLeads,
      can_create_instances: canCreateInstances,
      ...overrides,
    });
    setSaving(false);
  };

  if (isAdminRole) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Badge variant="secondary" className="bg-red-500/20 text-red-500 mb-2">
          Administrador
        </Badge>
        <p className="text-sm">
          Administradores possuem acesso total ao sistema. Não é necessário configurar permissões.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="pages" className="w-full">
      <TabsList className="w-full grid grid-cols-4 h-auto p-1 bg-muted/50">
        <TabsTrigger value="pages" className="text-xs py-1.5 gap-1">
          <Eye className="h-3.5 w-3.5" />
          Acesso
        </TabsTrigger>
        <TabsTrigger value="instances" className="text-xs py-1.5 gap-1">
          <MessageCircle className="h-3.5 w-3.5" />
          Instâncias
        </TabsTrigger>
        <TabsTrigger value="leads" className="text-xs py-1.5 gap-1">
          <Users className="h-3.5 w-3.5" />
          Leads
        </TabsTrigger>
        <TabsTrigger value="general" className="text-xs py-1.5 gap-1">
          <Plug className="h-3.5 w-3.5" />
          Geral
        </TabsTrigger>
      </TabsList>

      {/* PAGES TAB */}
      <TabsContent value="pages" className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Acesso a todas as páginas</Label>
          <Switch
            checked={allPages}
            onCheckedChange={(v) => {
              setAllPages(v);
              save({ allowed_pages: v ? null : selectedPages });
            }}
          />
        </div>

        {!allPages && (
          <ScrollArea className="h-[240px] border rounded-lg p-3">
            <div className="space-y-2">
              {ALL_PAGES.map((page) => (
                <label
                  key={page.path}
                  className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedPages.includes(page.path)}
                    onCheckedChange={(checked) => {
                      const next = checked
                        ? [...selectedPages, page.path]
                        : selectedPages.filter((p) => p !== page.path);
                      setSelectedPages(next);
                      save({ allowed_pages: next });
                    }}
                  />
                  <span className="text-sm">{page.label}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{page.path}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
        )}
      </TabsContent>

      {/* INSTANCES TAB */}
      <TabsContent value="instances" className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Acesso a todas as instâncias</Label>
          <Switch
            checked={allInstances}
            onCheckedChange={(v) => {
              setAllInstances(v);
              save({ allowed_instance_ids: v ? null : selectedInstanceIds });
            }}
          />
        </div>

        {!allInstances && (
          <ScrollArea className="h-[200px] border rounded-lg p-3">
            {instances.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma instância comercial encontrada
              </p>
            ) : (
              <div className="space-y-2">
                {instances.map((inst) => (
                  <label
                    key={inst.id}
                    className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedInstanceIds.includes(inst.id)}
                      onCheckedChange={(checked) => {
                        const next = checked
                          ? [...selectedInstanceIds, inst.id]
                          : selectedInstanceIds.filter((id) => id !== inst.id);
                        setSelectedInstanceIds(next);
                        save({ allowed_instance_ids: next });
                      }}
                    />
                    <span className="text-sm">
                      {inst.display_name || inst.instance_name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </TabsContent>

      {/* LEADS TAB */}
      <TabsContent value="leads" className="mt-4 space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Criar leads</Label>
              <p className="text-xs text-muted-foreground">Pode adicionar novos leads ao funil</p>
            </div>
            <Switch
              checked={canCreateLeads}
              onCheckedChange={(v) => {
                setCanCreateLeads(v);
                save({ can_create_leads: v });
              }}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Editar leads</Label>
              <p className="text-xs text-muted-foreground">Pode alterar dados de leads existentes</p>
            </div>
            <Switch
              checked={canEditLeads}
              onCheckedChange={(v) => {
                setCanEditLeads(v);
                save({ can_edit_leads: v });
              }}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Excluir leads</Label>
              <p className="text-xs text-muted-foreground">Pode remover leads permanentemente</p>
            </div>
            <Switch
              checked={canDeleteLeads}
              onCheckedChange={(v) => {
                setCanDeleteLeads(v);
                save({ can_delete_leads: v });
              }}
            />
          </div>
        </div>
      </TabsContent>

      {/* GENERAL TAB */}
      <TabsContent value="general" className="mt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Criar instâncias WhatsApp</Label>
            <p className="text-xs text-muted-foreground">Pode adicionar novas conexões WhatsApp</p>
          </div>
          <Switch
            checked={canCreateInstances}
            onCheckedChange={(v) => {
              setCanCreateInstances(v);
              save({ can_create_instances: v });
            }}
          />
        </div>
      </TabsContent>

      {saving && (
        <p className="text-xs text-muted-foreground text-center mt-2 animate-pulse">
          Salvando...
        </p>
      )}
    </Tabs>
  );
}
