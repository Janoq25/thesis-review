'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface PlagiarismPanelProps {
  advanceId: string;
}

const SEVERITY_CONFIG = {
  critical: { label: 'Crítico', className: 'bg-red-50 text-red-800 border-red-200' },
  warning: { label: 'Advertencia', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  info: { label: 'Info', className: 'bg-blue-50 text-blue-800 border-blue-200' },
};

export function PlagiarismPanel({ advanceId }: PlagiarismPanelProps) {
  const { data: report, refetch, isLoading } = useQuery({
    queryKey: ['plagiarism-report', advanceId],
    queryFn: () =>
      apiClient.get(`/plagiarism/report/${advanceId}`).then((r) => r.data),
    refetchInterval: ({ state }) => (state.data?.status === 'processing' ? 3000 : false),
  });

  const analyzeMutation = useMutation({
    mutationFn: (method: 'embeddings' | 'copyleaks') =>
      apiClient.post(`/plagiarism/analyze/${advanceId}`, { method }),
    onSuccess: (_, method) => {
      toast.success(`Análisis de plagio iniciado (${method})`);
      setTimeout(() => refetch(), 2000);
    },
  });

  if (!report && !isLoading) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-gray-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700 mb-1">Sin análisis de plagio</p>
        <p className="text-xs text-gray-500 mb-4">
          Analice el documento para detectar similitudes con otros avances del programa.
        </p>
        <div className="flex gap-2 justify-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => analyzeMutation.mutate('embeddings')}
            disabled={analyzeMutation.isPending}
          >
            Análisis por embeddings
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => analyzeMutation.mutate('copyleaks')}
            disabled={analyzeMutation.isPending}
          >
            Copyleaks API
          </Button>
        </div>
      </div>
    );
  }

  if (report?.status === 'processing') {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 flex items-center gap-3">
        <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
        <p className="text-sm text-blue-800">Analizando similitudes con otros documentos…</p>
      </div>
    );
  }

  const alerts = report?.alerts ?? [];
  const criticalAlerts = alerts.filter((a: any) => a.severity === 'critical');
  const score = report?.overallScore ?? 0;

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div
        className={`rounded-xl border p-4 flex items-center justify-between ${
          score >= 85
            ? 'border-red-200 bg-red-50'
            : score >= 70
            ? 'border-amber-200 bg-amber-50'
            : 'border-green-200 bg-green-50'
        }`}
      >
        <div>
          <p className="text-sm font-medium text-gray-900">
            Similitud máxima detectada:{' '}
            <span
              className={`font-semibold ${
                score >= 85 ? 'text-red-700' : score >= 70 ? 'text-amber-700' : 'text-green-700'
              }`}
            >
              {score.toFixed(1)}%
            </span>
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            {alerts.length} coincidencias · {criticalAlerts.length} críticas
          </p>
        </div>
        {score < 70 && (
          <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
        )}
        {score >= 85 && (
          <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
        )}
      </div>

      {/* Lista de alertas */}
      <div className="space-y-3">
        {alerts.map((alert: any) => (
          <div
            key={alert.id}
            className="rounded-lg border border-gray-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="text-xs font-medium text-gray-900">
                  Sección: {alert.sectionName}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Coincide con:{' '}
                  <span className="font-medium text-gray-700">
                    {alert.targetAdvance?.student?.name ?? 'Documento externo'} —{' '}
                    {alert.targetAdvance?.title ?? ''}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    alert.similarity >= 0.85
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {(alert.similarity * 100).toFixed(0)}%
                </span>
                <Badge
                  variant="outline"
                  className={SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG]?.className}
                >
                  {SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG]?.label}
                </Badge>
              </div>
            </div>

            {alert.sourceSnippet && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Fragmento fuente</p>
                  <div className="bg-gray-50 rounded p-2 text-[11px] text-gray-600 leading-relaxed line-clamp-3">
                    {alert.sourceSnippet}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Fragmento coincidente</p>
                  <div className="bg-amber-50 rounded p-2 text-[11px] text-gray-600 leading-relaxed line-clamp-3">
                    {alert.targetSnippet}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
