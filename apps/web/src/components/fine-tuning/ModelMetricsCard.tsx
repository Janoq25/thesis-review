'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

interface ModelMetrics {
  concordanceRate: number;
  totalPairs: number;
  lastTrainedAt?: string;
  meanAbsoluteError?: number;
  accuracy?: number;
}

export function ModelMetricsCard() {
  const { data, isLoading } = useQuery<ModelMetrics>({
    queryKey: ['model-metrics'],
    queryFn: () => apiClient.get('/fine-tuning/metrics').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    );
  }

  const concordance = data?.concordanceRate ?? 0;
  const accuracy = data?.accuracy ?? 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
      <div>
        <p className="text-sm font-medium text-gray-900">Métricas del modelo</p>
        {data?.lastTrainedAt && (
          <p className="text-[11px] text-gray-400 mt-0.5">
            Último entrenamiento:{' '}
            {new Date(data.lastTrainedAt).toLocaleDateString('es-PE')}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between mb-1.5">
            <p className="text-xs text-gray-600">Concordancia IA–Humano</p>
            <p className="text-xs font-medium text-gray-900">{concordance.toFixed(1)}%</p>
          </div>
          <Progress value={concordance} />
        </div>

        <div>
          <div className="flex justify-between mb-1.5">
            <p className="text-xs text-gray-600">Precisión de clasificación</p>
            <p className="text-xs font-medium text-gray-900">{accuracy.toFixed(1)}%</p>
          </div>
          <Progress value={accuracy} />
        </div>

        {data?.meanAbsoluteError !== undefined && (
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
            <p className="text-[11px] text-gray-500">Error absoluto medio (MAE)</p>
            <p className="text-xl font-medium text-gray-900 mt-0.5">
              {data.meanAbsoluteError.toFixed(2)}
            </p>
            <p className="text-[10px] text-gray-400">puntos de diferencia promedio</p>
          </div>
        )}

        <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
          <p className="text-[11px] text-gray-500">Pares de entrenamiento</p>
          <p className="text-xl font-medium text-gray-900 mt-0.5">{data?.totalPairs ?? 0}</p>
        </div>
      </div>
    </div>
  );
}
