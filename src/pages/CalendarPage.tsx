import { useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  Phone,
  Video,
  MapPin,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Event {
  id: string;
  title: string;
  time: string;
  duration: string;
  type: "call" | "meeting" | "task" | "reminder";
  contact?: string;
  color: string;
}

const events: Record<number, Event[]> = {
  15: [
    { id: "1", title: "Call com João Silva", time: "09:00", duration: "30min", type: "call", contact: "João Silva", color: "bg-secondary" },
    { id: "2", title: "Demo do produto", time: "14:00", duration: "1h", type: "meeting", contact: "Maria Santos", color: "bg-success" },
  ],
  16: [
    { id: "3", title: "Follow-up Lead", time: "10:00", duration: "15min", type: "task", color: "bg-warning" },
    { id: "4", title: "Reunião de equipe", time: "15:00", duration: "1h", type: "meeting", color: "bg-primary" },
    { id: "5", title: "Lembrete: Proposta", time: "17:00", duration: "5min", type: "reminder", color: "bg-destructive" },
  ],
  17: [
    { id: "6", title: "Apresentação", time: "11:00", duration: "2h", type: "meeting", contact: "Empresa XYZ", color: "bg-success" },
  ],
  20: [
    { id: "7", title: "Review semanal", time: "09:00", duration: "1h", type: "meeting", color: "bg-primary" },
  ],
};

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 16));
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [selectedDay, setSelectedDay] = useState<number | null>(16);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: { day: number; isCurrentMonth: boolean }[] = [];

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, isCurrentMonth: true });
    }

    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ day: i, isCurrentMonth: false });
    }

    return days;
  };

  const days = getDaysInMonth(currentDate);

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1));
      return newDate;
    });
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="w-3 h-3" />;
      case "meeting":
        return <Video className="w-3 h-3" />;
      case "task":
        return <Clock className="w-3 h-3" />;
      case "reminder":
        return <Clock className="w-3 h-3" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex gap-6">
      {/* Calendar */}
      <div className="flex-1 inboxia-card p-6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigateMonth("prev")}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="font-display text-xl font-bold">
              {months[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => navigateMonth("next")}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border overflow-hidden">
              {["day", "week", "month"].map((v) => (
                <Button
                  key={v}
                  variant={view === v ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setView(v as typeof view)}
                  className="rounded-none"
                >
                  {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
                </Button>
              ))}
            </div>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Evento
            </Button>
          </div>
        </div>

        {/* Week Days Header */}
        <div className="grid grid-cols-7 mb-2">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 flex-1 border-t border-l border-border">
          {days.map((day, index) => {
            const dayEvents = day.isCurrentMonth ? events[day.day] || [] : [];
            const isSelected = day.isCurrentMonth && day.day === selectedDay;
            const isToday = day.isCurrentMonth && day.day === 16;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.01 }}
                onClick={() => day.isCurrentMonth && setSelectedDay(day.day)}
                className={cn(
                  "min-h-24 p-2 border-r border-b border-border cursor-pointer transition-colors",
                  day.isCurrentMonth ? "bg-card hover:bg-muted/50" : "bg-muted/30",
                  isSelected && "bg-secondary/5 ring-2 ring-secondary ring-inset"
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-sm mb-1",
                    isToday && "bg-secondary text-secondary-foreground font-bold",
                    !isToday && day.isCurrentMonth && "text-foreground",
                    !day.isCurrentMonth && "text-muted-foreground"
                  )}
                >
                  {day.day}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded truncate text-white",
                        event.color
                      )}
                    >
                      {event.time} {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-muted-foreground px-1">
                      +{dayEvents.length - 2} mais
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Sidebar - Selected Day Events */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-80 inboxia-card p-6 flex flex-col"
      >
        <h3 className="font-display font-semibold text-lg mb-4">
          {selectedDay ? `${selectedDay} de ${months[currentDate.getMonth()]}` : "Selecione um dia"}
        </h3>

        {selectedDay && events[selectedDay] ? (
          <div className="space-y-3 flex-1 overflow-auto">
            {events[selectedDay].map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className={cn("p-1.5 rounded", event.color)}>
                    {getEventIcon(event.type)}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
                <h4 className="font-medium text-foreground mb-1">{event.title}</h4>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    {event.time} - {event.duration}
                  </p>
                  {event.contact && (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <User className="w-3 h-3" />
                      {event.contact}
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
            <p className="text-muted-foreground">Nenhum evento neste dia</p>
            <Button variant="link" className="mt-2">
              <Plus className="w-4 h-4 mr-2" />
              Criar evento
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
