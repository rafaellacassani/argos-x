import { motion } from "framer-motion";
import { Mail, MessageCircle, TrendingUp, Send, AlertTriangle, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCadenceStats, CadenceDayStat } from "@/hooks/useCadenceStats";
import { Skeleton } from "@/components/ui/skeleton";

function ChannelBadge({ channel, sent, failed }: { channel: "whatsapp" | "email"; sent: number; failed: number }) {
  const isWa = channel === "whatsapp";
  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1.5 text-xs font-medium ${isWa ? "text-emerald-400" : "text-blue-400"}`}>
        {isWa ? <MessageCircle className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
        <span>{sent}</span>
      </div>
      {failed > 0 && (
        <span className="text-[10px] text-destructive font-medium">({failed} falha{failed > 1 ? "s" : ""})</span>
      )}
    </div>
  );
}

function DayRow({ stat }: { stat: CadenceDayStat }) {
  const totalSent = stat.whatsapp.sent + stat.email.sent;
  const totalFailed = stat.whatsapp.failed + stat.email.failed;

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 min-w-[100px]">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono">
          {stat.label}
        </Badge>
      </div>
      <div className="flex items-center gap-4">
        <ChannelBadge channel="whatsapp" sent={stat.whatsapp.sent} failed={stat.whatsapp.failed} />
        <ChannelBadge channel="email" sent={stat.email.sent} failed={stat.email.failed} />
        <div className="text-xs text-muted-foreground min-w-[50px] text-right">
          {totalSent + totalFailed} total
        </div>
      </div>
    </div>
  );
}

export function CadenceStatsCard() {
  const { data, isLoading } = useCadenceStats();

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="inboxia-card p-6"
      >
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </motion.div>
    );
  }

  if (!data || (data.totalSent === 0 && data.totalFailed === 0)) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className="inboxia-card p-6"
    >
      <div className="flex items-center gap-2 mb-5">
        <Send className="w-5 h-5 text-primary" />
        <h3 className="font-display font-semibold text-lg">Cadência de Reativação</h3>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-emerald-400 mb-1">
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs font-medium">WhatsApp</span>
          </div>
          <p className="text-xl font-bold text-foreground">{data.whatsappSent}</p>
          {data.whatsappFailed > 0 && (
            <p className="text-[10px] text-destructive mt-0.5 flex items-center justify-center gap-0.5">
              <AlertTriangle className="w-3 h-3" /> {data.whatsappFailed} falha{data.whatsappFailed > 1 ? "s" : ""}
            </p>
          )}
        </div>

        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-blue-400 mb-1">
            <Mail className="w-4 h-4" />
            <span className="text-xs font-medium">E-mail</span>
          </div>
          <p className="text-xl font-bold text-foreground">{data.emailSent}</p>
          {data.emailFailed > 0 && (
            <p className="text-[10px] text-destructive mt-0.5 flex items-center justify-center gap-0.5">
              <AlertTriangle className="w-3 h-3" /> {data.emailFailed} falha{data.emailFailed > 1 ? "s" : ""}
            </p>
          )}
        </div>

        <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-primary mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">Conversões</span>
          </div>
          <p className="text-xl font-bold text-foreground">
            {data.convertedWorkspaces}/{data.totalTargeted}
          </p>
        </div>

        <div className="rounded-lg bg-warning/10 border border-warning/20 p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-warning mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">Taxa Conv.</span>
          </div>
          <p className="text-xl font-bold text-foreground">{data.conversionRate}%</p>
        </div>
      </div>

      {/* Per-Day Breakdown */}
      <h4 className="text-sm font-medium text-muted-foreground mb-2">Detalhamento por dia</h4>
      <div className="divide-y divide-border/30">
        {data.byDay.map((stat) => (
          <DayRow key={stat.day} stat={stat} />
        ))}
      </div>
    </motion.div>
  );
}
