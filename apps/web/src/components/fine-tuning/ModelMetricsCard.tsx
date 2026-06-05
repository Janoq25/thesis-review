'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Metric {
  label: string;
  value: string | number;
  trend: 'up' | 'down' | 'neutral';
  description: string;
}

export function ModelMetricsCard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['ft-stats'],
    queryFn: () => apiClient.get('/fine-tuning/stats').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    );
  }

  const totalPairs = stats?.totalPairs ?? 0;
  const accepted = stats?.byOutcome?.find((o: any) => o.outcomeType === 'ACCEPTED')?._count?._all ?? 0;
  const discarded = stats?.byOutcome?.find((o: any) => o.outcomeType === 'DISCARDED')?._count?._all ?? 0;
  const acceptanceRate = totalPairs > 0 ? Math.round((accepted / totalPairs) * 100) : 0;

  const metrics: Metric[] = [
    {
      label: 'Tasa de aceptación',
      value: `${acceptanceRate}%`,
      trend: acceptanceRate >= 70 ? 'up' : acceptanceRate >= 50 ? 'neutral' : 'down',
      description: 'Hallazgos IA aceptados por asesores',
    },
    {
      label: 'Descartados',
      value: discarded,
      trend: discarded === 0 ? 'up' : 'down',
      description: 'Hallazgos IA considerados incorrectos',
    },
    {
      label: 'Total pares',
      value: totalPairs,
      trend: 'neutral',
      description: 'Datos disponibles para entrenamiento',
    },
  ];

  const TrendIcon = { up: TrendingUp, down: TrendingDown, neutral: Minus };
  const trendColor = { up: 'text-green-600', down: 'text-red-500', neutral: 'text-gray-400' };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-medium text-gray-900 mb-4">Métricas del modelo</h3>
      <div className="space-y-4">
        {metrics.map((m) => {
          const Icon = TrendIcon[m.trend];
          return (
            <div key={m.label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{m.value}</p>
                <p className="text-xs text-gray-500">{m.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{m.description}</p>
              </div>
              <Icon className={`w-4 h-4 ${trendColor[m.trend]}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
