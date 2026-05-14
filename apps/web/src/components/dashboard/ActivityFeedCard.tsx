'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Skeleton } from '@/components/ui/skeleton';

interface Activity {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  user?: { name: string };
}

export function ActivityFeedCard() {
  const { data, isLoading } = useQuery<Activity[]>({
    queryKey: ['activity-feed'],
    queryFn: () => apiClient.get('/stats/activity-feed').then((r) => r.data),
    refetchInterval: 30_000,
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="p-5 border-b border-gray-100">
        <p className="text-sm font-medium text-gray-900">Actividad reciente</p>
      </div>
      <div className="p-5 space-y-3 max-h-72 overflow-y-auto">
        {isLoading &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 items-start">
              <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}

        {!isLoading && (!data || data.length === 0) && (
          <p className="text-sm text-gray-400 text-center py-6">Sin actividad reciente.</p>
        )}

        {!isLoading &&
          data?.map((item) => (
            <div key={item.id} className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-blue-800">
                {item.user?.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-800 leading-snug">{item.description}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {new Date(item.createdAt).toLocaleString('es-PE', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
