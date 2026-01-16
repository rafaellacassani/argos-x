import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Target,
  Clock,
  Calendar,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";

const funnelData = [
  { name: "Leads de Entrada", value: 1250, fill: "hsl(207 98% 39%)" },
  { name: "Em Contato", value: 890, fill: "hsl(207 98% 45%)" },
  { name: "Qualificados", value: 456, fill: "hsl(207 98% 50%)" },
  { name: "Proposta Enviada", value: 234, fill: "hsl(207 98% 55%)" },
  { name: "Fechados", value: 89, fill: "hsl(142 76% 36%)" },
];

const monthlyData = [
  { month: "Jul", leads: 320, fechados: 28, receita: 45000 },
  { month: "Ago", leads: 450, fechados: 42, receita: 67000 },
  { month: "Set", leads: 380, fechados: 35, receita: 52000 },
  { month: "Out", leads: 520, fechados: 56, receita: 89000 },
  { month: "Nov", leads: 680, fechados: 72, receita: 112000 },
  { month: "Dez", leads: 590, fechados: 65, receita: 98000 },
  { month: "Jan", leads: 720, fechados: 89, receita: 145000 },
];

const conversionBySource = [
  { source: "WhatsApp", taxa: 12.5 },
  { source: "Site", taxa: 8.2 },
  { source: "Instagram", taxa: 6.8 },
  { source: "Indicação", taxa: 18.4 },
  { source: "Facebook", taxa: 5.1 },
];

const teamPerformance = [
  { name: "Carlos", leads: 156, fechados: 23, receita: 89000 },
  { name: "Ana", leads: 142, fechados: 19, receita: 72000 },
  { name: "João", leads: 128, fechados: 21, receita: 81000 },
  { name: "Maria", leads: 98, fechados: 12, receita: 45000 },
];

export default function Statistics() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Estatísticas</h1>
          <p className="text-muted-foreground">Análises detalhadas do seu funil de vendas</p>
        </div>
        <div className="flex items-center gap-3">
          <Select defaultValue="30d">
            <SelectTrigger className="w-40">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="year">Este ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Total de Leads", value: "1.250", icon: Users, change: { value: 15.2, type: "increase" as const } },
          { title: "Taxa de Conversão", value: "7.12%", icon: Target, change: { value: 2.1, type: "increase" as const } },
          { title: "Receita Total", value: "R$ 287.000", icon: DollarSign, change: { value: 23.5, type: "increase" as const } },
          { title: "Tempo Médio de Fechamento", value: "12 dias", icon: Clock, change: { value: 8, type: "decrease" as const } },
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="inboxia-card p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-secondary" />
              </div>
              <div className="flex items-center gap-1">
                {stat.change.type === "increase" ? (
                  <TrendingUp className="w-4 h-4 text-success" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-success" />
                )}
                <span className="text-xs font-medium text-success">
                  {stat.change.value}%
                </span>
              </div>
            </div>
            <p className="text-2xl font-display font-bold">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.title}</p>
          </motion.div>
        ))}
      </div>

      {/* Funnel Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="inboxia-card p-6"
      >
        <h3 className="font-display font-semibold text-lg mb-6">Funil de Vendas</h3>
        <div className="grid grid-cols-5 gap-4">
          {funnelData.map((stage, index) => {
            const prevValue = index > 0 ? funnelData[index - 1].value : stage.value;
            const conversionRate = index > 0 ? ((stage.value / prevValue) * 100).toFixed(1) : "100";
            const width = (stage.value / funnelData[0].value) * 100;

            return (
              <div key={stage.name} className="text-center">
                <div
                  className="h-32 rounded-lg flex items-center justify-center mx-auto mb-3 transition-all hover:scale-105"
                  style={{
                    width: `${Math.max(width, 30)}%`,
                    background: stage.fill,
                  }}
                >
                  <span className="text-white font-bold text-lg">{stage.value}</span>
                </div>
                <p className="text-sm font-medium">{stage.name}</p>
                {index > 0 && (
                  <p className="text-xs text-muted-foreground">{conversionRate}% conversão</p>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="inboxia-card p-6"
        >
          <h3 className="font-display font-semibold text-lg mb-4">Evolução Mensal</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Area
                type="monotone"
                dataKey="leads"
                stroke="hsl(var(--secondary))"
                fill="hsl(var(--secondary) / 0.2)"
                strokeWidth={2}
                name="Leads"
              />
              <Area
                type="monotone"
                dataKey="fechados"
                stroke="hsl(var(--success))"
                fill="hsl(var(--success) / 0.2)"
                strokeWidth={2}
                name="Fechados"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Conversion by Source */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="inboxia-card p-6"
        >
          <h3 className="font-display font-semibold text-lg mb-4">Taxa de Conversão por Fonte</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={conversionBySource} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} unit="%" />
              <YAxis dataKey="source" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value) => [`${value}%`, "Taxa"]}
              />
              <Bar dataKey="taxa" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Team Performance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="inboxia-card p-6"
      >
        <h3 className="font-display font-semibold text-lg mb-4">Performance do Time</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Vendedor</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Leads</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Fechados</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Conversão</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Receita</th>
                <th className="py-3 px-4 text-sm font-medium text-muted-foreground">Progresso</th>
              </tr>
            </thead>
            <tbody>
              {teamPerformance.map((member, index) => {
                const conversion = ((member.fechados / member.leads) * 100).toFixed(1);
                return (
                  <tr key={member.name} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-semibold">
                          {member.name[0]}
                        </div>
                        <span className="font-medium">{member.name}</span>
                      </div>
                    </td>
                    <td className="text-right py-4 px-4">{member.leads}</td>
                    <td className="text-right py-4 px-4 text-success font-medium">{member.fechados}</td>
                    <td className="text-right py-4 px-4">{conversion}%</td>
                    <td className="text-right py-4 px-4 font-medium">
                      R$ {member.receita.toLocaleString("pt-BR")}
                    </td>
                    <td className="py-4 px-4 w-40">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(member.receita / 100000) * 100}%` }}
                          transition={{ duration: 1, delay: 0.8 + index * 0.1 }}
                          className="h-full bg-secondary rounded-full"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
