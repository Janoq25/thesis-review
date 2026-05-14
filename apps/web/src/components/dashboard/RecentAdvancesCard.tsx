'use client';

import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pendiente', className: 'bg-gray-100 text-gray-700' },
  AI_PROCESSING: { label: 'Analizando IA', className: 'bg-blue-50 text-blue-700' },
  AI_COMPLETE: { label: 'IA listo', className: 'bg-purple-50 text-purple-700' },
  HUMAN_REVIEW: { label: 'En revisión', className: 'bg-amber-50 text-amber-700' },
  OBSERVED: { label: 'Observado', className: 'bg-orange-50 text-orange-700' },
  APPROVED: { label: 'Aprobado', className: 'bg-green-50 text-green-700' },
  REJECTED: { label: 'Rechazado', className: 'bg-red-50 text-red-700' },
};

function ScorePill({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-700 bg-green-50'
    : score >= 65 ? 'text-amber-700 bg-amber-50'
    : 'text-red-700 bg-red-50';
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

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-900">Avances recientes</h2>
        <a href="/advances" className="text-xs text-[#185FA5] hover:underline">Ver todos</a>
      </div>
      <div className="divide-y divide-gray-50">
        {advances.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Sin avances</p>
        )}
        {advances.map((adv) => {
          const statusCfg = STATUS_LABELS[adv.status] ?? STATUS_LABELS.PENDING;
          return (
            <button
              key={adv.id}
              onClick={() => router.push(`/advances/${adv.id}/review`)}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              {/* File icon */}
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-medium',
                adv.fileType === 'pdf' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700',
              )}>
                {adv.fileType.toUpperCase()}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{adv.title}</p>
                <p className="text-[11px] text-gray-400 truncate">
                  {adv.student.name} · {adv.program.name}
                </p>
              </div>
              {/* Score / status */}
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
