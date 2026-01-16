import { useState } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Users,
  Clock,
  AlertCircle,
  TrendingUp,
  Phone,
  Mail,
  Globe,
  Filter,
  Calendar,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
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
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const messageData = [
  { name: "Seg", recebidas: 45, enviadas: 32 },
  { name: "Ter", recebidas: 52, enviadas: 41 },
  { name: "Qua", recebidas: 78, enviadas: 65 },
  { name: "Qui", recebidas: 63, enviadas: 52 },
  { name: "Sex", recebidas: 89, enviadas: 71 },
  { name: "Sáb", recebidas: 34, enviadas: 28 },
  { name: "Dom", recebidas: 21, enviadas: 15 },
];

const leadSourceData = [
  { name: "WhatsApp", value: 45, color: "#25D366" },
  { name: "Site", value: 25, color: "#0171C3" },
  { name: "Instagram", value: 15, color: "#E4405F" },
  { name: "Indicação", value: 10, color: "#060369" },
  { name: "Outros", value: 5, color: "#94A3B8" },
];

const recentLeads = [
  { name: "João Silva", source: "WhatsApp", status: "Novo", time: "2 min" },
  { name: "Maria Santos", source: "Site", status: "Qualificado", time: "15 min" },
  { name: "Pedro Costa", source: "Instagram", status: "Em negociação", time: "1h" },
  { name: "Ana Oliveira", source: "WhatsApp", status: "Novo", time: "2h" },
  { name: "Carlos Lima", source: "Indicação", status: "Fechado", time: "3h" },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "Novo":
      return "bg-secondary/10 text-secondary";
    case "Qualificado":
      return "bg-warning/10 text-warning";
    case "Em negociação":
      return "bg-primary/10 text-primary";
    case "Fechado":
      return "bg-success/10 text-success";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export default function Dashboard() {
  const [period, setPeriod] = useState("7d");

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do seu CRM</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Mensagens Recebidas"
          value="382"
          icon={<MessageCircle className="w-6 h-6" />}
          change={{ value: 12.5, type: "increase" }}
          delay={0}
        />
        <StatCard
          title="Conversas Ativas"
          value="47"
          icon={<Users className="w-6 h-6" />}
          change={{ value: 8.2, type: "increase" }}
          delay={0.1}
        />
        <StatCard
          title="Chats sem Resposta"
          value="5"
          icon={<AlertCircle className="w-6 h-6" />}
          change={{ value: 23, type: "decrease" }}
          delay={0.2}
        />
        <StatCard
          title="Tempo Médio Resposta"
          value="3.2min"
          icon={<Clock className="w-6 h-6" />}
          change={{ value: 15, type: "decrease" }}
          delay={0.3}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="inboxia-card p-6 lg:col-span-2"
        >
          <h3 className="font-display font-semibold text-lg mb-4">Mensagens</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={messageData}>
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
                dot={{ fill: "hsl(var(--secondary))", strokeWidth: 0 }}
                name="Recebidas"
              />
              <Line
                type="monotone"
                dataKey="enviadas"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 0 }}
                name="Enviadas"
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Lead Sources */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="inboxia-card p-6"
        >
          <h3 className="font-display font-semibold text-lg mb-4">Fontes de Leads</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={leadSourceData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {leadSourceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {leadSourceData.map((source) => (
              <div key={source.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: source.color }}
                />
                <span className="text-xs text-muted-foreground">{source.name}</span>
                <span className="text-xs font-medium ml-auto">{source.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent Leads & Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="inboxia-card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-lg">Leads Recentes</h3>
            <Button variant="ghost" size="sm">
              Ver todos
            </Button>
          </div>
          <div className="space-y-3">
            {recentLeads.map((lead, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold text-sm">
                  {lead.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">{lead.source}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(lead.status)}`}>
                  {lead.status}
                </span>
                <span className="text-xs text-muted-foreground">{lead.time}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Performance Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.7 }}
          className="inboxia-card p-6"
        >
          <h3 className="font-display font-semibold text-lg mb-4">Performance do Time</h3>
          <div className="space-y-4">
            {[
              { name: "Taxa de Resposta", value: 94, color: "bg-success" },
              { name: "Leads Qualificados", value: 67, color: "bg-secondary" },
              { name: "Taxa de Conversão", value: 23, color: "bg-primary" },
              { name: "Satisfação do Cliente", value: 89, color: "bg-warning" },
            ].map((metric) => (
              <div key={metric.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{metric.name}</span>
                  <span className="text-sm font-semibold">{metric.value}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.value}%` }}
                    transition={{ duration: 1, delay: 0.8 }}
                    className={`h-full ${metric.color} rounded-full`}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
