import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  Phone,
  Video,
  CheckSquare,
  Bell,
  MoreHorizontal,
  Calendar,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useCalendar, type CalendarEvent } from "@/hooks/useCalendar";
import { CreateEventDialog } from "@/components/calendar/CreateEventDialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { format, addHours, isSameDay, startOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const EVENT_COLORS: Record<string, string> = {
  "#3B82F6": "bg-blue-500",
  "#10B981": "bg-emerald-500",
  "#F59E0B": "bg-amber-500",
  "#EF4444": "bg-red-500",
  "#8B5CF6": "bg-violet-500",
  "#EC4899": "bg-pink-500",
  "#06B6D4": "bg-cyan-500",
  "#F97316": "bg-orange-500",
};

const getEventBgClass = (color: string | null) => {
  if (!color) return "bg-primary";
  return EVENT_COLORS[color] || "bg-primary";
};

const getEventIcon = (type: string) => {
  switch (type) {
    case "call": return <Phone className="w-3 h-3" />;
    case "meeting": return <Video className="w-3 h-3" />;
    case "task": return <CheckSquare className="w-3 h-3" />;
    case "reminder": return <Bell className="w-3 h-3" />;
    default: return <Calendar className="w-3 h-3" />;
  }
};

const getEventIconLarge = (type: string) => {
  switch (type) {
    case "call": return <Phone className="w-4 h-4" />;
    case "meeting": return <Video className="w-4 h-4" />;
    case "task": return <CheckSquare className="w-4 h-4" />;
    case "reminder": return <Bell className="w-4 h-4" />;
    default: return <Calendar className="w-4 h-4" />;
  }
};

const formatEventTime = (dateStr: string) => {
  return format(new Date(dateStr), "HH:mm");
};

const getEventDuration = (start: string, end: string) => {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [leadNames, setLeadNames] = useState<Record<string, string>>({});

  const {
    events,
    loading,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    googleConnected,
    googleEmail,
  } = useCalendar();

  const { workspaceId } = useWorkspace();

  // Fetch events when month changes
  useEffect(() => {
    fetchEvents(currentDate.getFullYear(), currentDate.getMonth());
  }, [currentDate.getFullYear(), currentDate.getMonth(), fetchEvents]);

  // Fetch lead names for events with lead_id
  useEffect(() => {
    const leadIds = [...new Set(events.filter(e => e.lead_id).map(e => e.lead_id!))];
    if (leadIds.length === 0) return;

    const fetchLeadNames = async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, name")
        .in("id", leadIds);
      if (data) {
        const map: Record<string, string> = {};
        data.forEach(l => { map[l.id] = l.name; });
        setLeadNames(map);
      }
    };
    fetchLeadNames();
  }, [events]);

  // Build events by date map
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(event => {
      const dateKey = format(new Date(event.start_at), "yyyy-MM-dd");
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(event);
    });
    return map;
  }, [events]);

  const today = new Date();

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, daysInPrevMonth - i), isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  };

  const days = getDaysInMonth(currentDate);

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1));
      return newDate;
    });
  };

  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction === "next" ? 7 : -7));
      return newDate;
    });
  };

  const navigateDay = (direction: "prev" | "next") => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction === "next" ? 1 : -1));
      return newDate;
    });
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction === "next" ? 1 : -1));
      return newDate;
    });
  };

  // Selected day events
  const selectedDateKey = format(selectedDate, "yyyy-MM-dd");
  const selectedDayEvents = (eventsByDate[selectedDateKey] || []).sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );

  // Delete handler
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const success = await deleteEvent(deleteTarget.id);
    if (success) {
      toast({ title: "Evento excluído com sucesso" });
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  // Week view data
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 - 22:00

  // Render month view
  const renderMonthView = () => (
    <>
      <div className="grid grid-cols-7 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1 border-t border-l border-border">
        {days.map((dayObj, index) => {
          const dateKey = format(dayObj.date, "yyyy-MM-dd");
          const dayEvents = dayObj.isCurrentMonth ? (eventsByDate[dateKey] || []) : [];
          const isSelected = isSameDay(dayObj.date, selectedDate);
          const isToday = isSameDay(dayObj.date, today);

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.005 }}
              onClick={() => {
                setSelectedDate(dayObj.date);
              }}
              className={cn(
                "min-h-24 p-2 border-r border-b border-border cursor-pointer transition-colors",
                dayObj.isCurrentMonth ? "bg-card hover:bg-muted/50" : "bg-muted/30",
                isSelected && "bg-secondary/5 ring-2 ring-secondary ring-inset"
              )}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-sm mb-1",
                  isToday && "bg-secondary text-secondary-foreground font-bold",
                  !isToday && dayObj.isCurrentMonth && "text-foreground",
                  !dayObj.isCurrentMonth && "text-muted-foreground"
                )}
              >
                {dayObj.date.getDate()}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map(event => (
                  <div
                    key={event.id}
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded truncate text-white",
                      getEventBgClass(event.color)
                    )}
                  >
                    {!event.all_day && formatEventTime(event.start_at)} {event.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-muted-foreground px-1 hover:text-foreground transition-colors"
                      >
                        +{dayEvents.length - 2} mais
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3 pointer-events-auto" align="start">
                      <p className="font-medium text-sm mb-2">
                        {format(dayObj.date, "d 'de' MMMM", { locale: ptBR })}
                      </p>
                      <div className="space-y-1.5 max-h-48 overflow-auto">
                        {dayEvents.map(event => (
                          <div
                            key={event.id}
                            className={cn(
                              "text-xs px-2 py-1 rounded text-white flex items-center gap-1.5",
                              getEventBgClass(event.color)
                            )}
                          >
                            {getEventIcon(event.type)}
                            <span className="truncate">
                              {!event.all_day && formatEventTime(event.start_at)} {event.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </>
  );

  // Render week view
  const renderWeekView = () => (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-8 border-b border-border sticky top-0 bg-card z-10">
        <div className="p-2 text-xs text-muted-foreground border-r border-border" />
        {weekDates.map(date => {
          const isToday2 = isSameDay(date, today);
          return (
            <div
              key={date.toISOString()}
              className={cn("p-2 text-center border-r border-border", isToday2 && "bg-secondary/10")}
            >
              <p className="text-xs text-muted-foreground">{weekDays[date.getDay()]}</p>
              <p className={cn(
                "text-lg font-semibold",
                isToday2 ? "text-secondary" : "text-foreground"
              )}>
                {date.getDate()}
              </p>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-8">
        {hours.map(hour => (
          <div key={hour} className="contents">
            <div className="p-1 text-xs text-muted-foreground text-right pr-2 border-r border-border h-16 flex items-start justify-end">
              {String(hour).padStart(2, "0")}:00
            </div>
            {weekDates.map(date => {
              const dateKey = format(date, "yyyy-MM-dd");
              const hourEvents = (eventsByDate[dateKey] || []).filter(e => {
                const h = new Date(e.start_at).getHours();
                return h === hour;
              });
              const isToday2 = isSameDay(date, today);
              return (
                <div
                  key={`${dateKey}-${hour}`}
                  className={cn(
                    "border-r border-b border-border h-16 p-0.5 relative",
                    isToday2 && "bg-secondary/5"
                  )}
                >
                  {hourEvents.map(event => {
                    const durationHours = (new Date(event.end_at).getTime() - new Date(event.start_at).getTime()) / (1000 * 60 * 60);
                    const heightPx = Math.max(durationHours * 64, 20);
                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "absolute left-0.5 right-0.5 text-xs text-white rounded px-1 py-0.5 overflow-hidden cursor-pointer z-10",
                          getEventBgClass(event.color)
                        )}
                        style={{ height: `${heightPx}px` }}
                        onClick={() => {
                          setSelectedDate(date);
                          setEditingEvent(event);
                          setShowCreateDialog(true);
                        }}
                      >
                        <span className="font-medium truncate block">{formatEventTime(event.start_at)} {event.title}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  // Render day view
  const renderDayView = () => {
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    const dayEvts = eventsByDate[dateKey] || [];

    return (
      <div className="flex-1 overflow-auto">
        <div className="border-b border-border p-3 bg-card sticky top-0 z-10">
          <p className="font-semibold text-lg">
            {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        {hours.map(hour => {
          const hourEvents = dayEvts.filter(e => new Date(e.start_at).getHours() === hour);
          return (
            <div key={hour} className="flex border-b border-border">
              <div className="w-16 p-2 text-xs text-muted-foreground text-right pr-3 flex-shrink-0">
                {String(hour).padStart(2, "0")}:00
              </div>
              <div className="flex-1 min-h-16 p-1 space-y-1">
                {hourEvents.map(event => (
                  <div
                    key={event.id}
                    className={cn(
                      "text-sm text-white rounded px-3 py-2 cursor-pointer flex items-center gap-2",
                      getEventBgClass(event.color)
                    )}
                    onClick={() => { setEditingEvent(event); setShowCreateDialog(true); }}
                  >
                    {getEventIcon(event.type)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{event.title}</p>
                      <p className="text-xs opacity-80">
                        {formatEventTime(event.start_at)} - {formatEventTime(event.end_at)}
                        {event.lead_id && leadNames[event.lead_id] && ` · ${leadNames[event.lead_id]}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex gap-6">
      {/* Calendar */}
      <div className="flex-1 inboxia-card p-6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => view === "month" ? navigateMonth("prev") : view === "week" ? navigateWeek("prev") : navigateDay("prev")}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="font-display text-xl font-bold">
              {view === "day"
                ? format(selectedDate, "d 'de' MMMM yyyy", { locale: ptBR })
                : `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`
              }
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => view === "month" ? navigateMonth("next") : view === "week" ? navigateWeek("next") : navigateDay("next")}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {googleConnected ? (
              <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Sincronizado
              </Badge>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5 text-muted-foreground"
                onClick={() => window.location.href = "/settings"}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Conectar Google Calendar
              </Button>
            )}
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["day", "week", "month"] as const).map(v => (
                <Button
                  key={v}
                  variant={view === v ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setView(v)}
                  className="rounded-none"
                >
                  {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
                </Button>
              ))}
            </div>
            <Button className="gap-2" onClick={() => { setEditingEvent(null); setShowCreateDialog(true); }}>
              <Plus className="w-4 h-4" />
              Novo Evento
            </Button>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex-1 grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {view === "month" && renderMonthView()}
            {view === "week" && renderWeekView()}
            {view === "day" && renderDayView()}
          </>
        )}
      </div>

      {/* Sidebar - Selected Day Events */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-80 inboxia-card p-6 flex flex-col"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-lg">
            {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
          </h3>
        </div>

        {selectedDayEvents.length > 0 ? (
          <div className="space-y-3 flex-1 overflow-auto">
            {selectedDayEvents.map(event => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className={cn("p-1.5 rounded text-white", getEventBgClass(event.color))}>
                    {getEventIconLarge(event.type)}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditingEvent(event); setShowCreateDialog(true); }}>
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteTarget(event)}
                      >
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <h4 className="font-medium text-foreground mb-1">{event.title}</h4>
                {event.lead_id && leadNames[event.lead_id] && (
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                    <User className="w-3 h-3" />
                    {leadNames[event.lead_id]}
                  </p>
                )}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    {event.all_day
                      ? "Dia inteiro"
                      : `${formatEventTime(event.start_at)} - ${formatEventTime(event.end_at)} · ${getEventDuration(event.start_at, event.end_at)}`
                    }
                  </p>
                  {event.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      📍 {event.location}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Nenhum evento para este dia</p>
            <Button
              variant="link"
              className="mt-2"
              onClick={() => { setEditingEvent(null); setShowCreateDialog(true); }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar evento
            </Button>
          </div>
        )}
      </motion.div>

      {/* Create/Edit Dialog */}
      <CreateEventDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        event={editingEvent}
        selectedDate={selectedDate}
        googleConnected={googleConnected}
        onSave={async (data) => {
          if (editingEvent) {
            const success = await updateEvent(editingEvent.id, data);
            if (success) {
              toast({ title: "Evento atualizado com sucesso" });
              setShowCreateDialog(false);
              setEditingEvent(null);
            }
          } else {
            const created = await createEvent(data);
            if (created) {
              toast({ title: "Evento criado com sucesso" });
              setShowCreateDialog(false);
            }
          }
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir &ldquo;{deleteTarget?.title}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
              {deleteTarget?.synced_to_google && (
                <span className="block mt-2 font-medium text-foreground">
                  Este evento também será removido do Google Calendar.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
