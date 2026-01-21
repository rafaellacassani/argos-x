import { TrendingUp, Users, DollarSign, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { FunnelStage, Lead } from '@/hooks/useLeads';

interface LeadStatsProps {
  stages: FunnelStage[];
  leads: Lead[];
}

export function LeadStats({ stages, leads }: LeadStatsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const totalLeads = leads.length;
  const totalValue = leads.reduce((sum, l) => sum + (l.value || 0), 0);
  const wonLeads = leads.filter(l => 
    stages.find(s => s.id === l.stage_id)?.is_win_stage
  ).length;
  const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

  const stats = [
    {
      label: 'Total de Leads',
      value: totalLeads.toString(),
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      label: 'Valor Total',
      value: formatCurrency(totalValue),
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    },
    {
      label: 'Vendas Fechadas',
      value: wonLeads.toString(),
      icon: Target,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      label: 'Taxa de Conversão',
      value: `${conversionRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold">{stat.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
