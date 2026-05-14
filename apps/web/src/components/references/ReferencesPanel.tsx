'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface ReferencesPanelProps {
  advanceId: string;
}

const STATUS_CONFIG = {
  VERIFIED: {
    icon: CheckCircle2,
    iconClass: 'text-green-600',
    label: 'Verificada',
    badgeClass: 'bg-green-50 text-green-800 border-green-200',
  },
  DOI_MISSING: {
    icon: AlertCircle,
    iconClass: 'text-amber-500',
    label: 'Sin DOI',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  DOI_INCORRECT: {
    icon: XCircle,
    iconClass: 'text-red-500',
    label: 'DOI incorrecto',
    badgeClass: 'bg-red-50 text-red-800 border-red-200',
  },
  NOT_FOUND: {
    icon: XCircle,
    iconClass: 'text-red-500',
    label: 'No encontrada',
    badgeClass: 'bg-red-50 text-red-800 border-red-200',
  },
  UNINDEXED: {
    icon: AlertCircle,
    iconClass: 'text-amber-500',
    label: 'No indexada',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  POSSIBLE_HALLUCINATION: {
    icon: XCircle,
    iconClass: 'text-red-600',
    label: 'Posible alucinación',
    badgeClass: 'bg-red-50 text-red-800 border-red-200',
  },
} as const;

export function ReferencesPanel({ advanceId }: ReferencesPanelProps) {
  const { data, refetch } = useQuery({
    queryKey: ['references-report', advanceId],
    queryFn: () =>
      apiClient.get(`/references/report/${advanceId}`).then((r) => r.data),
  });

  const analyzeMutation = useMutation({
    mutationFn: () => apiClient.post(`/references/analyze/${advanceId}`),
    onSuccess: () => {
      toast.success('Verificación iniciada. Puede tardar 30–60 segundos.');
      setTimeout(() => refetch(), 5000);
    },
  });

  if (!data) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500 mb-4">
          Verifique las referencias bibliográficas del documento contra CrossRef.
        </p>
        <Button
          size="sm"
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
          className="bg-[#185FA5] hover:bg-[#0C447C] text-white"
        >
          {analyzeMutation.isPending ? 'Iniciando...' : 'Verificar referencias con CrossRef'}
        </Button>
      </div>
    );
  }

  const references = data.references ?? [];
  const verified = references.filter((r: any) => r.status === 'VERIFIED').length;
  const errors = references.filter((r: any) => r.status !== 'VERIFIED').length;

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
          <p className="text-xl font-medium text-gray-900">{data.totalRefs}</p>
          <p className="text-xs text-gray-500">Total referencias</p>
        </div>
        <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-center">
          <p className="text-xl font-medium text-green-800">{verified}</p>
          <p className="text-xs text-green-600">Verificadas</p>
        </div>
        <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-center">
          <p className="text-xl font-medium text-red-800">{errors}</p>
          <p className="text-xs text-red-600">Con errores</p>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {references.map((ref: any) => {
          const config = STATUS_CONFIG[ref.status as keyof typeof STATUS_CONFIG];
          const Icon = config?.icon ?? AlertCircle;

          return (
            <div
              key={ref.id}
              className="rounded-lg border border-gray-200 bg-white p-3.5"
            >
              <div className="flex items-start gap-3">
                <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config?.iconClass}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-gray-900 leading-snug">
                      {ref.rawText.substring(0, 120)}
                      {ref.rawText.length > 120 && '…'}
                    </p>
                    <Badge variant="outline" className={`flex-shrink-0 text-[10px] ${config?.badgeClass}`}>
                      {config?.label}
                    </Badge>
                  </div>

                  {ref.doi && ref.status === 'VERIFIED' && (
                    
                      href={`https://doi.org/${ref.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline mt-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {ref.doi}
                    </a>
                  )}

                  {ref.suggestion && ref.status !== 'VERIFIED' && (
                    <div className="mt-2 bg-amber-50 border border-amber-100 rounded p-2 text-[11px] text-amber-800 leading-relaxed">
                      {ref.suggestion}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
