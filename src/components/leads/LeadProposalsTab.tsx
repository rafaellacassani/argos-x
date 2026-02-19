import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, X, Edit2, Check, Trash2, FileText, Clock, CheckCircle, XCircle, Ban,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/hooks/use-toast";
import type { Lead } from "@/hooks/useLeads";

interface Proposal {
  id: string;
  lead_id: string;
  description: string;
  value: number;
  status: string;
  sent_at: string | null;
  valid_until: string | null;
  created_at: string;
}

interface LeadProposalsTabProps {
  lead: Lead;
  onCreateSaleFromProposal?: (productName: string, value: number) => void;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; badgeClass: string }> = {
  pending: { label: "Pendente", icon: Clock, color: "text-yellow-600", badgeClass: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30" },
  accepted: { label: "Aceito", icon: CheckCircle, color: "text-green-600", badgeClass: "bg-green-500/15 text-green-700 border-green-500/30" },
  rejected: { label: "Rejeitado", icon: XCircle, color: "text-red-600", badgeClass: "bg-red-500/15 text-red-700 border-red-500/30" },
  expired: { label: "Expirado", icon: Ban, color: "text-muted-foreground", badgeClass: "bg-muted text-muted-foreground border-border" },
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function LeadProposalsTab({ lead, onCreateSaleFromProposal }: LeadProposalsTabProps) {
  const { workspaceId } = useWorkspace();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmSaleProposal, setConfirmSaleProposal] = useState<Proposal | null>(null);

  // Form
  const [formDesc, setFormDesc] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formStatus, setFormStatus] = useState("pending");
  const [formValidUntil, setFormValidUntil] = useState<Date | undefined>();

  const totalValue = useMemo(() => proposals.reduce((s, p) => s + Number(p.value), 0), [proposals]);
  const pendingCount = useMemo(() => proposals.filter(p => p.status === "pending").length, [proposals]);

  const fetchProposals = useCallback(async () => {
    const { data } = await supabase
      .from("lead_proposals")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false });
    setProposals((data || []) as Proposal[]);
    setLoading(false);
  }, [lead.id]);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  const resetForm = () => {
    setFormDesc(""); setFormValue(""); setFormStatus("pending"); setFormValidUntil(undefined);
    setShowForm(false); setEditingId(null);
  };

  const handleSave = async () => {
    if (!formDesc.trim() || !formValue) return;
    const numValue = parseFloat(formValue.replace(",", "."));
    if (isNaN(numValue) || numValue <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await supabase.from("lead_proposals").update({
          description: formDesc.trim(),
          value: numValue,
          status: formStatus,
          valid_until: formValidUntil ? formValidUntil.toISOString() : null,
        }).eq("id", editingId);
        toast({ title: "Orçamento atualizado" });
      } else {
        await supabase.from("lead_proposals").insert({
          lead_id: lead.id,
          workspace_id: workspaceId!,
          description: formDesc.trim(),
          value: numValue,
          status: formStatus,
          valid_until: formValidUntil ? formValidUntil.toISOString() : null,
        });
        toast({ title: "Orçamento criado" });
      }
      resetForm();
      await fetchProposals();
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleStatusChange = async (proposal: Proposal, newStatus: string) => {
    await supabase.from("lead_proposals").update({ status: newStatus }).eq("id", proposal.id);
    if (newStatus === "accepted" && onCreateSaleFromProposal) {
      setConfirmSaleProposal({ ...proposal, status: newStatus });
    }
    toast({ title: "Status atualizado" });
    await fetchProposals();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("lead_proposals").delete().eq("id", id);
    toast({ title: "Orçamento removido" });
    await fetchProposals();
  };

  const startEdit = (p: Proposal) => {
    setEditingId(p.id);
    setFormDesc(p.description);
    setFormValue(p.value.toString());
    setFormStatus(p.status);
    setFormValidUntil(p.valid_until ? new Date(p.valid_until) : undefined);
    setShowForm(true);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Summary */}
        <div className="bg-muted/30 rounded-xl px-4 py-3 text-center space-y-0.5">
          <p className="text-xl font-extrabold text-foreground">{formatCurrency(totalValue)}</p>
          <p className="text-[11px] text-muted-foreground">
            {proposals.length} {proposals.length === 1 ? "orçamento" : "orçamentos"}
            {pendingCount > 0 && ` · ${pendingCount} pendente${pendingCount > 1 ? "s" : ""}`}
          </p>
        </div>

        {!showForm && (
          <Button size="sm" className="w-full gap-1.5" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="w-3.5 h-3.5" /> Novo orçamento
          </Button>
        )}

        {showForm && (
          <div className="border border-border rounded-lg p-3 space-y-2.5 bg-muted/20">
            <p className="text-xs font-semibold">{editingId ? "Editar orçamento" : "Novo orçamento"}</p>
            <Input
              placeholder="Descrição *"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              placeholder="Valor (R$) *"
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              className="h-8 text-sm"
              type="text"
              inputMode="decimal"
            />
            <Select value={formStatus} onValueChange={setFormStatus}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-8 text-sm justify-start font-normal">
                  📅 Validade: {formValidUntil ? format(formValidUntil, "dd/MM/yyyy") : "Sem prazo"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formValidUntil}
                  onSelect={setFormValidUntil}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={handleSave} disabled={saving}>
                <Check className="w-3 h-3" /> {editingId ? "Atualizar" : "Salvar"}
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={resetForm}>
                <X className="w-3 h-3" /> Cancelar
              </Button>
            </div>
          </div>
        )}

        <Separator />

        {loading ? (
          <p className="text-xs text-muted-foreground text-center">Carregando...</p>
        ) : proposals.length === 0 ? (
          <div className="text-center py-6">
            <FileText className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum orçamento registrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {proposals.map((p) => {
              const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              return (
                <div key={p.id} className="bg-muted/20 rounded-lg px-3 py-2 group">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.description}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{formatCurrency(Number(p.value))}</span>
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 gap-0.5", cfg.badgeClass)}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </Badge>
                        {p.valid_until && (
                          <span className="text-[10px] text-muted-foreground">
                            Válido até {new Date(p.valid_until).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {p.status === "pending" && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600" onClick={() => handleStatusChange(p, "accepted")} title="Aceitar">
                          <CheckCircle className="w-3 h-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(p)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(p.id)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  {/* Status change for non-pending */}
                  {p.status !== "pending" && (
                    <div className="mt-1.5">
                      <Select value={p.status} onValueChange={(v) => handleStatusChange(p, v)}>
                        <SelectTrigger className="h-6 text-[10px] w-auto min-w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([key, c]) => (
                            <SelectItem key={key} value={key}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm create sale dialog */}
      <AlertDialog open={!!confirmSaleProposal} onOpenChange={(open) => !open && setConfirmSaleProposal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Criar venda automaticamente?</AlertDialogTitle>
            <AlertDialogDescription>
              O orçamento "{confirmSaleProposal?.description}" foi aceito.
              Deseja criar uma venda com o valor de {confirmSaleProposal ? formatCurrency(Number(confirmSaleProposal.value)) : ""}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirmSaleProposal && onCreateSaleFromProposal) {
                onCreateSaleFromProposal(confirmSaleProposal.description, Number(confirmSaleProposal.value));
              }
              setConfirmSaleProposal(null);
            }}>
              Sim, criar venda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  );
}
