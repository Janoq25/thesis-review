'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useI18n } from '@/lib/i18n/context';
import { KPICard } from '@/components/dashboard/KPICard';
import { RecentAdvancesCard } from '@/components/dashboard/RecentAdvancesCard';
import { ActivityFeedCard } from '@/components/dashboard/ActivityFeedCard';
import { StatusChartCard } from '@/components/dashboard/StatusChartCard';
import { LowComplianceAlert } from '@/components/dashboard/LowComplianceAlert';

export default function DashboardPage() {
  const { t } = useI18n();

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
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-medium text-gray-900 dark:text-gray-100">{t('dashboard.title')}</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.period')}</p>
        </div>
        <a
          href="/advances/upload"
          className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-[#185FA5] text-white text-xs sm:text-sm font-medium
                     hover:bg-[#0C447C] transition-colors flex items-center gap-1 sm:gap-1.5 flex-shrink-0"
        >
          <span className="text-sm sm:text-base leading-none">+</span>
          <span className="hidden sm:inline">{t('dashboard.newAdvance')}</span>
          <span className="sm:hidden">Nuevo</span>
        </a>
      </div>

      {(kpis?.lowComplianceCount ?? 0) > 0 && (
        <LowComplianceAlert count={kpis.lowComplianceCount} />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label={t('dashboard.pendingAdvances')}
          value={kpis?.pendingCount ?? 0}
          delta={{ value: 5, direction: 'up', label: t('dashboard.newToday') }}
          loading={isLoading}
        />
        <KPICard
          label={t('dashboard.reviewedMonth')}
          value={kpis?.byStatus?.APPROVED ?? 0}
          delta={{ value: 12, direction: 'up', label: t('dashboard.vsPrevious') }}
          loading={isLoading}
        />
        <KPICard
          label={t('dashboard.aiConcordance')}
          value={`${kpis?.aiConcordance ?? 0}%`}
          delta={{ label: t('dashboard.aiVsHuman'), direction: 'neutral' }}
          loading={isLoading}
        />
        <KPICard
          label={t('dashboard.avgScore')}
          value={kpis?.averageAIGrade ?? 0}
          delta={{ label: t('dashboard.gradeScale'), direction: 'neutral' }}
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentAdvancesCard advances={recentAdvances?.advances ?? []} />
        <ActivityFeedCard />
      </div>

      <StatusChartCard data={kpis?.byStatus} />
    </div>
  );
}
