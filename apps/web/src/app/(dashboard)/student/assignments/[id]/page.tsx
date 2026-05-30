'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  Upload, FileText, X, CheckCircle2, Loader2,
  Clock, AlertTriangle, ShieldCheck, ArrowLeft, ExternalLink, FileSearch
} from 'lucide-react';
import { cn, formatDayMonthYear, formatDateTime, formatShortDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useStatusConfig } from '@/lib/i18n/use-status-config';

interface Advance {
  id: string;
  title: string;
  isSimulation: boolean;
  status: string;
  createdAt: string;
  fileType: string;
  version: number;
  aiAnalysis?: {
    overallScore: number;
  } | null;
  plagiarismReport?: {
    overallSimilarity: number;
    status: string;
  } | null;
  review?: {
    finalGrade: number | null;
    status: string;
  } | null;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  startDate: string | null;
  deadlineDate: string | null;
  isActive: boolean;
  createdAt: string;
  templateId: string | null;
  advanceType: string;
  template?: {
    name: string;
    version: string;
    programId: string;
  } | null;
  advances: Advance[];
}

const PIPELINE_STEPS = [
  'Subiendo archivos al servidor...',
  'Extrayendo textos en paralelo...',
  'Segmentando documentos en chunks...',
  'Generando embeddings vectoriales...',
  'Preparando cola de análisis IA...',
  'Iniciando procesamiento secuencial con GPT-4o...',
  'Documento procesado exitosamente',
];

export default function StudentAssignmentDetailsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const queryClient = useQueryClient();
  const { config: STATUS_CONFIG } = useStatusConfig();

  const [programId, setProgramId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSimUpload, setIsSimUpload] = useState(false); // To separate upload buttons
  const [pipelineStep, setPipelineStep] = useState(-1);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user.programId) {
          setProgramId(user.programId);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const { data: assignment, isLoading: loadingAssignment } = useQuery<Assignment>({
    queryKey: ['assignment', id],
    queryFn: () => apiClient.get(`/assignments/${id}`).then((r) => r.data),
  });

  // Query student advances for this assignment to split simulations and official
  const { data: assignmentAdvances, isLoading: loadingAdvances } = useQuery<Advance[]>({
    queryKey: ['assignment-advances', id],
    queryFn: () => apiClient.get('/advances/mine').then((r) => {
      const allAdvances = Array.isArray(r.data) ? r.data : r.data?.advances ?? [];
      return allAdvances.filter((a: any) => a.assignmentId === id);
    }),
  });



  const uploadMutation = useMutation({
    mutationFn: async ({ formData }: { formData: FormData; isSimulation: boolean }) => {
      let step = 0;
      const interval = setInterval(() => {
        if (step < PIPELINE_STEPS.length - 2) {
          setPipelineStep(step++);
        }
      }, 1500);

      try {
        const result = await apiClient.post('/advances/bulk', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        clearInterval(interval);
        setPipelineStep(PIPELINE_STEPS.length - 1);
        return result.data;
      } catch (err) {
        clearInterval(interval);
        throw err;
      }
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.isSimulation
          ? 'Borrador cargado con éxito en el simulador. Análisis en cola.'
          : 'Entrega oficial guardada correctamente para revisión.'
      );
      setFiles([]);
      setPipelineStep(-1);
      queryClient.invalidateQueries({ queryKey: ['assignment', id] });
      queryClient.invalidateQueries({ queryKey: ['assignment-advances', id] });
      queryClient.invalidateQueries({ queryKey: ['student-assignments'] });
    },
    onError: (err: any) => {
      setPipelineStep(-1);
      toast.error(err.response?.data?.message ?? 'Error al subir el archivo');
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter(
      (f) => f.type.includes('pdf') || f.name.endsWith('.docx')
    );
    if (validFiles.length > 0) {
      setFiles(validFiles); // Only allow 1 file at a time
    }
    if (validFiles.length < droppedFiles.length) {
      toast.error('Solo se aceptan archivos PDF o Word (.docx)');
    }
  }, []);

  const handleUpload = (isSimulation: boolean) => {
    if (files.length === 0) {
      toast.error('Seleccione un archivo');
      return;
    }

    const fd = new FormData();
    fd.append('files', files[0]); // Upload first selected file
    fd.append('assignmentId', id);
    fd.append('isSimulation', isSimulation ? 'true' : 'false');

    // Inherit configuration from the assignment definition
    if (assignment) {
      if (assignment.templateId) {
        fd.append('templateId', assignment.templateId);
      }
      if (assignment.advanceType) {
        fd.append('advanceType', assignment.advanceType);
      }
      if (assignment.template?.programId) {
        fd.append('programId', assignment.template.programId);
      } else if (programId) {
        fd.append('programId', programId);
      }
    }

    setIsSimUpload(isSimulation);
    uploadMutation.mutate({ formData: fd, isSimulation });
  };

  if (loadingAssignment || loadingAdvances) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!assignment) {
    return <div className="p-8 text-center text-gray-500">Tarea no encontrada.</div>;
  }

  const officialSubmission = assignmentAdvances?.find((a) => !a.isSimulation);
  const simulations = assignmentAdvances?.filter((a) => a.isSimulation) || [];

  const deadlineDate = assignment.deadlineDate ? new Date(assignment.deadlineDate) : null;
  const isDeadlinePassed = deadlineDate ? new Date() > deadlineDate : false;

  const statusCfg = officialSubmission
    ? (STATUS_CONFIG[officialSubmission.status] ?? STATUS_CONFIG.PENDING)
    : { label: 'Sin entregar', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Botón Volver */}
      <button
        onClick={() => router.push('/student/dashboard')}
        className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1.5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver a mis tareas
      </button>

      {/* Cabecera de la Tarea */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-gray-950 dark:text-white">{assignment.title}</h1>
            <p className="text-xs text-gray-400">Creado por Dr(a). {assignment.createdAt ? formatDayMonthYear(assignment.createdAt) : ''}</p>
          </div>
          <div className="flex flex-col sm:items-end gap-1">
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Estado</span>
            <Badge className={cn('text-xs border-0 px-2.5 py-1', statusCfg.className)}>
              {statusCfg.label}
            </Badge>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
          {assignment.description || 'Sin instrucciones adicionales del asesor.'}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-50 dark:border-gray-800/50 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-gray-400" />
            <span>Fecha Límite:</span>
            {assignment.deadlineDate ? (
              <span className={cn(isDeadlinePassed && !officialSubmission ? 'text-red-500 font-semibold' : 'text-gray-900 dark:text-gray-200')}>
                {formatDateTime(assignment.deadlineDate)}
              </span>
            ) : (
              <span className="text-gray-400">Sin límite</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Entrega Oficial & Subida */}
        <div className="lg:col-span-2 space-y-6">
          {/* SECCIÓN 1: ENTREGA OFICIAL */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Entrega Oficial para Calificación
            </h2>

            {officialSubmission ? (
              <div className="p-4 bg-green-50/20 dark:bg-green-950/10 border border-green-100/50 dark:border-green-900/30 rounded-xl space-y-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-8 h-8 text-green-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">{officialSubmission.title}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Versión {officialSubmission.version} · Subido el {formatDateTime(officialSubmission.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/advances/${officialSubmission.id}/review`)}
                    className="h-8 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    Ver Detalles
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                {officialSubmission.plagiarismReport && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Plagio:</span>
                    <span className={cn(
                      'font-medium px-2 py-0.5 rounded-full',
                      officialSubmission.plagiarismReport.overallSimilarity >= 15
                        ? 'bg-red-50 text-red-700'
                        : 'bg-green-50 text-green-700'
                    )}>
                      {officialSubmission.plagiarismReport.overallSimilarity.toFixed(0)}% de similitud
                    </span>
                  </div>
                )}

                {/* Calificación del Asesor */}
                <div className="pt-2.5 border-t border-gray-100 dark:border-gray-800/60 flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Calificación del Asesor:</span>
                  {officialSubmission.review?.finalGrade != null ? (
                    <span className="font-semibold px-2.5 py-0.5 rounded-full text-xs bg-green-50 text-green-750 border border-green-100">
                      {officialSubmission.review.finalGrade.toFixed(0)} / 20
                    </span>
                  ) : (
                    <span className="font-medium px-2.5 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-100">
                      Pendiente de revisión
                    </span>
                  )}
                </div>
              </div>
            ) : isDeadlinePassed ? (
              <div className="p-4 bg-red-50 border border-red-100 text-red-800 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                La fecha límite para realizar esta entrega ha expirado. No puedes subir tu avance oficial.
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-gray-400">
                  Esta será la entrega formal que calificará tu asesor. Solo puedes realizar un envío oficial para esta tarea.
                </p>

                {/* Subida de archivo */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => files.length === 0 && document.getElementById('official-file-input')?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
                    isDragging ? 'border-[#185FA5] bg-blue-50' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700',
                    files.length > 0 && 'cursor-default'
                  )}
                >
                  <input
                    id="official-file-input"
                    type="file"
                    accept=".pdf,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const selected = Array.from(e.target.files ?? []);
                      setFiles(selected);
                    }}
                  />
                  {files.length > 0 ? (
                    <div className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-150 shadow-sm max-w-md mx-auto">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className="w-5 h-5 text-[#185FA5] flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-900 dark:text-white truncate">{files[0].name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-mono">
                          {(files[0].size / 1024 / 1024).toFixed(1)} MB
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setFiles([]); }}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Arrastra o haz clic para seleccionar tu avance oficial
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Word (.docx) o PDF · 1 solo archivo</p>
                    </>
                  )}
                </div>

                <button
                  onClick={() => handleUpload(false)}
                  disabled={uploadMutation.isPending || files.length === 0}
                  className="w-full h-10 rounded-lg bg-[#185FA5] hover:bg-[#0C447C] text-white text-sm font-medium
                             disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {uploadMutation.isPending && !isSimUpload && <Loader2 className="w-4 h-4 animate-spin" />}
                  {uploadMutation.isPending && !isSimUpload ? 'Enviando entrega oficial...' : 'Realizar entrega oficial para calificación'}
                </button>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: SIMULADOR DE PLAGIO */}
          {officialSubmission ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-gray-400 dark:text-gray-500 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-gray-300" />
                Simulador de Plagio (Bloqueado)
              </h2>
              <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl text-xs text-gray-500 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                La entrega oficial ya ha sido completada. Las simulaciones de plagio preliminares están deshabilitadas.
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                Simulador de Plagio e Inteligencia Artificial
              </h2>
              <p className="text-xs text-gray-400">
                Sube tus borradores preliminares aquí para enviarlos a **Copyleaks**. Puedes hacer esto las veces que necesites antes de hacer el envío oficial para ir reduciendo tu porcentaje de plagio.
              </p>

              {/* Formulario de subida rápido de Simulación */}
              <div className="space-y-4 pt-2">
                {files.length > 0 && (
                  <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 p-2.5 rounded-lg border border-gray-250 flex items-center justify-between">
                    <span>Archivo cargado en memoria listo para simulación: <strong>{files[0].name}</strong></span>
                    <button onClick={() => setFiles([])} className="text-red-500">Remover</button>
                  </div>
                )}

                {files.length === 0 && (
                  <div className="flex justify-center">
                    <button
                      onClick={() => document.getElementById('official-file-input')?.click()}
                      className="h-9 px-4 rounded-lg border border-[#185FA5]/30 text-[#185FA5] text-xs font-medium hover:bg-blue-50/50 transition-colors"
                    >
                      Seleccionar borrador para simular
                    </button>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => handleUpload(true)}
                    disabled={uploadMutation.isPending || files.length === 0}
                    className="w-full h-10 rounded-lg bg-gray-950 dark:bg-gray-100 dark:text-gray-900 text-white text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    {uploadMutation.isPending && isSimUpload && <Loader2 className="w-4 h-4 animate-spin" />}
                    {uploadMutation.isPending && isSimUpload ? 'Enviando a Copyleaks...' : 'Iniciar Simulación de Plagio'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Columna Derecha: Pipeline & Historial de Simulaciones */}
        <div className="space-y-6">
          {/* Pipeline de progreso */}
          {uploadMutation.isPending && (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Progreso del Pipeline</h3>
              <div className="space-y-3">
                {PIPELINE_STEPS.map((step, i) => {
                  const done = pipelineStep > i;
                  const active = pipelineStep === i;
                  const pending = pipelineStep < i;
                  return (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-medium',
                        done && 'bg-green-100 text-green-700',
                        active && 'bg-blue-100 text-blue-700 ring-2 ring-blue-500/20 animate-pulse',
                        pending && 'bg-gray-100 text-gray-400'
                      )}>
                        {done ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : i + 1}
                      </div>
                      <span className={cn(
                        'text-xs leading-relaxed',
                        done && 'text-green-700 font-medium',
                        active && 'text-[#185FA5] font-semibold',
                        pending && 'text-gray-400'
                      )}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Historial de Simulaciones */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Historial de Simulaciones</h3>

            {simulations.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">No has realizado ninguna simulación en esta tarea aún.</p>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-96 pr-1">
                {simulations.map((sim) => {
                  const simPct = sim.plagiarismReport?.overallSimilarity;
                  return (
                    <div key={sim.id} className="border border-gray-100 dark:border-gray-800 rounded-xl p-3 bg-gray-50/30 dark:bg-gray-950/20 space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{sim.title}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{formatShortDateTime(sim.createdAt)}</p>
                        </div>
                        <button
                          onClick={() => router.push(`/advances/${sim.id}/review`)}
                          className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex-shrink-0"
                          title="Ver reporte de plagio"
                        >
                          <FileSearch className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-50 dark:border-gray-850">
                        <span className="text-[10px] text-gray-400">Plagio:</span>
                        {sim.plagiarismReport ? (
                          <span className={cn(
                            'font-semibold px-2 py-0.5 rounded-full text-[10px] border',
                            simPct != null && simPct >= 15
                              ? 'bg-red-50 text-red-700 border-red-100'
                              : 'bg-green-50 text-green-700 border-green-100'
                          )}>
                            {simPct != null ? `${simPct.toFixed(0)}%` : 'Calculando...'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-blue-500 font-medium animate-pulse">Escaneando...</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
