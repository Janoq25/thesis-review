'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Loader2, Eye, XCircle, CheckCircle2 } from 'lucide-react';

interface HumanReviewPanelProps {
  advanceId: string;
  existingReview?: any;
  rubric?: any;
  onSave?: (data: any) => void;
  isSaving?: boolean;
  disabled?: boolean;
}

const MAX_GRADE = Number(process.env.NEXT_PUBLIC_MAX_GRADE ?? 20);

export function HumanReviewPanel({
  advanceId,
  existingReview,
  rubric,
  onSave,
  isSaving = false,
  disabled = false,
}: HumanReviewPanelProps) {
  const qc = useQueryClient();
  const [finalGrade, setFinalGrade] = useState<number>(
    existingReview?.finalGrade ?? MAX_GRADE * 0.7,
  );
  const [comment, setComment] = useState(existingReview?.humanComment ?? '');
  const [rubricAnswers, setRubricAnswers] = useState<Record<string, boolean>>(
    existingReview?.rubricAnswers ?? {},
  );
  const saveMutation = useMutation({
    mutationFn: (body: any) => apiClient.post(`/reviews/${advanceId}`, body),
    onSuccess: () => {
      toast.success('Revisión guardada');
      qc.invalidateQueries({ queryKey: ['advance-review', advanceId] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Error al guardar'),
  });

  const isPending = isSaving || saveMutation.isPending;
  const isReadOnly = disabled || ['APPROVED', 'REJECTED'].includes(existingReview?.status);

  const rubricItems = rubric?.dimensions?.length > 0
    ? rubric.dimensions.map((d: any) => ({ key: d.name, label: d.name }))
    : [
        { key: 'structure', label: 'Estructura acorde al patrón' },
        { key: 'objectives', label: 'Objetivos claros y medibles' },
        { key: 'framework', label: 'Marco conceptual completo' },
        { key: 'citations', label: 'Formato APA correcto' },
        { key: 'writing', label: 'Redacción académica adecuada' },
        { key: 'methodology', label: 'Metodología justificada' },
        { key: 'coherence', label: 'Coherencia entre secciones' },
      ];

  const handleSave = (status: 'OBSERVED' | 'APPROVED' | 'REJECTED') => {
    const data = { finalGrade, humanComment: comment, rubricAnswers, status };
    if (onSave) onSave(data);
    else saveMutation.mutate(data);
  };

  return (
    <div className="space-y-5">
      {/* Ajuste de nota */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-700">Nota final</label>
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-medium text-gray-900">{finalGrade.toFixed(1)}</span>
            <span className="text-sm text-gray-400">/ {MAX_GRADE}</span>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={MAX_GRADE}
          step={0.5}
          value={finalGrade}
          onChange={(e) => setFinalGrade(Number(e.target.value))}
          className="w-full accent-[#185FA5]"
          disabled={isReadOnly}
        />
        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
          <span>0</span>
          <span className="text-amber-600 font-medium">
            {(MAX_GRADE * 0.65).toFixed(0)} (mínimo aprobatorio)
          </span>
          <span>{MAX_GRADE}</span>
        </div>
      </div>

      {/* Rúbrica */}
      <div>
        <p className="text-xs font-medium text-gray-700 mb-2.5">Rúbrica de evaluación</p>
        <div className="space-y-2">
          {rubricItems.map((item: { key: string; label: string }) => (
            <label
              key={item.key}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={rubricAnswers[item.key] ?? false}
                onChange={(e) =>
                  setRubricAnswers((prev) => ({ ...prev, [item.key]: e.target.checked }))
                }
                className="rounded border-gray-300 text-[#185FA5] accent-[#185FA5]"
                disabled={isReadOnly}
              />
              <span className="text-xs text-gray-700 group-hover:text-gray-900">
                {item.label}
              </span>
            </label>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">
          {Object.values(rubricAnswers).filter(Boolean).length} / {rubricItems.length} criterios cumplidos
        </p>
      </div>

      {/* Comentario */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">
          Comentario para el estudiante
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Escriba sus observaciones y recomendaciones de mejora..."
          className="w-full h-28 text-xs p-2.5 border border-gray-200 rounded-lg resize-none
                     focus:outline-none focus:ring-1 focus:ring-[#185FA5] focus:border-[#185FA5]"
          disabled={isReadOnly}
        />
        <p className="text-[10px] text-gray-400 text-right mt-0.5">
          {comment.length} caracteres
        </p>
      </div>

      {/* Botones */}
      {isReadOnly ? (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700">
          La revisión de este avance ha finalizado.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleSave('OBSERVED')}
            disabled={isPending}
            className="h-9 px-2 rounded-lg border border-amber-200 text-amber-700 text-xs
                       font-medium hover:bg-amber-50 transition-colors flex items-center justify-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" />
            Observar
          </button>
          <button
            onClick={() => handleSave('REJECTED')}
            disabled={isPending}
            className="h-9 px-2 rounded-lg border border-red-200 text-red-700 dark:text-red-400 text-xs
                       font-medium hover:bg-red-50 dark:hover:bg-red-950 transition-colors flex items-center justify-center gap-1"
          >
            <XCircle className="w-3.5 h-3.5" />
            Rechazar
          </button>
          <button
            onClick={() => handleSave('APPROVED')}
            disabled={isPending}
            className="h-9 px-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs
                       font-medium transition-colors flex items-center justify-center gap-1"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Aprobar
          </button>
        </div>
      )}

      {/* Historial */}
      {existingReview && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-[10px] font-medium text-gray-500 mb-1">Última revisión</p>
          <p className="text-[11px] text-gray-600">
            {existingReview.reviewer?.name} ·{' '}
            {new Date(existingReview.reviewedAt).toLocaleDateString('es-PE')}
          </p>
        </div>
      )}
    </div>
  );
}
