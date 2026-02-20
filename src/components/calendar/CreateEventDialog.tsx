import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Video, Phone, CheckSquare, Bell, Loader2 } from "lucide-react";
import type { CalendarEvent, CreateEventData } from "@/hooks/useCalendar";
import { format, addHours } from "date-fns";

interface Lead {
  id: string;
  name: string;
}

const EVENT_TYPES = [
  { value: "meeting", label: "Reunião", icon: <Video className="w-4 h-4" /> },
  { value: "call", label: "Ligação", icon: <Phone className="w-4 h-4" /> },
  { value: "task", label: "Tarefa", icon: <CheckSquare className="w-4 h-4" /> },
  { value: "reminder", label: "Lembrete", icon: <Bell className="w-4 h-4" /> },
];

const COLOR_PALETTE = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
];

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  selectedDate: Date;
  googleConnected: boolean;
  onSave: (data: CreateEventData) => Promise<void>;
}

export function CreateEventDialog({
  open,
  onOpenChange,
  event,
  selectedDate,
  googleConnected,
  onSave,
}: CreateEventDialogProps) {
  const { workspaceId } = useWorkspace();
  const [saving, setSaving] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState("meeting");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [leadId, setLeadId] = useState<string>("");
  const [syncGoogle, setSyncGoogle] = useState(true);

  // Load leads
  useEffect(() => {
    if (!open || !workspaceId) return;
    setLoadingLeads(true);
    supabase
      .from("leads")
      .select("id, name")
      .order("name")
      .limit(200)
      .then(({ data }) => {
        setLeads((data as Lead[]) || []);
        setLoadingLeads(false);
      });
  }, [open, workspaceId]);

  // Reset / populate form
  useEffect(() => {
    if (!open) return;
    if (event) {
      setTitle(event.title);
      setType(event.type);
      setStartDate(format(new Date(event.start_at), "yyyy-MM-dd"));
      setStartTime(format(new Date(event.start_at), "HH:mm"));
      setEndDate(format(new Date(event.end_at), "yyyy-MM-dd"));
      setEndTime(format(new Date(event.end_at), "HH:mm"));
      setAllDay(event.all_day);
      setDescription(event.description || "");
      setLocation(event.location || "");
      setColor(event.color || "#3B82F6");
      setLeadId(event.lead_id || "");
      setSyncGoogle(event.synced_to_google);
    } else {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      setTitle("");
      setType("meeting");
      setStartDate(dateStr);
      setStartTime("09:00");
      setEndDate(dateStr);
      setEndTime("10:00");
      setAllDay(false);
      setDescription("");
      setLocation("");
      setColor("#3B82F6");
      setLeadId("");
      setSyncGoogle(true);
    }
  }, [open, event, selectedDate]);

  // Auto-fill title when lead changes
  const handleLeadChange = (newLeadId: string) => {
    setLeadId(newLeadId);
    if (!title && newLeadId && newLeadId !== "none") {
      const lead = leads.find(l => l.id === newLeadId);
      if (lead) {
        setTitle(`Call com ${lead.name}`);
      }
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);

    const startAt = allDay
      ? `${startDate}T00:00:00`
      : `${startDate}T${startTime}:00`;
    const endAt = allDay
      ? `${endDate}T23:59:59`
      : `${endDate}T${endTime}:00`;

    await onSave({
      title: title.trim(),
      type,
      start_at: new Date(startAt).toISOString(),
      end_at: new Date(endAt).toISOString(),
      all_day: allDay,
      description: description || undefined,
      location: location || undefined,
      color,
      lead_id: leadId && leadId !== "none" ? leadId : undefined,
    });

    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? "Editar Evento" : "Novo Evento"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input
              placeholder="Título do evento"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <div className="flex gap-2">
              {EVENT_TYPES.map(t => (
                <Button
                  key={t.value}
                  type="button"
                  variant={type === t.value ? "secondary" : "outline"}
                  size="sm"
                  className="gap-1.5 flex-1"
                  onClick={() => setType(t.value)}
                >
                  {t.icon}
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          {/* All day toggle */}
          <div className="flex items-center gap-3">
            <Switch checked={allDay} onCheckedChange={setAllDay} />
            <Label>Dia inteiro</Label>
          </div>

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data início</Label>
              <Input type="date" value={startDate} onChange={e => {
                setStartDate(e.target.value);
                if (!endDate || e.target.value > endDate) setEndDate(e.target.value);
              }} />
            </div>
            {!allDay && (
              <div className="space-y-1.5">
                <Label>Hora início</Label>
                <Input type="time" value={startTime} onChange={e => {
                  setStartTime(e.target.value);
                  // Auto-set end time to +1h
                  const [h, m] = e.target.value.split(":").map(Number);
                  const endH = Math.min(h + 1, 23);
                  setEndTime(`${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
                }} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Data fim</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            {!allDay && (
              <div className="space-y-1.5">
                <Label>Hora fim</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              placeholder="Detalhes do evento..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label>Local</Label>
            <Input
              placeholder="Local ou link da reunião"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex gap-2">
              {COLOR_PALETTE.map(c => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    "w-7 h-7 rounded-full transition-all",
                    color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          {/* Lead */}
          <div className="space-y-1.5">
            <Label>Lead vinculado</Label>
            <Select value={leadId || "none"} onValueChange={handleLeadChange}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {leads.map(lead => (
                  <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Google sync toggle */}
          {googleConnected && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Switch checked={syncGoogle} onCheckedChange={setSyncGoogle} />
              <div>
                <Label className="text-sm font-medium">Sincronizar com Google Calendar</Label>
                <p className="text-xs text-muted-foreground">O evento será enviado para o Google Calendar</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {event ? "Salvar" : "Criar Evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
