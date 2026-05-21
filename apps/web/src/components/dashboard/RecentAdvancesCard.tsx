'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { useStatusConfig } from '@/lib/i18n/use-status-config';

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-950'
      : score >= 65
        ? 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950'
        : 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950';
  return (
    <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', color)}>
      {score.toFixed(0)}%
    </span>
  );
}

interface Advance {
  id: string;
  title: string;
  fileType: string;
  status: string;
  createdAt: string;
  student: { name: string };
  program: { name: string };
  aiAnalysis?: { overallScore: number };
}

export function RecentAdvancesCard({ advances }: { advances: Advance[] }) {
  const router = useRouter();
  const { t } = useI18n();
  const { config: STATUS_LABELS } = useStatusConfig();

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {t('dashboard.recentAdvances')}
        </h2>
        <a href="/advances" className="text-xs text-[#185FA5] dark:text-blue-400 hover:underline">
          {t('common.view')} →
        </a>
      </div>
      <div className="divide-y divide-gray-50 dark:divide-gray-800">
        {advances.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">{t('common.noResults')}</p>
        )}
        {advances.map((adv) => {
          const statusCfg = STATUS_LABELS[adv.status] ?? STATUS_LABELS.PENDING;
          return (
            <button
              key={adv.id}
              onClick={() => router.push(`/advances/${adv.id}/review`)}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-medium',
                  adv.fileType === 'pdf'
                    ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                    : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
                )}
              >
                {adv.fileType.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{adv.title}</p>
                <p className="text-[11px] text-gray-400 truncate">
                  {adv.student.name} · {adv.program.name}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {adv.aiAnalysis && <ScorePill score={adv.aiAnalysis.overallScore} />}
                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', statusCfg.className)}>
                  {statusCfg.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
