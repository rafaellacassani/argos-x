import { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  X, Phone, Mail, Building2, MessageSquare, Calendar, DollarSign,
  User, Tag, ChevronRight, Trash2, Plus, Edit2, Check, FileText,
  History, BarChart3, CalendarClock,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/hooks/use-toast";
import type { Lead, FunnelStage, LeadTag, LeadHistory } from "@/hooks/useLeads";
import { LeadSalesTab } from "@/components/chat/LeadSalesTab";
import { LeadProposalsTab } from "./LeadProposalsTab";
import { LeadFollowupsTab } from "@/components/chat/LeadFollowupsTab";
import { LeadStatsTab } from "@/components/chat/LeadStatsTab";

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string;
}

export interface LeadDetailModalProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: FunnelStage[];
  tags: LeadTag[];
  onUpdate: (leadId: string, updates: Partial<Lead>) => Promise<unknown>;
  onMove: (leadId: string, stageId: string) => void;
  onDelete: (leadId: string) => void;
  onAddTag: (leadId: string, tagId: string) => void;
  onRemoveTag: (leadId: string, tagId: string) => void;
  onOpenChat?: () => void;
  canDelete?: boolean;
  teamMembers?: TeamMember[];
}

// Inline edit field
function InlineEditField({
  label, value, icon: Icon, type = "text", onSave, multiline = false,
}: {
  label: string; value: string; icon?: React.ElementType; type?: string;
  onSave: (val: string) => void; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const save = () => { setEditing(false); if (draft !== value) onSave(draft); };

  return (
    <div className="flex items-start gap-2 group py-1">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
        {editing ? (
          multiline ? (
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)}
              className="text-sm min-h-[60px] resize-none" autoFocus onBlur={save} />
          ) : (
            <Input type={type} value={draft} onChange={(e) => setDraft(e.target.value)}
              className="h-7 text-sm px-2" autoFocus
              onKeyDown={(e) => e.key === "Enter" && save()} onBlur={save} />
          )
        ) : (
          <div className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 min-h-[24px]"
            onClick={() => setEditing(true)}>
            <span className={`text-sm truncate ${!value ? "text-muted-foreground italic" : ""}`}>
              {value || "Não informado"}
            </span>
            <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
}

export function LeadDetailModal({
  lead, open, onOpenChange, stages, tags,
  onUpdate, onMove, onDelete, onAddTag, onRemoveTag,
  onOpenChat, canDelete = true, teamMembers = [],
}: LeadDetailModalProps) {
  const { workspaceId } = useWorkspace();
  const [history, setHistory] = useState<LeadHistory[]>([]);
  const [performerNames, setPerformerNames] = useState<Record<string, string>>({});
  const [responsibleName, setResponsibleName] = useState<string | null>(null);

  // Fetch history
  useEffect(() => {
    if (!lead) return;
    supabase.from("lead_history")
      .select(`*, from_stage:funnel_stages!lead_history_from_stage_id_fkey(id, name, color),
        to_stage:funnel_stages!lead_history_to_stage_id_fkey(id, name, color)`)
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const items = (data || []) as unknown as LeadHistory[];
        setHistory(items);
        const userIds = [...new Set(items.map(h => h.performed_by).filter(Boolean))] as string[];
        if (userIds.length > 0) {
          supabase.from("user_profiles").select("id, full_name").in("id", userIds)
            .then(({ data: profiles }) => {
              const map: Record<string, string> = {};
              (profiles || []).forEach(p => { map[p.id] = p.full_name; });
              setPerformerNames(map);
            });
        }
      });
  }, [lead?.id]);

  // Fetch responsible name
  useEffect(() => {
    if (!lead?.responsible_user) { setResponsibleName(null); return; }
    supabase.from("user_profiles").select("full_name").eq("id", lead.responsible_user).single()
      .then(({ data }) => setResponsibleName(data?.full_name || null));
  }, [lead?.responsible_user]);

  if (!lead) return null;

  const initials = lead.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const currentStage = stages.find(s => s.id === lead.stage_id);
  const sortedStages = [...stages].sort((a, b) => a.position - b.position);
  const availableTags = tags.filter(t => !lead.tags?.some(lt => lt.id === t.id));
  const shortId = `#${lead.id.slice(0, 6).toUpperCase()}`;

  const progressPercent = (() => {
    if (!currentStage || sortedStages.length === 0) return 0;
    const idx = sortedStages.findIndex(s => s.id === currentStage.id);
    return Math.round(((idx + 1) / sortedStages.length) * 100);
  })();

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

  const getActionLabel = (action: string) => {
    switch (action) {
      case "created": return "Lead criado";
      case "stage_changed": case "moved": case "stage_change": return "Mudou de fase";
      case "updated": return "Atualizado";
      default: return action;
    }
  };

  const handleCreateSaleFromProposal = async (productName: string, value: number) => {
    if (!workspaceId) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("lead_sales").insert({
      lead_id: lead.id,
      workspace_id: workspaceId,
      product_name: productName,
      value: value,
      created_by: userData.user?.id || null,
    });
    // Sync lead value
    const { data: freshSales } = await supabase.from("lead_sales").select("value").eq("lead_id", lead.id);
    const newTotal = (freshSales || []).reduce((s, r) => s + Number(r.value), 0);
    await supabase.from("leads").update({ value: newTotal }).eq("id", lead.id);
    await onUpdate(lead.id, { value: newTotal });
    toast({ title: "Venda criada a partir do orçamento!" });
  };

  const sourceLabel = (lead.source || "manual").toLowerCase();
  const sourceBadge = sourceLabel === "whatsapp" ? { icon: MessageSquare, label: "WhatsApp", class: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" }
    : sourceLabel === "facebook" ? { icon: MessageSquare, label: "Facebook", class: "bg-blue-500/15 text-blue-700 border-blue-500/30" }
    : sourceLabel === "instagram" ? { icon: MessageSquare, label: "Instagram", class: "bg-pink-500/15 text-pink-700 border-pink-500/30" }
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-[1200px] h-[90vh] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogTitle className="sr-only">Detalhes do Lead - {lead.name}</DialogTitle>

        {/* HEADER */}
        <div className="bg-[#060369] text-white p-4 lg:p-5 flex items-center gap-4 flex-shrink-0">
          <Avatar className="h-12 w-12 border-2 border-white/20">
            <AvatarImage src={lead.avatar_url} alt={lead.name} />
            <AvatarFallback className="bg-white/10 text-white text-lg font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate">{lead.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-white/60 font-mono">{shortId}</span>
              {sourceBadge && (
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${sourceBadge.class}`}>
                  {sourceBadge.label}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenChat && (
              <Button variant="outline" size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
                onClick={onOpenChat}>
                <MessageSquare className="h-4 w-4 mr-1.5" />Chat
              </Button>
            )}
            <Button variant="outline" size="sm"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white" asChild>
              <a href={`tel:${lead.phone}`}><Phone className="h-4 w-4 mr-1.5" />Ligar</a>
            </Button>
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm"
                    className="bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30 hover:text-red-200">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir Lead?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => { onDelete(lead.id); onOpenChange(false); }}>
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* BODY: sidebar + main */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT SIDEBAR (30%) */}
          <ScrollArea className="w-[30%] min-w-[260px] border-r border-border bg-muted/10">
            <div className="p-4 space-y-5">
              {/* Stage */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5" /> Fase do Lead
                </p>
                <Select value={lead.stage_id} onValueChange={(v) => onMove(lead.id, v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <div className="flex items-center gap-2">
                      {currentStage && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentStage.color }} />}
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {sortedStages.filter(s => s.id).map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Progress value={progressPercent} className="h-1.5" />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> Tags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(lead.tags || []).map(tag => (
                    <Badge key={tag.id} className="text-[10px] px-2 py-0.5 cursor-pointer group/tag"
                      style={{ backgroundColor: tag.color, color: "#fff" }}
                      onClick={() => onRemoveTag(lead.id, tag.id)}>
                      {tag.name}
                      <X className="w-2.5 h-2.5 ml-1 opacity-0 group-hover/tag:opacity-100" />
                    </Badge>
                  ))}
                  {availableTags.length > 0 && (
                    <Select onValueChange={(tagId) => onAddTag(lead.id, tagId)}>
                      <SelectTrigger className="h-5 w-5 p-0 bg-muted border-dashed border-muted-foreground/40 [&>svg]:hidden rounded-full">
                        <Plus className="w-3 h-3 text-muted-foreground" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTags.map(tag => (
                          <SelectItem key={tag.id} value={tag.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                              {tag.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Responsible */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Responsável
                </p>
                {teamMembers.length > 0 ? (
                  <Select value={lead.responsible_user || "__none__"} onValueChange={(v) => onUpdate(lead.id, { responsible_user: v === "__none__" ? null : v })}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Não atribuído" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Não atribuído</SelectItem>
                      {teamMembers.filter(m => m.id).map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-sm">{responsibleName || "Não atribuído"}</span>
                  </div>
                )}
              </div>

              {/* Contact fields */}
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-foreground mb-2">Dados do contato</p>
                <InlineEditField label="Nome" value={lead.name} icon={User}
                  onSave={(v) => onUpdate(lead.id, { name: v })} />
                <InlineEditField label="Telefone" value={lead.phone} icon={Phone} type="tel"
                  onSave={(v) => onUpdate(lead.id, { phone: v })} />
                <InlineEditField label="E-mail" value={lead.email || ""} icon={Mail} type="email"
                  onSave={(v) => onUpdate(lead.id, { email: v })} />
                <InlineEditField label="Empresa" value={lead.company || ""} icon={Building2}
                  onSave={(v) => onUpdate(lead.id, { company: v })} />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground mb-1">Observações</p>
                <InlineEditField label="Notas" value={lead.notes || ""} multiline
                  onSave={(v) => onUpdate(lead.id, { notes: v })} />
              </div>

              {/* Source & Created */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Origem</p>
                  <Badge variant="outline" className="text-xs mt-0.5">{lead.source || "manual"}</Badge>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Criado em</p>
                  <span className="text-xs text-muted-foreground">{formatDate(lead.created_at)}</span>
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* RIGHT MAIN AREA (70%) */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <Tabs defaultValue="sales" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="w-full rounded-none border-b border-border bg-transparent h-auto p-0 justify-start px-4">
                {[
                  { value: "sales", label: "Vendas", icon: DollarSign },
                  { value: "proposals", label: "Orçamentos", icon: FileText },
                  { value: "followups", label: "Follow-ups", icon: CalendarClock },
                  { value: "stats", label: "Estatísticas", icon: BarChart3 },
                  { value: "history", label: "Histórico", icon: History },
                ].map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm gap-1.5">
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="sales" className="flex-1 m-0 overflow-hidden">
                <LeadSalesTab lead={lead} onLeadValueChanged={(leadId, newValue) => onUpdate(leadId, { value: newValue })} />
              </TabsContent>

              <TabsContent value="proposals" className="flex-1 m-0 overflow-hidden">
                <LeadProposalsTab lead={lead} onCreateSaleFromProposal={handleCreateSaleFromProposal} />
              </TabsContent>

              <TabsContent value="followups" className="flex-1 m-0 overflow-hidden">
                <LeadFollowupsTab lead={lead} />
              </TabsContent>

              <TabsContent value="stats" className="flex-1 m-0 overflow-hidden">
                <LeadStatsTab lead={lead} stages={stages} />
              </TabsContent>

              <TabsContent value="history" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-3">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" /> Histórico de Atividades
                    </p>
                    {history.length > 0 ? (
                      <div className="relative pl-4 space-y-3">
                        <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
                        {history.map(entry => (
                          <div key={entry.id} className="relative flex gap-3">
                            <div className="absolute left-[-13px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-primary bg-background z-10" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{getActionLabel(entry.action)}</p>
                              {(entry.action === "stage_changed" || entry.action === "stage_change" || entry.action === "moved") && entry.from_stage && entry.to_stage && (
                                <div className="flex items-center gap-1 flex-wrap text-[11px] mt-0.5">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0"
                                    style={{ borderColor: (entry.from_stage as any).color }}>
                                    {(entry.from_stage as any).name}
                                  </Badge>
                                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                  <Badge className="text-[10px] px-1.5 py-0 text-white"
                                    style={{ backgroundColor: (entry.to_stage as any).color }}>
                                    {(entry.to_stage as any).name}
                                  </Badge>
                                </div>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {formatDateTime(entry.created_at)}
                                {entry.performed_by && performerNames[entry.performed_by] && (
                                  <> · por <span className="font-medium text-foreground">{performerNames[entry.performed_by]}</span></>
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6 italic">Nenhum histórico disponível</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
