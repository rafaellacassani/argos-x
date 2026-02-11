import { useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ScheduleMessagePopoverProps {
  // Channel routing
  channelType: "whatsapp" | "meta_facebook" | "meta_instagram";
  // WhatsApp
  instanceName?: string;
  remoteJid?: string;
  phoneNumber?: string;
  // Meta
  metaPageId?: string;
  senderId?: string;
  // Display
  contactName: string;
}

const scheduleSchema = z.object({
  message: z.string().trim().min(1, "Mensagem obrigatória").max(4000, "Máximo 4000 caracteres"),
  date: z.date({ required_error: "Selecione uma data" }),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
});

export function ScheduleMessagePopover({
  channelType,
  instanceName,
  remoteJid,
  phoneNumber,
  metaPageId,
  senderId,
  contactName,
}: ScheduleMessagePopoverProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("09:00");
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const handleSchedule = async () => {
    // Validate
    const parsed = scheduleSchema.safeParse({ message, date, time });
    if (!parsed.success) {
      toast({
        title: "Dados inválidos",
        description: parsed.error.errors[0]?.message || "Verifique os campos",
        variant: "destructive",
      });
      return;
    }

    // Build scheduled_at datetime
    const [hours, minutes] = time.split(":").map(Number);
    const scheduledAt = new Date(date!);
    scheduledAt.setHours(hours, minutes, 0, 0);

    if (scheduledAt <= new Date()) {
      toast({
        title: "Data inválida",
        description: "O agendamento deve ser no futuro.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("scheduled_messages" as any).insert({
        message: message.trim(),
        scheduled_at: scheduledAt.toISOString(),
        channel_type: channelType,
        instance_name: instanceName || null,
        remote_jid: remoteJid || null,
        phone_number: phoneNumber || null,
        meta_page_id: metaPageId || null,
        sender_id: senderId || null,
        contact_name: contactName,
        status: "pending",
      } as any);

      if (error) throw error;

      toast({
        title: "✅ Mensagem agendada!",
        description: `Será enviada em ${format(scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      });

      // Reset
      setMessage("");
      setDate(undefined);
      setTime("09:00");
      setOpen(false);
    } catch (err: any) {
      console.error("[ScheduleMessage] Error:", err);
      toast({
        title: "Erro ao agendar",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-secondary/50 text-secondary hover:bg-secondary/10 hover:text-secondary"
        >
          <CalendarClock className="w-4 h-4" />
          <span className="hidden sm:inline">Agendar</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end" sideOffset={8}>
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm mb-1">Agendar mensagem</h4>
            <p className="text-xs text-muted-foreground">
              Para {contactName}
            </p>
          </div>

          {/* Message */}
          <Textarea
            placeholder="Escreva a mensagem..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[80px] text-sm resize-none"
            maxLength={4000}
          />

          {/* Date picker */}
          <div className="relative">
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal text-sm h-9",
                !date && "text-muted-foreground"
              )}
              onClick={() => setShowCalendar(!showCalendar)}
            >
              <CalendarClock className="mr-2 h-4 w-4" />
              {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
            </Button>
            {showCalendar && (
              <div className="absolute z-50 mt-1 bg-popover border rounded-md shadow-md">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    setShowCalendar(false);
                  }}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  className="p-3 pointer-events-auto"
                />
              </div>
            )}
          </div>

          {/* Time */}
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-9 text-sm"
          />

          {/* Submit */}
          <Button
            className="w-full"
            onClick={handleSchedule}
            disabled={saving || !message.trim() || !date}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <CalendarClock className="w-4 h-4 mr-2" />
            )}
            Agendar envio
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
