'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { useStatusConfig } from '@/lib/i18n/use-status-config';
import {
  FileText, Upload, Clock, CheckCircle2, AlertTriangle,
  Loader2, BookOpen,
} from 'lucide-react';

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

  const { data, isLoading } = useQuery({
    queryKey: ['my-advances'],
    queryFn: () => apiClient.get('/advances/mine').then((r) => r.data),
  });

  const advances = Array.isArray(data) ? data : data?.advances ?? [];

  const approved = advances.filter((a: { status: string }) => a.status === 'APPROVED').length;
  const observed = advances.filter((a: { status: string }) => a.status === 'OBSERVED').length;
  const inProgress = advances.filter((a: { status: string }) =>
    ['PENDING', 'AI_PROCESSING', 'AI_COMPLETE', 'HUMAN_REVIEW'].includes(a.status),
  ).length;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-[#185FA5] dark:text-blue-400 flex-shrink-0" />
            {t('student.title')}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('student.subtitle')}</p>
        </div>
        <a
          href="/advances/upload"
          className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-[#185FA5] text-white text-xs sm:text-sm font-medium
                     hover:bg-[#0C447C] transition-colors flex items-center gap-1 sm:gap-1.5 flex-shrink-0"
        >
          <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">{t('student.uploadNew')}</span>
          <span className="sm:hidden">Subir</span>
        </a>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 sm:p-4 text-center">
          <p className="text-xl sm:text-2xl font-medium text-gray-900 dark:text-gray-100">{advances.length}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">{t('student.totalSubmitted')}</p>
        </div>
        <div className="rounded-xl border border-green-100 dark:border-green-900 bg-green-50/30 dark:bg-green-950/30 p-3 sm:p-4 text-center">
          <p className="text-xl sm:text-2xl font-medium text-green-700 dark:text-green-300">{approved}</p>
          <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 mt-1">{t('student.approvedCount')}</p>
        </div>
        <div className="rounded-xl border border-amber-100 dark:border-amber-900 bg-amber-50/30 dark:bg-amber-950/30 p-3 sm:p-4 text-center">
          <p className="text-xl sm:text-2xl font-medium text-amber-700 dark:text-amber-300">{observed + inProgress}</p>
          <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 mt-1">{t('student.inProgressObserved')}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : advances.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('student.noUploadsYet')}</p>
            <a
              href="/advances/upload"
              className="inline-flex items-center gap-1.5 mt-3 text-sm text-[#185FA5] dark:text-blue-400 hover:underline"
            >
              <Upload className="w-4 h-4" />
              {t('student.uploadFirst')}
            </a>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {advances.map((adv: {
              id: string;
              status: string;
              title?: string;
              fileType?: string;
              advanceType?: string;
              createdAt?: string;
              aiAnalysis?: { overallScore?: number };
              plagiarismReport?: { overallSimilarity?: number };
            }) => {
              const statusCfg = STATUS_CONFIG[adv.status] ?? STATUS_CONFIG.PENDING;
              const StatusIcon = STATUS_ICONS[adv.status] ?? Clock;
              const score = adv.aiAnalysis?.overallScore;
              const similarity = adv.plagiarismReport?.overallSimilarity;

              return (
                <button
                  key={adv.id}
                  onClick={() => router.push(`/advances/${adv.id}/review`)}
                  className="w-full flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                      adv.fileType === 'pdf' ? 'bg-red-50 dark:bg-red-950' : 'bg-blue-50 dark:bg-blue-950',
                    )}
                  >
                    <FileText
                      className={cn(
                        'w-4 h-4',
                        adv.fileType === 'pdf' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400',
                      )}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {adv.title ?? '—'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {adv.advanceType?.replace('_', ' ')} · {adv.createdAt ? formatDate(adv.createdAt) : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {similarity != null && (
                      <span
                        className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full border',
                          similarity >= 15
                            ? 'bg-red-50 text-red-700 border-red-100'
                            : similarity >= 10
                              ? 'bg-amber-50 text-amber-700 border-amber-100'
                              : 'bg-green-50 text-green-700 border-green-100',
                        )}
                      >
                        P: {similarity.toFixed(0)}%
                      </span>
                    )}
                    {score != null && (
                      <span
                        className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full',
                          score >= 80
                            ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                            : score >= 65
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
                        )}
                      >
                        IA: {score.toFixed(0)}%
                      </span>
                    )}
                    <Badge className={cn('text-[10px] border-0 flex items-center gap-1', statusCfg.className)}>
                      <StatusIcon className={cn('w-3 h-3', adv.status === 'AI_PROCESSING' && 'animate-spin')} />
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
