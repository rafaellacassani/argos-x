import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Filter,
  X,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  Star,
  MessageCircle,
  Users,
  Tag,
  GitBranch,
  User,
  Send,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { FunnelStage, LeadTag } from "@/hooks/useLeads";

// Filter form types
export interface ChatFiltersFormData {
  // Period
  periodPreset: "any" | "today" | "yesterday" | "last7days" | "custom";
  dateFrom?: Date;
  dateTo?: Date;
  // Funnel stages
  stageIds: string[];
  // Starred
  starred: boolean;
  // Response status
  responseStatus: string[];
  // Interaction status
  interactionStatus: string;
  // Chat source
  chatSource: string[];
  // Responsible user
  responsibleUser: string;
  // Lead search
  leadSearch: string;
  // Participants
  participantSearch: string;
  // Last message sender
  lastMessageSender: "any" | "client" | "team";
  // Tags
  tagIds: string[];
}

const defaultValues: ChatFiltersFormData = {
  periodPreset: "any",
  stageIds: [],
  starred: false,
  responseStatus: [],
  interactionStatus: "",
  chatSource: [],
  responsibleUser: "",
  leadSearch: "",
  participantSearch: "",
  lastMessageSender: "any",
  tagIds: [],
};

interface ChatFiltersProps {
  stages: FunnelStage[];
  tags: LeadTag[];
  onFiltersChange: (filters: ChatFiltersFormData) => void;
  activeFiltersCount: number;
}

export function ChatFilters({
  stages,
  tags,
  onFiltersChange,
  activeFiltersCount,
}: ChatFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(["period", "sales"]);

  const { control, watch, reset, setValue, getValues } = useForm<ChatFiltersFormData>({
    defaultValues,
  });

  // Watch all form values
  const formValues = watch();

  // Sync with URL params on mount
  useEffect(() => {
    const params = Object.fromEntries(searchParams.entries());
    if (Object.keys(params).length > 0) {
      const newValues: Partial<ChatFiltersFormData> = { ...defaultValues };
      
      if (params.periodPreset) newValues.periodPreset = params.periodPreset as any;
      if (params.dateFrom) newValues.dateFrom = new Date(params.dateFrom);
      if (params.dateTo) newValues.dateTo = new Date(params.dateTo);
      if (params.stageIds) newValues.stageIds = params.stageIds.split(",");
      if (params.starred === "true") newValues.starred = true;
      if (params.responseStatus) newValues.responseStatus = params.responseStatus.split(",");
      if (params.interactionStatus) newValues.interactionStatus = params.interactionStatus;
      if (params.chatSource) newValues.chatSource = params.chatSource.split(",");
      if (params.responsibleUser) newValues.responsibleUser = params.responsibleUser;
      if (params.leadSearch) newValues.leadSearch = params.leadSearch;
      if (params.participantSearch) newValues.participantSearch = params.participantSearch;
      if (params.lastMessageSender) newValues.lastMessageSender = params.lastMessageSender as any;
      if (params.tagIds) newValues.tagIds = params.tagIds.split(",");

      reset(newValues as ChatFiltersFormData);
    }
  }, []);

  // Update URL when filters change
  const updateUrlParams = (values: ChatFiltersFormData) => {
    const params = new URLSearchParams();

    if (values.periodPreset !== "any") params.set("periodPreset", values.periodPreset);
    if (values.dateFrom) params.set("dateFrom", values.dateFrom.toISOString());
    if (values.dateTo) params.set("dateTo", values.dateTo.toISOString());
    if (values.stageIds.length > 0) params.set("stageIds", values.stageIds.join(","));
    if (values.starred) params.set("starred", "true");
    if (values.responseStatus.length > 0) params.set("responseStatus", values.responseStatus.join(","));
    if (values.interactionStatus) params.set("interactionStatus", values.interactionStatus);
    if (values.chatSource.length > 0) params.set("chatSource", values.chatSource.join(","));
    if (values.responsibleUser) params.set("responsibleUser", values.responsibleUser);
    if (values.leadSearch) params.set("leadSearch", values.leadSearch);
    if (values.participantSearch) params.set("participantSearch", values.participantSearch);
    if (values.lastMessageSender !== "any") params.set("lastMessageSender", values.lastMessageSender);
    if (values.tagIds.length > 0) params.set("tagIds", values.tagIds.join(","));

    setSearchParams(params, { replace: true });
  };

  const handleApplyFilters = () => {
    const values = getValues();
    updateUrlParams(values);
    onFiltersChange(values);
    setOpen(false);
  };

  const handleClearFilters = () => {
    reset(defaultValues);
    setSearchParams({}, { replace: true });
    onFiltersChange(defaultValues);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  // Date range helpers
  const getDateRangeFromPreset = (preset: string) => {
    const today = new Date();
    switch (preset) {
      case "today":
        return { from: startOfDay(today), to: endOfDay(today) };
      case "yesterday":
        const yesterday = subDays(today, 1);
        return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
      case "last7days":
        return { from: startOfDay(subDays(today, 7)), to: endOfDay(today) };
      default:
        return { from: undefined, to: undefined };
    }
  };

  // Group stages by position ranges (simulating groups)
  const stageGroups = [
    { name: "Entrada", stages: stages.filter((s) => s.position === 0) },
    { name: "Em Progresso", stages: stages.filter((s) => s.position > 0 && !s.is_win_stage && !s.is_loss_stage) },
    { name: "Fechamento", stages: stages.filter((s) => s.is_win_stage || s.is_loss_stage) },
  ].filter((g) => g.stages.length > 0);

  const chatSources = [
    { id: "whatsapp", label: "WhatsApp", icon: "📱" },
    { id: "instagram", label: "Instagram", icon: "📷" },
    { id: "website", label: "Site", icon: "🌐" },
    { id: "manual", label: "Manual", icon: "✍️" },
  ];

  const responseStatuses = [
    { id: "answered", label: "Respondido" },
    { id: "unanswered", label: "Sem resposta" },
  ];

  const interactionStatuses = [
    { id: "", label: "Todos" },
    { id: "ongoing", label: "Em andamento" },
    { id: "paused", label: "Pausado" },
    { id: "finished", label: "Finalizado" },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 relative",
            activeFiltersCount > 0 && "text-secondary"
          )}
        >
          <Filter className="w-4 h-4" />
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-secondary text-secondary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="font-display text-xl">Filtros</SheetTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Filtrar conversas por critérios avançados
              </p>
            </div>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-6">
                {activeFiltersCount} ativo{activeFiltersCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* Filter Content */}
        <ScrollArea className="flex-1 px-6">
          <div className="py-4 space-y-4">
            {/* Period Section */}
            <Collapsible
              open={expandedSections.includes("period")}
              onOpenChange={() => toggleSection("period")}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 group">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-display font-semibold text-sm">Período da conversa</span>
                </div>
                {expandedSections.includes("period") ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 pt-2"
                >
                  <Controller
                    name="periodPreset"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          if (value !== "custom") {
                            const range = getDateRangeFromPreset(value);
                            setValue("dateFrom", range.from);
                            setValue("dateTo", range.to);
                          }
                        }}
                      >
                        <SelectTrigger className="bg-muted/50">
                          <SelectValue placeholder="Selecione o período" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">A qualquer hora</SelectItem>
                          <SelectItem value="today">Hoje</SelectItem>
                          <SelectItem value="yesterday">Ontem</SelectItem>
                          <SelectItem value="last7days">Últimos 7 dias</SelectItem>
                          <SelectItem value="custom">Personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />

                  <AnimatePresence>
                    {formValues.periodPreset === "custom" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="grid grid-cols-2 gap-2"
                      >
                        <Controller
                          name="dateFrom"
                          control={control}
                          render={({ field }) => (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "justify-start text-left font-normal bg-muted/50",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value
                                    ? format(field.value, "dd/MM/yy", { locale: ptBR })
                                    : "De"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                  className="pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                          )}
                        />
                        <Controller
                          name="dateTo"
                          control={control}
                          render={({ field }) => (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "justify-start text-left font-normal bg-muted/50",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {field.value
                                    ? format(field.value, "dd/MM/yy", { locale: ptBR })
                                    : "Até"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  initialFocus
                                  className="pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                          )}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </CollapsibleContent>
            </Collapsible>

            {/* Sales Section */}
            <Collapsible
              open={expandedSections.includes("sales")}
              onOpenChange={() => toggleSection("sales")}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 group">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-muted-foreground" />
                  <span className="font-display font-semibold text-sm">Vendas</span>
                </div>
                {expandedSections.includes("sales") ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 pt-2"
                >
                  {/* Funnel Stages */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Etapas do Funil
                    </Label>
                    <Controller
                      name="stageIds"
                      control={control}
                      render={({ field }) => (
                        <div className="space-y-2">
                          {stageGroups.map((group) => (
                            <div key={group.name} className="space-y-1">
                              <span className="text-xs font-medium text-muted-foreground">
                                {group.name}
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {group.stages.map((stage) => {
                                  const isSelected = field.value.includes(stage.id);
                                  return (
                                    <Badge
                                      key={stage.id}
                                      variant={isSelected ? "default" : "outline"}
                                      className={cn(
                                        "cursor-pointer transition-all text-xs",
                                        isSelected
                                          ? "bg-secondary text-secondary-foreground"
                                          : "hover:bg-muted"
                                      )}
                                      style={{
                                        borderColor: stage.color,
                                        backgroundColor: isSelected ? stage.color : undefined,
                                        color: isSelected ? "#fff" : undefined,
                                      }}
                                      onClick={() => {
                                        const newValue = isSelected
                                          ? field.value.filter((id) => id !== stage.id)
                                          : [...field.value, stage.id];
                                        field.onChange(newValue);
                                      }}
                                    >
                                      {stage.name}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    />
                  </div>

                  {/* Tags */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Tags
                    </Label>
                    <Controller
                      name="tagIds"
                      control={control}
                      render={({ field }) => (
                        <div className="flex flex-wrap gap-1.5">
                          {tags.length > 0 ? (
                            tags.map((tag) => {
                              const isSelected = field.value.includes(tag.id);
                              return (
                                <Badge
                                  key={tag.id}
                                  variant={isSelected ? "default" : "outline"}
                                  className="cursor-pointer transition-all text-xs"
                                  style={{
                                    borderColor: tag.color,
                                    backgroundColor: isSelected ? tag.color : undefined,
                                    color: isSelected ? "#fff" : undefined,
                                  }}
                                  onClick={() => {
                                    const newValue = isSelected
                                      ? field.value.filter((id) => id !== tag.id)
                                      : [...field.value, tag.id];
                                    field.onChange(newValue);
                                  }}
                                >
                                  <Tag className="w-3 h-3 mr-1" />
                                  {tag.name}
                                </Badge>
                              );
                            })
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Nenhuma tag cadastrada
                            </span>
                          )}
                        </div>
                      )}
                    />
                  </div>
                </motion.div>
              </CollapsibleContent>
            </Collapsible>

            {/* Relationship Section */}
            <Collapsible
              open={expandedSections.includes("relationship")}
              onOpenChange={() => toggleSection("relationship")}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 group">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="font-display font-semibold text-sm">Relacionamento</span>
                </div>
                {expandedSections.includes("relationship") ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 pt-2"
                >
                  {/* Starred */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Controller
                      name="starred"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          id="starred"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <Label htmlFor="starred" className="flex items-center gap-2 cursor-pointer">
                      <Star className="w-4 h-4 text-warning" />
                      <span>Conversas destacadas</span>
                    </Label>
                  </div>

                  {/* Response Status */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Status de Resposta
                    </Label>
                    <Controller
                      name="responseStatus"
                      control={control}
                      render={({ field }) => (
                        <div className="space-y-2">
                          {responseStatuses.map((status) => {
                            const isChecked = field.value.includes(status.id);
                            return (
                              <div
                                key={status.id}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                              >
                                <Checkbox
                                  id={status.id}
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    const newValue = checked
                                      ? [...field.value, status.id]
                                      : field.value.filter((id) => id !== status.id);
                                    field.onChange(newValue);
                                  }}
                                />
                                <Label htmlFor={status.id} className="cursor-pointer text-sm">
                                  {status.label}
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    />
                  </div>

                  {/* Interaction Status */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Status de Interação
                    </Label>
                    <Controller
                      name="interactionStatus"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="bg-muted/50">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {interactionStatuses.map((status) => (
                              <SelectItem key={status.id} value={status.id || "all"}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* Last Message Sender */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Remetente da Última Mensagem
                    </Label>
                    <Controller
                      name="lastMessageSender"
                      control={control}
                      render={({ field }) => (
                        <div className="flex gap-2">
                          {[
                            { id: "any", label: "Todos" },
                            { id: "client", label: "Cliente" },
                            { id: "team", label: "Equipe" },
                          ].map((option) => (
                            <Button
                              key={option.id}
                              type="button"
                              variant={field.value === option.id ? "default" : "outline"}
                              size="sm"
                              className={cn(
                                "flex-1",
                                field.value === option.id && "bg-secondary hover:bg-secondary/90"
                              )}
                              onClick={() => field.onChange(option.id)}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    />
                  </div>
                </motion.div>
              </CollapsibleContent>
            </Collapsible>

            {/* Source Section */}
            <Collapsible
              open={expandedSections.includes("source")}
              onOpenChange={() => toggleSection("source")}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 group">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span className="font-display font-semibold text-sm">Origem</span>
                </div>
                {expandedSections.includes("source") ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 pt-2"
                >
                  {/* Chat Source */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Fonte do Bate-papo
                    </Label>
                    <Controller
                      name="chatSource"
                      control={control}
                      render={({ field }) => (
                        <div className="grid grid-cols-2 gap-2">
                          {chatSources.map((source) => {
                            const isSelected = field.value.includes(source.id);
                            return (
                              <Button
                                key={source.id}
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                  "justify-start",
                                  isSelected && "bg-secondary hover:bg-secondary/90"
                                )}
                                onClick={() => {
                                  const newValue = isSelected
                                    ? field.value.filter((id) => id !== source.id)
                                    : [...field.value, source.id];
                                  field.onChange(newValue);
                                }}
                              >
                                <span className="mr-2">{source.icon}</span>
                                {source.label}
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    />
                  </div>

                  {/* Responsible User */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Usuário Responsável
                    </Label>
                    <Controller
                      name="responsibleUser"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="bg-muted/50">
                            <User className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Qualquer usuário" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Qualquer usuário</SelectItem>
                            <SelectItem value="me">Eu</SelectItem>
                            <SelectItem value="unassigned">Não atribuído</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </motion.div>
              </CollapsibleContent>
            </Collapsible>

            {/* Search Section */}
            <Collapsible
              open={expandedSections.includes("search")}
              onOpenChange={() => toggleSection("search")}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 group">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-muted-foreground" />
                  <span className="font-display font-semibold text-sm">Busca</span>
                </div>
                {expandedSections.includes("search") ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 pt-2"
                >
                  {/* Lead Search */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Buscar Lead
                    </Label>
                    <Controller
                      name="leadSearch"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          placeholder="Nome ou telefone do lead..."
                          className="bg-muted/50"
                        />
                      )}
                    />
                  </div>

                  {/* Participant Search */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      Buscar Participante
                    </Label>
                    <Controller
                      name="participantSearch"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          placeholder="Nome do cliente..."
                          className="bg-muted/50"
                        />
                      )}
                    />
                  </div>
                </motion.div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>

        {/* Footer */}
        <SheetFooter className="p-6 pt-4 border-t border-border gap-2">
          <Button
            variant="outline"
            onClick={handleClearFilters}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            Limpar filtros
          </Button>
          <Button
            onClick={handleApplyFilters}
            className="flex-1 bg-secondary hover:bg-secondary/90"
          >
            <Filter className="w-4 h-4 mr-2" />
            Aplicar filtros
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Helper to count active filters
export function countActiveFilters(filters: ChatFiltersFormData): number {
  let count = 0;
  
  if (filters.periodPreset !== "any") count++;
  if (filters.stageIds.length > 0) count++;
  if (filters.starred) count++;
  if (filters.responseStatus.length > 0) count++;
  if (filters.interactionStatus) count++;
  if (filters.chatSource.length > 0) count++;
  if (filters.responsibleUser) count++;
  if (filters.leadSearch) count++;
  if (filters.participantSearch) count++;
  if (filters.lastMessageSender !== "any") count++;
  if (filters.tagIds.length > 0) count++;
  
  return count;
}
