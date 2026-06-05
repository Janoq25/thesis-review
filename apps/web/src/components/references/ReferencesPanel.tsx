import { useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, AlertCircle, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface ReferencesPanelProps {
  advanceId: string;
}

const STATUS_CONFIG = {
  VERIFIED: {
    icon: CheckCircle2,
    iconClass: 'text-green-600',
    label: 'Correcta',
    badgeClass: 'bg-green-50 text-green-800 border-green-200',
  },
  DOI_MISSING: {
    icon: AlertCircle,
    iconClass: 'text-amber-500',
    label: 'Falta DOI',
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
    label: 'Incompleta',
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
  const extractedRef = useRef(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['references-report', advanceId],
    queryFn: () => apiClient.get(`/references/report/${advanceId}`).then((r) => r.data),
  });

  const analyzeMutation = useMutation({
    mutationFn: () => apiClient.post(`/references/analyze/${advanceId}`),
    onSuccess: () => {
      toast.success('Análisis de referencias completado con éxito.');
      refetch();
    },
    onError: (err: any) => {
      if (err.response?.status === 403) {
        toast.error('No tienes permisos para realizar el análisis.');
      } else {
        toast.error('Error al analizar las referencias. Por favor, intenta de nuevo.');
      }
    }
  });

  useEffect(() => {
    // Auto-trigger if empty
    if (!isLoading && (!data || !data.references || data.references.length === 0) && !extractedRef.current) {
      extractedRef.current = true;
      analyzeMutation.mutate();
    }
  }, [data, isLoading, analyzeMutation]);

  if (isLoading || analyzeMutation.isPending) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-12 flex flex-col items-center justify-center text-center">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-4" />
        <p className="text-sm text-gray-600 font-medium">
          Analizando referencias con Inteligencia Artificial...
        </p>
        <p className="text-xs text-gray-400 mt-2 max-w-xs">
          Este proceso evalúa formato APA, veracidad de autores y búsqueda de DOIs. Puede tardar hasta 30 segundos.
        </p>
      </div>
    );
  }

  if (!data || !data.references || data.references.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-8 flex flex-col items-center text-center">
        <p className="text-sm text-gray-500 mb-4">
          No se encontraron referencias o hubo un error en la extracción.
        </p>
        <Button
          size="sm"
          onClick={() => {
            extractedRef.current = true;
            analyzeMutation.mutate();
          }}
          className="bg-[#185FA5] hover:bg-[#0C447C] text-white"
        >
          Reintentar análisis
        </Button>
      </div>
    );
  }

  const references = data.references ?? [];
  const verified = references.filter((r: any) => r.status === 'VERIFIED').length;
  const issuesCount = references.length - verified;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-center">
          <p className="text-xl font-medium text-gray-900">{references.length}</p>
          <p className="text-xs text-gray-500">Total analizadas</p>
        </div>
        <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-center">
          <p className="text-xl font-medium text-green-800">{verified}</p>
          <p className="text-xs text-green-600">Formato correcto</p>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-center">
          <p className="text-xl font-medium text-amber-800">{issuesCount}</p>
          <p className="text-xs text-amber-600">Observaciones</p>
        </div>
      </div>

      <div className="flex justify-between items-center px-1">
        <h3 className="text-sm font-semibold text-gray-700">Detalle del Análisis (APA 7)</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
          className="text-[10px] h-7 px-2"
        >
          <Sparkles className="w-3 h-3 mr-1" />
          Re-analizar
        </Button>
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {references.map((ref: any) => {
          const config = STATUS_CONFIG[ref.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.NOT_FOUND;
          const Icon = config.icon;
          const suggestion = ref.crossrefData?.suggestion;

          return (
            <div
              key={ref.id}
              className={`rounded-lg border bg-white p-3.5 transition-colors ${
                ref.status === 'VERIFIED' ? 'border-green-100 bg-green-50/10' : 'border-amber-100 bg-amber-50/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.iconClass}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge variant="outline" className={`flex-shrink-0 text-[10px] ${config.badgeClass}`}>
                      {config.label}
                    </Badge>
                  </div>

                  <p className="text-xs font-medium text-gray-900 leading-relaxed mb-2">
                    {ref.rawText}
                  </p>

                  {(ref.title || ref.authors) && (
                    <div className="mb-2 text-[10px] text-gray-500 italic">
                      {ref.authors && <span>{ref.authors} </span>}
                      {ref.year && <span>({ref.year}). </span>}
                      {ref.title && <span className="font-medium text-gray-600">{ref.title}</span>}
                    </div>
                  )}

                  {ref.doi && (
                    <a
                      href={ref.doi.startsWith('http') ? ref.doi : `https://doi.org/${ref.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline mb-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {ref.doi}
                    </a>
                  )}

                  {ref.issues && ref.issues.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] font-semibold text-gray-700">Observaciones:</p>
                      <ul className="list-disc pl-4 text-[11px] text-gray-600">
                        {ref.issues.map((issue: string, idx: number) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {suggestion && (
                    <div className="mt-2 bg-blue-50 border border-blue-100 rounded p-2 text-[11px] text-blue-800 leading-relaxed">
                      <strong>Sugerencia APA 7:</strong> {suggestion}
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
