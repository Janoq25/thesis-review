import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface KPICardProps {
  label: string;
  value: string | number;
  delta?: { value?: number; direction: 'up' | 'down' | 'neutral'; label: string };
  loading?: boolean;
}

export function KPICard({ label, value, delta, loading }: KPICardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <p className="text-2xl font-medium text-gray-900 mb-1">{value}</p>
      {delta && (
        <p className={cn(
          'text-xs',
          delta.direction === 'up' && 'text-green-600',
          delta.direction === 'down' && 'text-red-500',
          delta.direction === 'neutral' && 'text-gray-400',
        )}>
          {delta.direction === 'up' && '↑ '}
          {delta.direction === 'down' && '↓ '}
          {delta.value != null && `${delta.value}% `}
          {delta.label}
        </p>
      )}
    </div>
  );
}
