'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { useState } from 'react';
import { Check, X, Edit3, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const SEVERITY_CONFIG = {
  CRITICAL: { label: 'Crítico', className: 'bg-red-50 text-red-800' },
  MAJOR: { label: 'Mayor', className: 'bg-amber-50 text-amber-800' },
  MINOR: { label: 'Menor', className: 'bg-green-50 text-green-700' },
  SUGGESTION: { label: 'Sugerencia', className: 'bg-blue-50 text-blue-700' },
};

interface Finding {
  id: string;
  sectionRef: string;
  pageRef?: number;
  severity: keyof typeof SEVERITY_CONFIG;
  description: string;
  correctionSteps: string;
  exampleImprovement: string;
  recommendation: string;
  humanAccepted?: boolean | null;
  humanComment?: string | null;
}

function FindingCard({ finding }: { finding: Finding }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [comment, setComment] = useState(finding.humanComment ?? '');

  const feedbackMutation = useMutation({
    mutationFn: (body: {
      outcome: string;
      humanComment?: string;
      adjustedDescription?: string;
    }) => apiClient.post(`/fine-tuning/findings/${finding.id}/feedback`, body),
    onSuccess: (_, vars) => {
      toast.success(
        vars.outcome === 'DISCARDED' ? 'Hallazgo descartado' :
        vars.outcome === 'ACCEPTED' ? 'Hallazgo aceptado' : 'Guardado',
      );
      qc.invalidateQueries({ queryKey: ['advance-review'] });
      setEditMode(false);
    },
  });

  const cfg = SEVERITY_CONFIG[finding.severity];
  const isProcessed = finding.humanAccepted !== null && finding.humanAccepted !== undefined;

  return (
    <div className={cn(
      'rounded-lg border p-3.5 transition-colors',
      finding.humanAccepted === true ? 'border-green-200 bg-green-50/30' :
      finding.humanAccepted === false ? 'border-gray-100 bg-gray-50 opacity-60' :
      'border-gray-200 bg-white',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', cfg.className)}>
            {cfg.label}
          </span>
          <span className="text-xs font-medium text-gray-900">{finding.sectionRef}</span>
          {finding.pageRef && (
            <span className="text-[10px] text-gray-400">pág. ~{finding.pageRef}</span>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Descripción */}
      <p className="text-xs text-gray-700 leading-relaxed mb-3">{finding.description}</p>

      {/* Detalle expandible */}
      {expanded && (
        <div className="space-y-2 mb-3">
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-[10px] font-medium text-gray-500 mb-1">Instrucción de corrección</p>
            <p className="text-xs text-gray-700 leading-relaxed">{finding.correctionSteps}</p>
          </div>
          {finding.exampleImprovement && (
            <div className="bg-blue-50 rounded-lg p-2.5 border-l-2 border-[#185FA5]" style={{ borderRadius: '0 8px 8px 0' }}>
              <p className="text-[10px] font-medium text-blue-700 mb-1">Ejemplo de mejora</p>
              <p className="text-xs text-blue-800 leading-relaxed italic">
                {finding.exampleImprovement}
              </p>
            </div>
          )}
          {finding.recommendation && (
            <p className="text-[11px] text-gray-500 italic">{finding.recommendation}</p>
          )}
        </div>
      )}

      {/* Modo edición */}
      {editMode && (
        <div className="mb-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comentario del asesor (se usará para mejorar el modelo de IA)..."
            className="w-full text-xs p-2 border border-gray-200 rounded-lg resize-none h-16
                       focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
          />
        </div>
      )}

      {/* Acciones */}
      {!isProcessed && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => feedbackMutation.mutate({ outcome: 'ACCEPTED' })}
            disabled={feedbackMutation.isPending}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md
                       border border-green-200 text-green-700 hover:bg-green-50"
          >
            <Check className="w-3 h-3" />
            Aceptar
          </button>
          <button
            onClick={() => setEditMode(!editMode)}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md
                       border border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <Edit3 className="w-3 h-3" />
            Editar
          </button>
          {editMode && (
            <button
              onClick={() =>
                feedbackMutation.mutate({
                  outcome: 'ACCEPTED_WITH_EDIT',
                  humanComment: comment,
                })
              }
              disabled={feedbackMutation.isPending}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md
                         bg-[#185FA5] text-white hover:bg-[#0C447C]"
            >
              Guardar edición
            </button>
          )}
          <button
            onClick={() =>
              feedbackMutation.mutate({ outcome: 'DISCARDED', humanComment: comment })
            }
            disabled={feedbackMutation.isPending}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md
                       border border-red-200 text-red-700 hover:bg-red-50 ml-auto"
          >
            <X className="w-3 h-3" />
            Descartar
          </button>
        </div>
      )}

      {/* Estado procesado */}
      {isProcessed && (
        <div className={cn(
          'flex items-center gap-1.5 text-[11px] font-medium',
          finding.humanAccepted ? 'text-green-600' : 'text-gray-400',
        )}>
          {finding.humanAccepted
            ? <><Check className="w-3 h-3" /> Aceptado por el asesor</>
            : <><X className="w-3 h-3" /> Descartado</>}
          {finding.humanComment && (
            <span className="text-gray-500 font-normal ml-1">— {finding.humanComment}</span>
          )}
        </div>
      )}
    </div>
  );
}

interface AIEvaluationPanelProps {
  analysis: any;
  advanceId: string;
}

export function AIEvaluationPanel({ analysis, advanceId }: AIEvaluationPanelProps) {
  const [filter, setFilter] = useState<string>('ALL');

  if (!analysis) {
    return (
      <div className="text-center py-12">
        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3">
          <span className="text-purple-700 text-sm font-medium">IA</span>
        </div>
        <p className="text-sm font-medium text-gray-700 mb-1">Análisis en proceso</p>
        <p className="text-xs text-gray-500">
          El pipeline de IA está procesando el documento. Esto puede tardar hasta 30 segundos.
        </p>
      </div>
    );
  }

  const findings: Finding[] = analysis.findings ?? [];
  const filtered = findings
    .filter((f) => filter === 'ALL' || f.severity === filter)
    .sort((a, b) => {
      const order = { CRITICAL: 0, MAJOR: 1, MINOR: 2, SUGGESTION: 3 };
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    });

  const dimensions = [
    { label: 'Estructura', value: analysis.structureScore, color: '#185FA5', weight: '30%' },
    { label: 'Contenido', value: analysis.contentScore, color: '#1D9E75', weight: '40%' },
    { label: 'Forma', value: analysis.formScore, color: '#BA7517', weight: '20%' },
    { label: 'Originalidad', value: analysis.originalityScore, color: '#7F77DD', weight: '10%' },
  ];

  return (
    <div className="space-y-4">
      {/* Score */}
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-full border-4 flex flex-col items-center justify-center flex-shrink-0"
          style={{
            borderColor: analysis.overallScore >= 80 ? '#1D9E75'
              : analysis.overallScore >= 65 ? '#BA7517' : '#E24B4A',
          }}
        >
          <span className="text-lg font-medium leading-tight"
            style={{
              color: analysis.overallScore >= 80 ? '#1D9E75'
                : analysis.overallScore >= 65 ? '#BA7517' : '#E24B4A',
            }}>
            {Math.round(analysis.overallScore)}%
          </span>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">
            Nota IA: {analysis.gradeConverted?.toFixed(1)} / {process.env.NEXT_PUBLIC_MAX_GRADE ?? 20}
          </p>
          <p className="text-xs text-gray-500">
            {findings.length} hallazgos ·{' '}
            {findings.filter((f) => f.severity === 'CRITICAL').length} críticos
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">{analysis.modelUsed}</p>
        </div>
      </div>

      {/* Dimensiones */}
      <div className="space-y-2">
        {dimensions.map(({ label, value, color, weight }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-[90px] flex-shrink-0">{label} ({weight})</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${value}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-xs font-medium text-gray-700 w-9 text-right">
              {Math.round(value)}%
            </span>
          </div>
        ))}
      </div>

      {/* Resumen ejecutivo */}
      <div className="bg-blue-50 rounded-lg p-3 border-l-2 border-[#185FA5]"
           style={{ borderRadius: '0 8px 8px 0' }}>
        <p className="text-[11px] text-blue-800 leading-relaxed">{analysis.executiveSummary}</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 flex-wrap">
        {['ALL', 'CRITICAL', 'MAJOR', 'MINOR', 'SUGGESTION'].map((f) => {
          const count = f === 'ALL' ? findings.length
            : findings.filter((x) => x.severity === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors',
                filter === f
                  ? 'bg-[#185FA5] text-white border-[#185FA5]'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {f === 'ALL' ? 'Todos' : f} ({count})
            </button>
          );
        })}
      </div>

      {/* Hallazgos */}
      <div className="space-y-2">
        {filtered.map((f) => <FindingCard key={f.id} finding={f} />)}
        {filtered.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">Sin hallazgos en esta categoría</p>
        )}
      </div>
    </div>
  );
}
