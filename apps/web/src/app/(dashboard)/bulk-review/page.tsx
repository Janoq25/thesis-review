'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate } from '@/lib/utils';
import { Layers, Loader2, CheckCircle2, XCircle, Eye } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pendiente', className: 'bg-gray-100 text-gray-700' },
  AI_PROCESSING: { label: 'Analizando IA', className: 'bg-blue-50 text-blue-700' },
  AI_COMPLETE: { label: 'IA listo', className: 'bg-purple-50 text-purple-700' },
  HUMAN_REVIEW: { label: 'En revisión', className: 'bg-amber-50 text-amber-700' },
  OBSERVED: { label: 'Observado', className: 'bg-orange-50 text-orange-700' },
  APPROVED: { label: 'Aprobado', className: 'bg-green-50 text-green-700' },
  REJECTED: { label: 'Rechazado', className: 'bg-red-50 text-red-700' },
};

export default function BulkReviewPage() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState<'APPROVED' | 'OBSERVED' | 'REJECTED'>('APPROVED');
  const [comment, setComment] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['advances-for-bulk'],
    queryFn: () =>
      apiClient.get('/advances', { params: { status: 'AI_COMPLETE', pageSize: 50 } }).then((r) => r.data),
  });

  const advances = data?.advances ?? [];

  const applyMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/bulk-review/apply-status', {
        advanceIds: [...selectedIds],
        status: batchAction,
        comment: comment || undefined,
      }),
    onSuccess: (res) => {
      toast.success(`${res.data?.updated ?? selectedIds.size} avances actualizados`);
      setSelectedIds(new Set());
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['advances-for-bulk'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Error al aplicar acción masiva');
    },
  });

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === advances.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(advances.map((a: any) => a.id)));
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-medium text-gray-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#185FA5]" />
          Revisión por lotes
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Selecciona avances con análisis IA completado para aplicar acciones masivas.
        </p>
      </div>

      {/* Barra de acciones */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.size} seleccionado{selectedIds.size > 1 ? 's' : ''}
          </span>
          <select
            value={batchAction}
            onChange={(e) => setBatchAction(e.target.value as any)}
            className="h-8 rounded-lg border border-blue-200 px-2 text-sm bg-white"
          >
            <option value="APPROVED">Aprobar</option>
            <option value="OBSERVED">Observar</option>
            <option value="REJECTED">Rechazar</option>
          </select>
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comentario (opcional)..."
            className="flex-1 h-8 rounded-lg border border-blue-200 px-3 text-sm bg-white placeholder-gray-400"
          />
          <button
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending}
            className="h-8 px-4 rounded-lg bg-[#185FA5] text-white text-sm font-medium
                       hover:bg-[#0C447C] disabled:opacity-50 flex items-center gap-1.5"
          >
            {applyMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Aplicar
          </button>
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : advances.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No hay avances listos para revisión por lotes</p>
            <p className="text-xs text-gray-400 mt-1">Los avances aparecerán aquí cuando el análisis IA se complete</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === advances.length && advances.length > 0}
                    onChange={toggleAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Título</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Estudiante</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Nota IA</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 hidden md:table-cell">Estado</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 hidden lg:table-cell">Fecha</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {advances.map((adv: any) => {
                const score = adv.aiAnalysis?.overallScore;
                const statusCfg = STATUS_CONFIG[adv.status] ?? STATUS_CONFIG.PENDING;
                return (
                  <tr key={adv.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(adv.id)}
                        onChange={() => toggleId(adv.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-[200px]">
                      {adv.title ?? 'Sin título'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {adv.student?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {score != null ? (
                        <span className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full',
                          score >= 80 ? 'bg-green-50 text-green-700'
                            : score >= 65 ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700',
                        )}>
                          {score.toFixed(0)}%
                        </span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge className={cn('text-[10px] border-0', statusCfg.className)}>
                        {statusCfg.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">
                      {adv.createdAt ? formatDate(adv.createdAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <a href={`/advances/${adv.id}/review`} className="text-gray-400 hover:text-[#185FA5]">
                        <Eye className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
