import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";

export interface Client {
  id: string;
  workspace_id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  pais: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  municipio: string | null;
  estado: string | null;
  cep: string | null;
  socio_nome: string;
  socio_cpf: string | null;
  socio_email: string | null;
  socio_telefone: string | null;
  stakeholder_nome: string | null;
  stakeholder_email: string | null;
  financeiro_email: string | null;
  pacote: string;
  valor_negociado: number;
  valor_extenso: string | null;
  data_inicio_pagamento: string | null;
  negociacoes_personalizadas: string | null;
  status: string;
  stage: string;
  closer: string | null;
  bdr: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useClients() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      const { data, error } = await supabase
        .from("clients" as any)
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Client[];
    },
    enabled: !!workspace?.id,
  });

  const createClient = useMutation({
    mutationFn: async (client: Omit<Client, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("clients" as any)
        .insert(client as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente criado com sucesso!");
    },
    onError: (err: any) => toast.error("Erro ao criar cliente: " + err.message),
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Client> & { id: string }) => {
      const { error } = await supabase
        .from("clients" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente atualizado!");
    },
    onError: (err: any) => toast.error("Erro ao atualizar: " + err.message),
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("clients" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente removido!");
    },
    onError: (err: any) => toast.error("Erro ao remover: " + err.message),
  });

  return { clients, isLoading, createClient, updateClient, deleteClient };
}
