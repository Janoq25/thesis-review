'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { cn, formatDayMonth } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { useStatusConfig } from '@/lib/i18n/use-status-config';
import {
  Clock, CheckCircle2, AlertTriangle,
  Loader2, BookOpen, Layers, ArrowRight, ShieldCheck,
} from 'lucide-react';

interface Advance {
  id: string;
  title: string;
  isSimulation: boolean;
  status: string;
  createdAt: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  deadlineDate: string | null;
  isActive: boolean;
  createdAt: string;
  advances: Advance[];
}

const STATUS_ICONS: Record<string, typeof Clock> = {
  PENDING: Clock,
  AI_PROCESSING: Loader2,
  AI_COMPLETE: CheckCircle2,
  HUMAN_REVIEW: Clock,
  OBSERVED: AlertTriangle,
  APPROVED: CheckCircle2,
  REJECTED: AlertTriangle,
};

export default function StudentDashboardPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { config: STATUS_CONFIG } = useStatusConfig();

  const { data: assignments, isLoading } = useQuery<Assignment[]>({
    queryKey: ['student-assignments'],
    queryFn: () => apiClient.get('/assignments/student').then((r) => r.data),
  });

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-950 dark:text-white flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-[#185FA5] flex-shrink-0" />
          {t('student.title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('student.subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : !assignments || assignments.length === 0 ? (
        <div className="border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center space-y-3">
          <Layers className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto" />
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">No hay tareas pendientes</div>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Tu asesor aún no ha creado ninguna tarea o fecha límite de entrega. Te notificaremos cuando tengas una nueva tarea asignada.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Tareas de Investigación</h2>
          
          <div className="grid grid-cols-1 gap-4">
            {assignments.map((assignment) => {
              const officialSubmission = assignment.advances.find(a => !a.isSimulation);
              const simulations = assignment.advances.filter(a => a.isSimulation);
              
              const hasPassed = assignment.deadlineDate && new Date(assignment.deadlineDate) < new Date();
              const statusCfg = officialSubmission 
                ? (STATUS_CONFIG[officialSubmission.status] ?? STATUS_CONFIG.PENDING) 
                : { label: 'Pendiente de entrega', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
              
              const StatusIcon = officialSubmission ? (STATUS_ICONS[officialSubmission.status] ?? Clock) : Clock;

              return (
                <div
                  key={assignment.id}
                  onClick={() => router.push(`/student/assignments/${assignment.id}`)}
                  className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm 
                             hover:border-[#185FA5]/30 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 cursor-pointer group"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-950 dark:text-white leading-tight group-hover:text-[#185FA5] transition-colors">
                        {assignment.title}
                      </h3>
                      {assignment.deadlineDate && !officialSubmission && !hasPassed && (
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                          Activa
                        </span>
                      )}
                      {hasPassed && !officialSubmission && (
                        <span className="text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-medium">
                          Vencida
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 max-w-2xl">
                      {assignment.description || 'Sin instrucciones adicionales.'}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Límite: {assignment.deadlineDate ? (
                          <span className={cn(hasPassed && !officialSubmission ? 'text-red-500 font-medium' : 'text-gray-600 dark:text-gray-300')}>
                            {formatDayMonth(assignment.deadlineDate)}
                          </span>
                        ) : (
                          <span>Sin límite</span>
                        )}
                      </span>
                      {simulations.length > 0 && (
                        <span className="flex items-center gap-1 text-blue-500 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {simulations.length} {simulations.length === 1 ? 'simulación' : 'simulaciones'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-50 dark:border-gray-800">
                    <div className="flex flex-col items-start sm:items-end gap-1">
                      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Estado de entrega</span>
                      <Badge className={cn('text-xs border-0 flex items-center gap-1 px-2.5 py-1', statusCfg.className)}>
                        {officialSubmission && (
                          <StatusIcon className={cn('w-3.5 h-3.5', officialSubmission.status === 'AI_PROCESSING' && 'animate-spin')} />
                        )}
                        {statusCfg.label}
                      </Badge>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 group-hover:bg-[#185FA5]/10 flex items-center justify-center transition-colors">
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#185FA5] transition-colors" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
