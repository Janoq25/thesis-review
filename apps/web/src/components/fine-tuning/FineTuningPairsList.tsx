'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate } from '@/lib/utils';
import { Loader2, Database } from 'lucide-react';

const OUTCOME_CONFIG: Record<string, { label: string; className: string }> = {
  ACCEPTED: { label: 'Aceptado', className: 'bg-green-50 text-green-700' },
  ACCEPTED_WITH_EDIT: { label: 'Editado', className: 'bg-blue-50 text-blue-700' },
  DISCARDED: { label: 'Descartado', className: 'bg-red-50 text-red-700' },
  SEVERITY_CHANGED: { label: 'Severidad', className: 'bg-amber-50 text-amber-700' },
};

interface TrainingPair {
  id: string;
  aiOutput: string;
  humanComment: string;
  outcome: string;
  createdAt: string;
}

export function FineTuningPairsList() {
  const { data: pairs, isLoading } = useQuery({
    queryKey: ['fine-tuning-pairs'],
    queryFn: () => apiClient.get('/fine-tuning/pairs').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    );
  }

  const list: TrainingPair[] = pairs ?? [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <Database className="w-4 h-4 text-[#185FA5]" />
        <h2 className="text-sm font-medium text-gray-900">
          Pares de entrenamiento ({list.length})
        </h2>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-12">
          <Database className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Sin pares de entrenamiento</p>
          <p className="text-xs text-gray-400 mt-1">
            Los pares se generan cuando un asesor da feedback a hallazgos de IA
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {list.map((pair) => {
            const outCfg = OUTCOME_CONFIG[pair.outcome] ?? OUTCOME_CONFIG.ACCEPTED;
            return (
              <div key={pair.id} className="px-5 py-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Badge className={cn('text-[10px] border-0', outCfg.className)}>
                    {outCfg.label}
                  </Badge>
                  <span className="text-[10px] text-gray-400">
                    {pair.createdAt ? formatDate(pair.createdAt) : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-[10px] font-medium text-gray-500 mb-1">Hallazgo IA</p>
                    <p className="text-xs text-gray-700 line-clamp-3">{pair.aiOutput}</p>
                  </div>
                  <div className="bg-blue-50/50 rounded-lg p-2.5">
                    <p className="text-[10px] font-medium text-blue-600 mb-1">Corrección humana</p>
                    <p className="text-xs text-gray-700 line-clamp-3">
                      {pair.humanComment || '(sin comentario)'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
