'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatRelative } from '@/lib/utils';
import {
  Upload, CheckCircle2, AlertTriangle, Bot, FileSearch,
} from 'lucide-react';

const ICON_MAP: Record<string, typeof Upload> = {
  upload: Upload,
  approved: CheckCircle2,
  observed: AlertTriangle,
  ai_complete: Bot,
  review: FileSearch,
};

const COLOR_MAP: Record<string, string> = {
  upload: 'bg-blue-50 text-blue-600',
  approved: 'bg-green-50 text-green-600',
  observed: 'bg-amber-50 text-amber-600',
  ai_complete: 'bg-purple-50 text-purple-600',
  review: 'bg-gray-100 text-gray-600',
};

interface Activity {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  user?: { name: string };
}

export function ActivityFeedCard() {
  const { data: activities } = useQuery({
    queryKey: ['activity-feed'],
    queryFn: () =>
      apiClient.get('/advances', { params: { pageSize: 6 } }).then((r) => {
        const advances = r.data?.advances ?? [];
        return advances.map((a: any) => ({
          id: a.id,
          type: a.status === 'APPROVED' ? 'approved'
            : a.status === 'OBSERVED' ? 'observed'
            : a.status === 'AI_COMPLETE' ? 'ai_complete'
            : a.status === 'HUMAN_REVIEW' ? 'review'
            : 'upload',
          message: `${a.student?.name ?? 'Estudiante'} — ${a.title ?? 'Avance'}`,
          createdAt: a.createdAt,
          user: a.student,
        }));
      }),
    refetchInterval: 60_000,
  });

  const feed: Activity[] = activities ?? [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-medium text-gray-900">Actividad reciente</h2>
      </div>
      <div className="divide-y divide-gray-50">
        {feed.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Sin actividad reciente</p>
        )}
        {feed.map((item) => {
          const Icon = ICON_MAP[item.type] ?? Upload;
          const colorClass = COLOR_MAP[item.type] ?? COLOR_MAP.upload;
          return (
            <div key={item.id} className="flex items-start gap-3 px-5 py-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-700 truncate">{item.message}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {item.createdAt ? formatRelative(item.createdAt) : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
