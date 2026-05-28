'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { useStatusConfig } from '@/lib/i18n/use-status-config';
import {
  Search, Filter, ChevronLeft, ChevronRight,
  FileText, Loader2, Eye,
} from 'lucide-react';

export default function AdvancesPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { config: STATUS_CONFIG, statuses: STATUSES } = useStatusConfig();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const pageSize = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['advances', page, statusFilter],
    queryFn: () =>
      apiClient
        .get('/advances', { params: { page, pageSize, status: statusFilter || undefined } })
        .then((r) => r.data),
  });

  const advances = data?.advances ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize) || 1;

  const filtered = search
    ? advances.filter(
        (a: { title?: string; student?: { name?: string } }) =>
          a.title?.toLowerCase().includes(search.toLowerCase()) ||
          a.student?.name?.toLowerCase().includes(search.toLowerCase()),
      )
    : advances;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base sm:text-xl font-medium text-gray-900 dark:text-gray-100">{t('advances.title')}</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {t('advances.total', { count: total })}
          </p>
        </div>
        <a
          href="/advances/upload"
          className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg bg-[#185FA5] text-white text-xs sm:text-sm font-medium
                     hover:bg-[#0C447C] transition-colors flex items-center gap-1 sm:gap-1.5 flex-shrink-0"
        >
          <span className="text-sm sm:text-base leading-none">+</span>
          <span className="hidden sm:inline">{t('dashboard.newAdvance')}</span>
          <span className="sm:hidden">Nuevo</span>
        </a>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('advances.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 dark:border-gray-600 text-sm
                       placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2
                       focus:ring-[#185FA5]/20 focus:border-[#185FA5]"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="flex-1 sm:flex-none h-9 rounded-lg border border-gray-200 dark:border-gray-600 px-3 text-sm text-gray-700 dark:text-gray-200"
          >
            <option value="">{t('dashboard.allStatuses')}</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {STATUS_CONFIG[s]?.label ?? s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.noAdvancesFound')}</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/50">
                <th className="px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">{t('advances.documentTitle')}</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">{t('advances.student')}</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">{t('advances.type')}</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">{t('advances.filterStatus')}</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell">{t('advances.score')}</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell">Plagio</th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell">{t('advances.date')}</th>
                <th className="px-5 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map((adv: {
                id: string;
                status: string;
                title?: string;
                fileType?: string;
                advanceType?: string;
                createdAt?: string;
                student?: { name?: string };
                aiAnalysis?: { overallScore?: number };
                plagiarismReport?: { overallSimilarity?: number };
              }) => {
                const statusCfg = STATUS_CONFIG[adv.status] ?? STATUS_CONFIG.PENDING;
                const score = adv.aiAnalysis?.overallScore;
                const similarity = adv.plagiarismReport?.overallSimilarity;

                return (
                  <tr
                    key={adv.id}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/advances/${adv.id}/review`)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-[9px] font-medium',
                            adv.fileType === 'pdf'
                              ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                              : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
                          )}
                        >
                          {(adv.fileType ?? 'doc').toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
                          {adv.title ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {adv.student?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell">
                      {adv.advanceType?.replace('_', ' ') ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <Badge className={cn('text-[10px] border-0', statusCfg.className)}>
                        {statusCfg.label}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      {score != null ? (
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
                          {score.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      {similarity != null ? (
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
                          {similarity.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                      {adv.createdAt ? formatDate(adv.createdAt) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <Eye className="w-4 h-4 text-gray-400" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('advances.pageOf', { page, total: totalPages })}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-8 w-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center
                         text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-8 w-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center
                         text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
