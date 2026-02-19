import { useState, useMemo, useEffect } from "react";
import {
  PanelRightClose,
  PanelRightOpen,
  Plus,
  X,
  Phone,
  Mail,
  Building2,
  User,
  Edit2,
  Check,
  ChevronDown,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { type Lead, type FunnelStage, type LeadTag, type LeadSale } from "@/hooks/useLeads";
import { supabase } from "@/integrations/supabase/client";
import { LeadStatsTab } from "./LeadStatsTab";

interface LeadSidePanelProps {
  lead: Lead | null;
  stages: FunnelStage[];
  tags: LeadTag[];
  isOpen: boolean;
  onToggle: () => void;
  onUpdateLead: (leadId: string, updates: Partial<Lead>) => Promise<unknown>;
  onMoveLead: (leadId: string, newStageId: string, newPosition: number) => Promise<unknown>;
  onAddTag: (leadId: string, tagId: string) => Promise<boolean>;
  onRemoveTag: (leadId: string, tagId: string) => Promise<boolean>;
  onCreateTag: (name: string, color: string) => Promise<LeadTag | null>;
}

// Inline editable field
function InlineEditField({
  label,
  value,
  icon: Icon,
  type = "text",
  onSave,
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
  type?: string;
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const save = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  return (
    <div className="flex items-center gap-2 group py-1.5">
      {Icon && <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              type={type}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-7 text-sm px-2"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && save()}
              onBlur={save}
            />
          </div>
        ) : (
          <div
            className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 min-h-[24px]"
            onClick={() => setEditing(true)}
          >
            <span className={cn("text-sm truncate", !value && "text-muted-foreground italic")}>
              {value || "Não informado"}
            </span>
            <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
          </div>
        )}
      </div>
    </div>
  );
}

const TAG_COLORS = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280"];

export function LeadSidePanel({
  lead,
  stages,
  tags,
  isOpen,
  onToggle,
  onUpdateLead,
  onMoveLead,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: LeadSidePanelProps) {
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [responsibleName, setResponsibleName] = useState<string | null>(null);

  // Fetch responsible user name
  useEffect(() => {
    if (!lead?.responsible_user) {
      setResponsibleName(null);
      return;
    }
    supabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", lead.responsible_user)
      .single()
      .then(({ data }) => setResponsibleName(data?.full_name || null));
  }, [lead?.responsible_user]);

  // Current stage info
  const currentStage = useMemo(
    () => stages.find((s) => s.id === lead?.stage_id),
    [stages, lead?.stage_id]
  );

  // Sorted stages for progress
  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages]
  );

  // Progress percentage
  const progressPercent = useMemo(() => {
    if (!currentStage || sortedStages.length === 0) return 0;
    const idx = sortedStages.findIndex((s) => s.id === currentStage.id);
    return Math.round(((idx + 1) / sortedStages.length) * 100);
  }, [currentStage, sortedStages]);

  // Days in current stage
  const daysInStage = useMemo(() => {
    if (!lead) return 0;
    const updated = new Date(lead.updated_at);
    const now = new Date();
    return Math.max(0, Math.floor((now.getTime() - updated.getTime()) / 86400000));
  }, [lead?.updated_at]);

  // Tags on this lead
  const assignedTags = useMemo(
    () => lead?.tags || [],
    [lead?.tags]
  );

  const assignedTagIds = useMemo(
    () => new Set(assignedTags.map((t) => t.id)),
    [assignedTags]
  );

  const availableTags = useMemo(
    () => tags.filter((t) => !assignedTagIds.has(t.id)),
    [tags, assignedTagIds]
  );

  // Short ID from UUID
  const shortId = lead ? `#${lead.id.slice(0, 6).toUpperCase()}` : "";

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  if (!lead) return null;

  // Collapse toggle button (always visible)
  if (!isOpen) {
    return (
      <div className="flex items-start border-l border-border bg-card">
        <Button
          variant="ghost"
          size="icon"
          className="m-2"
          onClick={onToggle}
          title="Abrir painel do lead"
        >
          <PanelRightOpen className="w-5 h-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col overflow-hidden">
      {/* Panel Header */}
      <div className="p-4 border-b border-border bg-gradient-to-br from-[hsl(var(--primary)/0.08)] to-transparent">
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-lg text-foreground truncate">{lead.name}</h3>
            <span className="text-xs text-muted-foreground font-mono">{shortId}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-1" onClick={onToggle}>
            <PanelRightClose className="w-4 h-4" />
          </Button>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {assignedTags.map((tag) => (
            <Badge
              key={tag.id}
              className="text-[10px] px-2 py-0.5 cursor-pointer group/tag"
              style={{ backgroundColor: tag.color, color: "#fff" }}
              onClick={() => onRemoveTag(lead.id, tag.id)}
            >
              {tag.name}
              <X className="w-2.5 h-2.5 ml-1 opacity-0 group-hover/tag:opacity-100" />
            </Badge>
          ))}
          <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
            <PopoverTrigger asChild>
              <button className="w-5 h-5 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center hover:bg-muted/50 transition-colors">
                <Plus className="w-3 h-3 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar tag..." />
                <CommandList>
                  <CommandEmpty>
                    <div className="p-2 space-y-2">
                      <Input
                        placeholder="Nova tag..."
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        className="h-8 text-sm"
                      />
                      <div className="flex gap-1">
                        {TAG_COLORS.map((c) => (
                          <button
                            key={c}
                            className={cn(
                              "w-5 h-5 rounded-full border-2",
                              newTagColor === c ? "border-foreground" : "border-transparent"
                            )}
                            style={{ backgroundColor: c }}
                            onClick={() => setNewTagColor(c)}
                          />
                        ))}
                      </div>
                      {newTagName && (
                        <Button
                          size="sm"
                          className="w-full h-7 text-xs"
                          onClick={async () => {
                            const tag = await onCreateTag(newTagName, newTagColor);
                            if (tag) {
                              await onAddTag(lead.id, tag.id);
                              setNewTagName("");
                              setTagPopoverOpen(false);
                            }
                          }}
                        >
                          Criar "{newTagName}"
                        </Button>
                      )}
                    </div>
                  </CommandEmpty>
                  <CommandGroup>
                    {availableTags.map((tag) => (
                      <CommandItem
                        key={tag.id}
                        onSelect={async () => {
                          await onAddTag(lead.id, tag.id);
                          setTagPopoverOpen(false);
                        }}
                      >
                        <div
                          className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Funnel Section */}
      <div className="px-4 py-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Funil de vendas</span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {daysInStage} {daysInStage === 1 ? "dia" : "dias"}
          </span>
        </div>
        <Select
          value={lead.stage_id}
          onValueChange={(newStageId) => {
            if (newStageId !== lead.stage_id) {
              onMoveLead(lead.id, newStageId, 0);
            }
          }}
        >
          <SelectTrigger className="h-9 text-sm">
            <div className="flex items-center gap-2">
              {currentStage && (
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: currentStage.color }} />
              )}
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {sortedStages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                  {stage.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="space-y-1">
          <Progress value={progressPercent} className="h-1.5" />
          <div className="flex justify-between">
            <span className="text-[10px] text-muted-foreground">{sortedStages[0]?.name}</span>
            <span className="text-[10px] text-muted-foreground">{sortedStages[sortedStages.length - 1]?.name}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="principal" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full rounded-none border-b border-border bg-transparent h-auto p-0 justify-start">
          <TabsTrigger
            value="principal"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 text-xs"
          >
            Principal
          </TabsTrigger>
          <TabsTrigger
            value="stats"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 text-xs"
          >
            Estatísticas
          </TabsTrigger>
          <TabsTrigger
            value="sales"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 text-xs"
          >
            Vendas
          </TabsTrigger>
          <TabsTrigger
            value="followups"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 py-2 text-xs"
          >
            Follow-ups
          </TabsTrigger>
        </TabsList>

        {/* Principal Tab */}
        <TabsContent value="principal" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Responsible */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Responsável</p>
                <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{responsibleName || "Não atribuído"}</span>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-foreground mb-2">Dados do contato</p>
                <InlineEditField
                  label="Nome"
                  value={lead.name}
                  icon={User}
                  onSave={(val) => onUpdateLead(lead.id, { name: val })}
                />
                <InlineEditField
                  label="Celular"
                  value={lead.phone}
                  icon={Phone}
                  type="tel"
                  onSave={(val) => onUpdateLead(lead.id, { phone: val })}
                />
                <InlineEditField
                  label="E-mail"
                  value={lead.email || ""}
                  icon={Mail}
                  type="email"
                  onSave={(val) => onUpdateLead(lead.id, { email: val })}
                />
                <InlineEditField
                  label="Empresa"
                  value={lead.company || ""}
                  icon={Building2}
                  onSave={(val) => onUpdateLead(lead.id, { company: val })}
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground mb-1">Observações</p>
                <InlineEditField
                  label="Notas"
                  value={lead.notes || ""}
                  onSave={(val) => onUpdateLead(lead.id, { notes: val })}
                />
              </div>

              {/* Value */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground mb-1">Valor do lead</p>
                <div className="bg-muted/30 rounded-lg px-3 py-2 text-lg font-bold text-foreground">
                  {formatCurrency(lead.value || 0)}
                </div>
              </div>

              {/* Source */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Origem</p>
                <Badge variant="outline" className="text-xs">{lead.source || "manual"}</Badge>
              </div>

              {/* Created */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Criado em</p>
                <span className="text-xs text-muted-foreground">
                  {new Date(lead.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="stats" className="flex-1 m-0 overflow-hidden">
          <LeadStatsTab lead={lead} stages={stages} />
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {lead.sales && lead.sales.length > 0 ? (
                <>
                  <div className="bg-muted/30 rounded-lg px-3 py-2 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total em vendas</p>
                    <p className="text-lg font-bold text-foreground">{formatCurrency(lead.total_sales_value || 0)}</p>
                  </div>
                  {lead.sales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2">
                      <span className="text-sm">{sale.product_name}</span>
                      <span className="text-sm font-semibold">{formatCurrency(sale.value)}</span>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-sm text-center text-muted-foreground">Nenhuma venda registrada.</p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Follow-ups Tab */}
        <TabsContent value="followups" className="flex-1 m-0">
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">Follow-ups em breve.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
