import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";

export interface Department {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_reception: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CreateDepartmentInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  is_reception?: boolean;
}

export function useDepartments() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ["departments", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      const { data, error } = await supabase
        .from("ai_departments")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data || []) as Department[];
    },
    enabled: !!workspace?.id,
  });

  const createDepartment = useMutation({
    mutationFn: async (input: CreateDepartmentInput) => {
      if (!workspace?.id) throw new Error("Sem workspace");
      const position = departments.length;
      // Se marcado como recepção, desmarcar os outros
      if (input.is_reception) {
        await supabase.from("ai_departments")
          .update({ is_reception: false })
          .eq("workspace_id", workspace.id);
      }
      const { data, error } = await supabase
        .from("ai_departments")
        .insert({
          workspace_id: workspace.id,
          name: input.name,
          description: input.description ?? null,
          icon: input.icon ?? "Building2",
          color: input.color ?? "#3b82f6",
          is_reception: input.is_reception ?? false,
          position,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as Department;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast({ title: "Departamento criado" });
    },
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const updateDepartment = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Department> & { id: string }) => {
      if (!workspace?.id) throw new Error("Sem workspace");
      // Se marcando como recepção, desmarcar os outros
      if (patch.is_reception) {
        await supabase.from("ai_departments")
          .update({ is_reception: false })
          .eq("workspace_id", workspace.id)
          .neq("id", id);
      }
      const { error } = await supabase.from("ai_departments").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast({ title: "Departamento atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteDepartment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["ai_agents"] });
      toast({ title: "Departamento excluído" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const assignAgentToDepartment = useMutation({
    mutationFn: async ({ agentId, departmentId }: { agentId: string; departmentId: string | null }) => {
      const { error } = await supabase
        .from("ai_agents")
        .update({ department_id: departmentId })
        .eq("id", agentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["ai_agents"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return {
    departments,
    isLoading,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    assignAgentToDepartment,
  };
}
