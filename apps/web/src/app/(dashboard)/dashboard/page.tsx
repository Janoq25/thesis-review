'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { KPICard } from '@/components/dashboard/KPICard';
import { RecentAdvancesCard } from '@/components/dashboard/RecentAdvancesCard';
import { ActivityFeedCard } from '@/components/dashboard/ActivityFeedCard';
import { StatusChartCard } from '@/components/dashboard/StatusChartCard';
import { LowComplianceAlert } from '@/components/dashboard/LowComplianceAlert';

export const metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: () => apiClient.get('/stats/dashboard').then((r) => r.data),
    refetchInterval: 60_000,
  });

  const { data: recentAdvances } = useQuery({
    queryKey: ['recent-advances'],
    queryFn: () =>
      apiClient.get('/advances', { params: { pageSize: 8 } }).then((r) => r.data),
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Período 2025-II</p>
        </div>
        
          href="/advances/upload"
          className="h-9 px-4 rounded-lg bg-[#185FA5] text-white text-sm font-medium
                     hover:bg-[#0C447C] transition-colors flex items-center gap-1.5"
        >
          <span className="text-base leading-none">+</span>
          Nuevo avance
        </a>
      </div>

      {/* Alertas de bajo cumplimiento */}
      {(kpis?.lowComplianceCount ?? 0) > 0 && (
        <LowComplianceAlert count={kpis.lowComplianceCount} />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Avances pendientes"
          value={kpis?.pendingCount ?? 0}
          delta={{ value: 5, direction: 'up', label: 'nuevos hoy' }}
          loading={isLoading}
        />
        <KPICard
          label="Revisados (mes)"
          value={kpis?.byStatus?.APPROVED ?? 0}
          delta={{ value: 12, direction: 'up', label: 'vs. anterior' }}
          loading={isLoading}
        />
        <KPICard
          label="Concordancia IA"
          value={`${kpis?.aiConcordance ?? 0}%`}
          delta={{ label: 'IA vs. humano', direction: 'neutral' }}
          loading={isLoading}
        />
        <KPICard
          label="Nota promedio IA"
          value={kpis?.averageAIGrade ?? 0}
          delta={{ label: 'escala 0–20', direction: 'neutral' }}
          loading={isLoading}
        />
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentAdvancesCard advances={recentAdvances?.advances ?? []} />
        <ActivityFeedCard />
      </div>

      {/* Gráfico distribución */}
      <StatusChartCard data={kpis?.byStatus} />
    </div>
  );
}
