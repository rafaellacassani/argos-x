import { useState } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Users,
  Clock,
  AlertCircle,
  Calendar,
  Loader2,
  UserPlus,
  DollarSign,
  Trophy,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";

const MEDAL = ["🥇", "🥈", "🥉"];

export default function Dashboard() {
  const [period, setPeriod] = useState("7d");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { isAdminOrManager, userProfileId } = useUserRole();
  const { user } = useAuth();

  const {
    loading,
    stats,
    messageChartData,
    leadSourceData,
    recentLeads,
    teamRanking,
    members,
    profiles,
  } = useDashboardData(period, isAdminOrManager ? selectedUserId : userProfileId);

  // Build user options for the filter (admin/manager only)
  const userOptions = isAdminOrManager
    ? members
        .map((m) => {
          const p = profiles.find((pr) => pr.user_id === m.user_id);
          return p ? { id: p.id, name: p.full_name } : null;
        })
        .filter(Boolean) as { id: string; name: string }[]
    : [];

  const showRanking = isAdminOrManager && !selectedUserId && teamRanking.length >= 2;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Visão geral do seu CRM</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-44">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
            </SelectContent>
          </Select>
          {isAdminOrManager && userOptions.length > 0 && (
            <Select
              value={selectedUserId || "all"}
              onValueChange={(v) => setSelectedUserId(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-48">
                <Users className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda a equipe</SelectItem>
                {userOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Mensagens Recebidas"
          value={stats.totalMessages.toString()}
          icon={<MessageCircle className="w-6 h-6" />}
          change={{ value: stats.messagesChange, type: stats.messagesChange >= 0 ? "increase" : "decrease" }}
          delay={0}
        />
        <StatCard
          title="Conversas Ativas"
          value={stats.activeConversations.toString()}
          icon={<Users className="w-6 h-6" />}
          change={{ value: stats.conversationsChange, type: stats.conversationsChange >= 0 ? "increase" : "decrease" }}
          delay={0.05}
        />
        <StatCard
          title="Chats sem Resposta"
          value={stats.unansweredChats.toString()}
          icon={<AlertCircle className="w-6 h-6" />}
          change={{ value: stats.unansweredChange, type: stats.unansweredChange <= 0 ? "decrease" : "increase" }}
          delay={0.1}
          className={stats.unansweredChats > 5 ? "ring-2 ring-destructive/30" : ""}
        />
        <StatCard
          title="Tempo Médio Resposta"
          value={stats.avgResponseTime}
          icon={<Clock className="w-6 h-6" />}
          delay={0.15}
        />
        <StatCard
          title="Leads no Período"
          value={stats.leadsInPeriod.toString()}
          icon={<UserPlus className="w-6 h-6" />}
          change={{ value: stats.leadsChange, type: stats.leadsChange >= 0 ? "increase" : "decrease" }}
          delay={0.2}
        />
        <StatCard
          title="Valor em Pipeline"
          value={`R$ ${stats.pipelineValue.toLocaleString("pt-BR")}`}
          icon={<DollarSign className="w-6 h-6" />}
          delay={0.25}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Activity Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="inboxia-card p-6 lg:col-span-3"
        >
          <h3 className="font-display font-semibold text-lg mb-4">Atividade</h3>
          {messageChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={messageChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="recebidas"
                  stroke="hsl(var(--secondary))"
                  strokeWidth={2}
                  dot={false}
                  name="Mensagens recebidas"
                />
                <Line
                  type="monotone"
                  dataKey="leads"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  name="Leads criados"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground">
              Nenhuma atividade no período
            </div>
          )}
        </motion.div>

        {/* Lead Sources */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="inboxia-card p-6 lg:col-span-2"
        >
          <h3 className="font-display font-semibold text-lg mb-4">Fontes de Leads</h3>
          {leadSourceData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={leadSourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="count"
                  >
                    {leadSourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-1 gap-2 mt-4">
                {leadSourceData.map((source) => (
                  <div key={source.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: source.color }} />
                    <span className="text-xs text-muted-foreground">{source.name}</span>
                    <span className="text-xs font-medium ml-auto">{source.count} ({source.value}%)</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground">
              Nenhum lead no período
            </div>
          )}
        </motion.div>
      </div>

      {/* Ranking + Recent Leads */}
      <div className={`grid grid-cols-1 ${showRanking ? "lg:grid-cols-5" : ""} gap-6`}>
        {/* Team Ranking */}
        {showRanking && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="inboxia-card p-6 lg:col-span-3"
          >
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-warning" />
              <h3 className="font-display font-semibold text-lg">Ranking da Equipe</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium w-10">#</th>
                    <th className="text-left py-2 px-2 text-muted-foreground font-medium">Vendedor</th>
                    <th className="text-center py-2 px-2 text-muted-foreground font-medium">Leads Ativos</th>
                    <th className="text-center py-2 px-2 text-muted-foreground font-medium">Vendas</th>
                    <th className="text-center py-2 px-2 text-muted-foreground font-medium">Tempo Resp.</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRanking.map((member, index) => {
                    const isMe = member.profileId === userProfileId;
                    return (
                      <tr
                        key={member.profileId}
                        className={`border-b border-border/50 last:border-0 transition-colors ${
                          isMe ? "bg-primary/5" : "hover:bg-muted/30"
                        }`}
                      >
                        <td className="py-3 px-2 font-semibold">
                          {index < 3 ? MEDAL[index] : index + 1}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0">
                              {member.initials}
                            </div>
                            <span className={`font-medium truncate ${isMe ? "text-primary" : "text-foreground"}`}>
                              {member.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center font-semibold">{member.activeLeads}</td>
                        <td className="py-3 px-2 text-center font-semibold">{member.salesCount}</td>
                        <td className="py-3 px-2 text-center text-muted-foreground">{member.avgResponseTime}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Recent Leads */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className={`inboxia-card p-6 ${showRanking ? "lg:col-span-2" : ""}`}
        >
          <h3 className="font-display font-semibold text-lg mb-4">Leads Recentes</h3>
          {recentLeads.length > 0 ? (
            <div className="space-y-3">
              {recentLeads.map((lead, index) => (
                <div key={index} className="flex items-center gap-3 py-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold text-xs shrink-0">
                    {lead.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{lead.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 border-none font-medium"
                        style={{ backgroundColor: `${lead.sourceColor}15`, color: lead.sourceColor }}
                      >
                        {lead.source}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{lead.stage}</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{lead.time}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Nenhum lead recente
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
