import { AlertTriangle } from 'lucide-react';

export function LowComplianceAlert({ count }: { count: number }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-amber-900">
          {count} avance{count > 1 ? 's' : ''} con bajo cumplimiento IA
        </p>
        <p className="text-xs text-amber-700 mt-0.5">
          Estos avances obtuvieron menos del {process.env.NEXT_PUBLIC_LOW_COMPLIANCE_ALERT ?? 65}%
          en el análisis automatizado y requieren atención prioritaria.
        </p>
      </div>
      <a href="/advances?status=AI_COMPLETE&lowCompliance=true"
         className="text-xs font-medium text-amber-800 hover:underline flex-shrink-0">
        Revisar →
      </a>
    </div>
  );
}
