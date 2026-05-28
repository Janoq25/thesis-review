'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
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
    mutationFn: (method: 'copyleaks') =>
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
          Analice el documento con la API de Copyleaks para detectar similitudes y escritura por IA.
        </p>
        <div className="flex justify-center">
          <Button
            size="sm"
            onClick={() => analyzeMutation.mutate('copyleaks')}
            disabled={analyzeMutation.isPending}
          >
            Analizar con Copyleaks
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
  const score = report?.overallSimilarity ?? 0;
  const isCopyleaks = report?.method === 'copyleaks';
  const aiScore = report?.aiScore ?? 0;

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className={isCopyleaks ? "grid grid-cols-2 gap-3" : "w-full"}>
        {/* Tarjeta de Plagio */}
        <div
          className={`rounded-xl border p-4 flex flex-col justify-between ${
            score >= 15
              ? 'border-red-200 bg-red-50 dark:bg-red-950/20'
              : score >= 10
              ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20'
              : 'border-green-200 bg-green-50 dark:bg-green-950/20'
          }`}
        >
          <div>
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Similitud / Plagio</p>
            <p className={`text-2xl font-bold mt-1 ${
              score >= 15 ? 'text-red-700 dark:text-red-400' : score >= 10 ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'
            }`}>
              {score.toFixed(1)}%
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {alerts.length} coincidencias detectadas
          </p>
        </div>

        {/* Tarjeta de Escritura por IA */}
        {isCopyleaks && (
          <div
            className={`rounded-xl border p-4 flex flex-col justify-between ${
              aiScore >= 50
                ? 'border-red-200 bg-red-50 dark:bg-red-950/20'
                : aiScore >= 20
                ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20'
                : 'border-green-200 bg-green-50 dark:bg-green-950/20'
            }`}
          >
            <div>
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Escritura por IA</p>
              <p className={`text-2xl font-bold mt-1 ${
                aiScore >= 50 ? 'text-red-700 dark:text-red-400' : aiScore >= 20 ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'
              }`}>
                {aiScore.toFixed(1)}%
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {aiScore >= 50 ? 'Sospecha crítica' : aiScore >= 20 ? 'Sospecha moderada' : 'Texto original humano'}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center text-xs text-gray-400 px-1">
        <span>Método: {report?.method === 'copyleaks' ? 'Copyleaks API' : 'Embeddings Locales (Legacy)'}</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px] text-gray-500 hover:text-gray-900"
          onClick={() => analyzeMutation.mutate('copyleaks')}
          disabled={analyzeMutation.isPending}
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${analyzeMutation.isPending ? 'animate-spin' : ''}`} />
          Volver a analizar
        </Button>
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
                  {alert.sectionName ? `Sección: ${alert.sectionName}` : 'Reporte de Similitud'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Coincide con:{' '}
                  <span className="font-medium text-gray-700 max-w-[250px] truncate block md:inline-block">
                    {alert.targetAdvance?.student?.name ?? (alert.sourceUrl || 'Fuente externa')}
                    {alert.targetAdvance?.title ? ` — ${alert.targetAdvance.title}` : ''}
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
