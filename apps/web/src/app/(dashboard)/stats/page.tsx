'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { KPICard } from '@/components/dashboard/KPICard';
import { MonthlyTrendChart } from '@/components/stats/MonthlyTrendChart';
import { GradeDistributionChart } from '@/components/stats/GradeDistributionChart';
import { AdvisorWorkloadTable } from '@/components/stats/AdvisorWorkloadTable';
import { Download } from 'lucide-react';

export default function StatsPage() {
  const { data: kpis } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: () => apiClient.get('/stats/dashboard').then((r) => r.data),
  });

  const { data: monthlyTrend } = useQuery({
    queryKey: ['monthly-trend'],
    queryFn: () => apiClient.get('/stats/monthly-trend').then((r) => r.data),
  });

  const { data: gradeDistribution } = useQuery({
    queryKey: ['grade-distribution'],
    queryFn: () => apiClient.get('/stats/grade-distribution').then((r) => r.data),
  });

  const { data: advisorWorkload } = useQuery({
    queryKey: ['advisor-workload'],
    queryFn: () => apiClient.get('/stats/advisor-workload').then((r) => r.data),
  });

  const handleExportCsv = async () => {
    const { data } = await apiClient.get('/reports/stats/csv', {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'estadisticas.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium text-gray-900">Estadísticas del programa</h1>
        <div className="flex gap-2">
          <button
            onClick={handleExportCsv}
            className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-600
                       hover:bg-gray-50 flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          
            href="/reports/program/batch"
            className="h-9 px-4 rounded-lg bg-[#185FA5] text-white text-sm font-medium
                       hover:bg-[#0C447C] flex items-center gap-1.5"
          >
            Generar reporte PDF
          </a>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Tasa de aprobación"
          value={`${Math.round(((kpis?.byStatus?.APPROVED ?? 0) / (kpis?.totalAdvances ?? 1)) * 100)}%`}
          delta={{ direction: 'up', value: 4, label: 'vs. semestre anterior' }} />
        <KPICard label="Concordancia IA-Humano"
          value={`${kpis?.aiConcordance ?? 0}%`}
          delta={{ direction: 'neutral', label: 'alta confiabilidad' }} />
        <KPICard label="T. revisión promedio"
          value="1.8d"
          delta={{ direction: 'up', label: '↓ 0.4d vs. anterior' }} />
        <KPICard label="Avances < 65% IA"
          value={kpis?.lowComplianceCount ?? 0}
          delta={{ direction: 'down', label: 'requieren atención' }} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyTrendChart data={monthlyTrend ?? []} />
        <GradeDistributionChart data={gradeDistribution ?? []} />
      </div>

      {/* Tabla asesores */}
      <AdvisorWorkloadTable data={advisorWorkload ?? []} />
    </div>
  );
}
