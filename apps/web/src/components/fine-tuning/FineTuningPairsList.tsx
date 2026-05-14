'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface FineTuningPair {
  id: string;
  aiGrade: number;
  humanGrade: number;
  outcomeType: string;
  createdAt: string;
  advance?: { title?: string };
}

export function FineTuningPairsList() {
  const { data, isLoading } = useQuery<FineTuningPair[]>({
    queryKey: ['fine-tuning-pairs'],
    queryFn: () => apiClient.get('/fine-tuning/pairs').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
        <Skeleton className="h-4 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="p-5 border-b border-gray-100">
        <p className="text-sm font-medium text-gray-900">
          Pares de entrenamiento ({data?.length ?? 0})
        </p>
      </div>
      <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {!data?.length && (
          <p className="text-sm text-gray-400 text-center py-8">
            No hay pares de entrenamiento todavía.
          </p>
        )}
        {data?.map((pair) => (
          <div key={pair.id} className="flex items-center justify-between px-5 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">
                {pair.advance?.title ?? pair.id}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                IA: <span className="font-medium">{pair.aiGrade}</span> → Humano:{' '}
                <span className="font-medium">{pair.humanGrade}</span>
              </p>
            </div>
            <Badge
              variant="outline"
              className={
                pair.outcomeType === 'AGREEMENT'
                  ? 'bg-green-50 text-green-800 border-green-200'
                  : pair.outcomeType === 'OVERRIDE'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-gray-50 text-gray-700'
              }
            >
              {pair.outcomeType === 'AGREEMENT'
                ? 'Concordante'
                : pair.outcomeType === 'OVERRIDE'
                ? 'Corrección'
                : pair.outcomeType}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
