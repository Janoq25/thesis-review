'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const FT_THRESHOLD = 500;

export function FineTuningDashboard() {
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['ft-stats'],
    queryFn: () => apiClient.get('/fine-tuning/stats').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: datasets } = useQuery({
    queryKey: ['ft-datasets'],
    queryFn: () => apiClient.get('/fine-tuning/datasets').then((r) => r.data),
  });

  const launchMutation = useMutation({
    mutationFn: () => apiClient.post('/fine-tuning/launch'),
    onSuccess: () => {
      toast.success('Fine-tuning iniciado. Recibirás una notificación al completar.');
      qc.invalidateQueries({ queryKey: ['ft-datasets'] });
    },
    onError: () => toast.error('Error al iniciar fine-tuning'),
  });

  const totalPairs = stats?.totalPairs ?? 0;
  const progress = Math.min(100, Math.round((totalPairs / FT_THRESHOLD) * 100));
  const activeDataset = datasets?.find(
    (d: any) => d.status === 'COMPLETED',
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Progreso de recolección */}
      <div className="md:col-span-2 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Pares de entrenamiento recolectados</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Se requieren {FT_THRESHOLD} para iniciar fine-tuning automático
            </p>
          </div>
          {totalPairs >= FT_THRESHOLD && (
            <Badge className="bg-green-50 text-green-800 border-green-200">Listo</Badge>
          )}
        </div>

        <div className="flex items-center gap-3 mb-2">
          <Progress value={progress} className="flex-1 h-2.5" />
          <span className="text-sm font-medium text-gray-900 w-16 text-right">
            {totalPairs} / {FT_THRESHOLD}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          {stats?.byOutcome?.map((item: any) => (
            <div
              key={item.outcomeType}
              className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100"
            >
              <p className="text-lg font-medium text-gray-900">{item._count._all}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{item.outcomeType.replace('_', ' ')}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-3">
          <Button
            onClick={() => launchMutation.mutate()}
            disabled={launchMutation.isPending}
            className="bg-[#185FA5] hover:bg-[#0C447C] text-white"
          >
            {launchMutation.isPending ? 'Iniciando...' : 'Lanzar fine-tuning manual'}
          </Button>
          {activeDataset && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Modelo activo: <code className="font-mono text-gray-700">{activeDataset.modelId}</code>
            </div>
          )}
        </div>
      </div>

      {/* Historial de datasets */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-sm font-medium text-gray-900 mb-3">Historial de modelos</p>
        <div className="space-y-2">
          {(datasets ?? []).slice(0, 5).map((ds: any) => (
            <div key={ds.id} className="flex items-center justify-between py-1.5">
              <div>
                <p className="text-xs font-medium text-gray-800">{ds.name}</p>
                <p className="text-[11px] text-gray-500">{ds.pairCount} pares</p>
              </div>
              <Badge
                variant="outline"
                className={
                  ds.status === 'COMPLETED'
                    ? 'text-green-700 border-green-200 bg-green-50'
                    : ds.status === 'TRAINING'
                    ? 'text-blue-700 border-blue-200 bg-blue-50'
                    : 'text-gray-600 border-gray-200'
                }
              >
                {ds.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
