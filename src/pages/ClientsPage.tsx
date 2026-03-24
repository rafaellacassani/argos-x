import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useClients, Client } from "@/hooks/useClients";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Upload, Search, Building2, Download } from "lucide-react";
import { CreateClientDialog } from "@/components/clients/CreateClientDialog";
import { toast } from "sonner";
import { ImportClientsDialog } from "@/components/clients/ImportClientsDialog";

const statusColors: Record<string, string> = {
  Ativo: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Perdido: "bg-red-500/20 text-red-400 border-red-500/30",
  Cancelado: "bg-red-500/20 text-red-400 border-red-500/30",
  Inativo: "bg-muted text-muted-foreground border-border",
};

const stageColors: Record<string, string> = {
  Onboarding: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Ativação: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Ativo: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Cancelado: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function ClientsPage() {
  const { clients, isLoading } = useClients();
  const { canExportData } = useMemberPermissions();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const exportCSV = () => {
    if (clients.length === 0) {
      toast.error("Nenhum cliente para exportar");
      return;
    }
    const headers = [
      "razao_social","nome_fantasia","cnpj","status","stage","pacote",
      "valor_negociado","valor_extenso","data_inicio_pagamento",
      "socio_nome","socio_cpf","socio_email","socio_telefone",
      "stakeholder_nome","stakeholder_email","financeiro_email",
      "closer","bdr","pais","endereco","numero","bairro","municipio","estado","cep",
      "negociacoes_personalizadas","created_at","updated_at"
    ];
    const escape = (v: any) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
    };
    const rows = clients.map(c => headers.map(h => escape((c as any)[h])).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${clients.length} clientes exportados!`);
  };

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchSearch =
        !search ||
        c.razao_social?.toLowerCase().includes(search.toLowerCase()) ||
        c.nome_fantasia?.toLowerCase().includes(search.toLowerCase()) ||
        c.cnpj?.includes(search);
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      const matchStage = stageFilter === "all" || c.stage === stageFilter;
      return matchSearch && matchStatus && matchStage;
    });
  }, [clients, search, statusFilter, stageFilter]);

  const stats = useMemo(() => ({
    total: clients.length,
    ativos: clients.filter((c) => c.status === "Ativo").length,
    perdidos: clients.filter((c) => c.status === "Perdido").length,
  }), [clients]);

  return (
    <>
      <Helmet><title>Clientes ECX | Argos X</title></Helmet>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" />
              Clientes ECX
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {stats.total} clientes · {stats.ativos} ativos · {stats.perdidos} perdidos
            </p>
          </div>
          <div className="flex gap-2">
            {canExportData && (
              <Button variant="outline" onClick={exportCSV}>
                <Download className="w-4 h-4 mr-2" /> Exportar CSV
              </Button>
            )}
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-2" /> Importar Excel
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Novo Cliente
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="Ativo">Ativo</SelectItem>
              <SelectItem value="Perdido">Perdido</SelectItem>
              <SelectItem value="Cancelado">Cancelado</SelectItem>
              <SelectItem value="Inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Fase" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas fases</SelectItem>
              <SelectItem value="Onboarding">Onboarding</SelectItem>
              <SelectItem value="Ativação">Ativação</SelectItem>
              <SelectItem value="Ativo">Ativo</SelectItem>
              <SelectItem value="Cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome Fantasia</TableHead>
                <TableHead>Razão Social</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Pacote</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fase</TableHead>
                <TableHead>Closer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome_fantasia || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{c.razao_social}</TableCell>
                    <TableCell className="font-mono text-xs">{c.cnpj || "—"}</TableCell>
                    <TableCell>{c.pacote}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[c.status] || ""}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={stageColors[c.stage] || ""}>
                        {c.stage}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.closer || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <CreateClientDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ImportClientsDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
