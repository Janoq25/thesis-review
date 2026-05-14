'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate } from '@/lib/utils';
import {
  FileText, Upload, Clock, CheckCircle2, AlertTriangle,
  Loader2, BookOpen,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  PENDING: { label: 'Pendiente', className: 'bg-gray-100 text-gray-700', icon: Clock },
  AI_PROCESSING: { label: 'Analizando IA', className: 'bg-blue-50 text-blue-700', icon: Loader2 },
  AI_COMPLETE: { label: 'IA listo', className: 'bg-purple-50 text-purple-700', icon: CheckCircle2 },
  HUMAN_REVIEW: { label: 'En revisión', className: 'bg-amber-50 text-amber-700', icon: Clock },
  OBSERVED: { label: 'Observado', className: 'bg-orange-50 text-orange-700', icon: AlertTriangle },
  APPROVED: { label: 'Aprobado', className: 'bg-green-50 text-green-700', icon: CheckCircle2 },
  REJECTED: { label: 'Rechazado', className: 'bg-red-50 text-red-700', icon: AlertTriangle },
};

export default function StudentDashboardPage() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['my-advances'],
    queryFn: () => apiClient.get('/advances/mine').then((r) => r.data),
  });

  const advances = Array.isArray(data) ? data : data?.advances ?? [];

  const approved = advances.filter((a: any) => a.status === 'APPROVED').length;
  const observed = advances.filter((a: any) => a.status === 'OBSERVED').length;
  const inProgress = advances.filter((a: any) =>
    ['PENDING', 'AI_PROCESSING', 'AI_COMPLETE', 'HUMAN_REVIEW'].includes(a.status),
  ).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#185FA5]" />
            Mis avances
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Seguimiento de tus entregas y revisiones
          </p>
        </div>
        <a
          href="/advances/upload"
          className="h-9 px-4 rounded-lg bg-[#185FA5] text-white text-sm font-medium
                     hover:bg-[#0C447C] transition-colors flex items-center gap-1.5"
        >
          <Upload className="w-4 h-4" />
          Nuevo avance
        </a>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-medium text-gray-900">{advances.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total entregados</p>
        </div>
        <div className="rounded-xl border border-green-100 bg-green-50/30 p-4 text-center">
          <p className="text-2xl font-medium text-green-700">{approved}</p>
          <p className="text-xs text-green-600 mt-1">Aprobados</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-4 text-center">
          <p className="text-2xl font-medium text-amber-700">{observed + inProgress}</p>
          <p className="text-xs text-amber-600 mt-1">En proceso / observados</p>
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : advances.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Aún no has subido ningún avance</p>
            <a
              href="/advances/upload"
              className="inline-flex items-center gap-1.5 mt-3 text-sm text-[#185FA5] hover:underline"
            >
              <Upload className="w-4 h-4" />
              Subir mi primer avance
            </a>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {advances.map((adv: any) => {
              const statusCfg = STATUS_CONFIG[adv.status] ?? STATUS_CONFIG.PENDING;
              const StatusIcon = statusCfg.icon;
              const score = adv.aiAnalysis?.overallScore;
              return (
                <button
                  key={adv.id}
                  onClick={() => router.push(`/advances/${adv.id}/review`)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                    adv.fileType === 'pdf' ? 'bg-red-50' : 'bg-blue-50',
                  )}>
                    <FileText className={cn(
                      'w-4 h-4',
                      adv.fileType === 'pdf' ? 'text-red-600' : 'text-blue-600',
                    )} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {adv.title ?? 'Sin título'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {adv.advanceType?.replace('_', ' ')} · {adv.createdAt ? formatDate(adv.createdAt) : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {score != null && (
                      <span className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full',
                        score >= 80 ? 'bg-green-50 text-green-700'
                          : score >= 65 ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700',
                      )}>
                        {score.toFixed(0)}%
                      </span>
                    )}
                    <Badge className={cn('text-[10px] border-0 flex items-center gap-1', statusCfg.className)}>
                      <StatusIcon className="w-3 h-3" />
                      {statusCfg.label}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
