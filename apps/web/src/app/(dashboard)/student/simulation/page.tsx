'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Upload, FileText, X, CheckCircle2, Loader2, Eye, ShieldAlert } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

const PIPELINE_STEPS = [
  'Subiendo archivos en bloque...',
  'Extrayendo textos en paralelo...',
  'Segmentando documentos en chunks...',
  'Generando embeddings vectoriales...',
  'Preparando cola de análisis IA...',
  'Iniciando procesamiento con Copyleaks...',
  'Lote procesado exitosamente',
];

export default function PlagiarismSimulationPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [programId, setProgramId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [advanceType, setAdvanceType] = useState('chapter_1');
  const [pipelineStep, setPipelineStep] = useState(-1);
  const [isDragging, setIsDragging] = useState(false);

  // Fetch student programs
  const { data: programs } = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiClient.get('/programs').then((r) => r.data),
  });

  // Fetch templates for selected program
  const { data: templates } = useQuery({
    queryKey: ['templates', programId],
    queryFn: () => apiClient.get(`/templates/program/${programId}`).then((r) => r.data),
    enabled: !!programId,
  });

  // Fetch student advances (to show past simulations)
  const { data: myAdvances, refetch: refetchHistory } = useQuery({
    queryKey: ['my-advances-simulations'],
    queryFn: () => apiClient.get('/advances/mine').then((r) => r.data),
  });

  const advances = Array.isArray(myAdvances) ? myAdvances : myAdvances?.advances ?? [];
  const simulations = advances.filter((a: any) => a.title?.startsWith('[SIMULACION]'));

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
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
    onSuccess: (data) => {
      toast.success('Simulación cargada con éxito. Análisis en cola iniciado.');
      setFiles([]);
      refetchHistory();
      // Redirect to the first successful upload detail page after a short delay
      const successItem = data?.find((r: any) => r.success);
      setTimeout(() => {
        setPipelineStep(-1);
        if (successItem?.advanceId) {
          router.push(`/advances/${successItem.advanceId}/review`);
        }
      }, 2000);
    },
    onError: (err: any) => {
      setPipelineStep(-1);
      toast.error(err.response?.data?.message ?? 'Error al procesar la simulación');
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
      setFiles((prev) => [...prev, ...validFiles]);
    }
    if (validFiles.length < droppedFiles.length) {
      toast.error('Algunos archivos fueron omitidos. Solo se aceptan PDF o Word (.docx)');
    }
  }, []);

  const handleSubmit = () => {
    if (files.length === 0 || !programId || !templateId) {
      toast.error('Complete todos los campos');
      return;
    }
    const fd = new FormData();
    files.forEach((f) => {
      fd.append('files', f);
    });
    fd.append('programId', programId);
    fd.append('templateId', templateId);
    fd.append('advanceType', advanceType);
    fd.append('isSimulation', 'true'); // <-- Tell backend this is a simulation draft
    uploadMutation.mutate(fd);
  };

  return (
    <div className="p-3 sm:p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-base sm:text-xl font-medium text-gray-900 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-[#185FA5]" />
          Simulador de Plagio y Escritura IA
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Sube tus borradores de tesis para validar plagio con Copyleaks y detectar escritura de IA sin límite. 
          Estos archivos no se enviarán a tu asesor y no cuentan como tu entrega calificada oficial.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Formulario de carga */}
        <div className="lg:col-span-3 space-y-5 bg-white p-5 rounded-xl border border-gray-200">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nueva Simulación</h2>
          
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => files.length === 0 && document.getElementById('file-input')?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
              isDragging ? 'border-[#185FA5] bg-blue-50' : 'border-gray-200 hover:border-gray-300',
              files.length > 0 && 'cursor-default',
            )}
          >
            <input
              id="file-input"
              type="file"
              accept=".pdf,.docx"
              multiple
              className="hidden"
              onChange={(e) => {
                const selected = Array.from(e.target.files ?? []);
                setFiles((prev) => [...prev, ...selected]);
              }}
            />
            {files.length > 0 ? (
              <div className="space-y-2 text-left max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold text-gray-500 mb-2">Archivos seleccionados ({files.length}):</p>
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 bg-gray-50 p-2 rounded-lg border border-gray-150">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText className="w-5 h-5 text-[#185FA5] flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-900 truncate">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-gray-500 font-mono">
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setFiles((prev) => prev.filter((_, i) => i !== idx)); }}
                        className="text-gray-400 hover:text-red-500 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">
                  Arrastra o haz clic para seleccionar borradores
                </p>
                <p className="text-xs text-gray-400 mt-1">Word (.docx) o PDF · puedes subir varios</p>
              </>
            )}
          </div>

          {/* Campos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Programa académico</label>
              <select
                value={programId}
                onChange={(e) => { setProgramId(e.target.value); setTemplateId(''); }}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
              >
                <option value="">Seleccionar...</option>
                {programs?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Documento patrón</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={!programId}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm disabled:opacity-50"
              >
                <option value="">Seleccionar...</option>
                {templates?.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name} v{t.version}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Tipo de entrega</label>
              <select
                value={advanceType}
                onChange={(e) => setAdvanceType(e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
              >
                <option value="chapter_1">CAPITULO I: INTRODUCCIÓN</option>
                <option value="chapter_2">CAPITULO II: MÉTODO</option>
                <option value="chapter_3">CAPITULO III: ASPECTOS ADMINISTRATIVOS</option>
                <option value="full">Avance completo</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={uploadMutation.isPending || files.length === 0 || !programId || !templateId}
            className="w-full h-10 rounded-lg bg-[#185FA5] hover:bg-[#0C447C] text-white
                       text-sm font-medium disabled:opacity-50 transition-colors
                       flex items-center justify-center gap-2"
          >
            {uploadMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {uploadMutation.isPending ? 'Procesando Simulación...' : 'Iniciar Simulación de Plagio'}
          </button>
        </div>

        {/* Pipeline de progreso */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-medium text-gray-700 mb-4">Pipeline de análisis</h3>
            <div className="space-y-3">
              {PIPELINE_STEPS.map((step, i) => {
                const done = pipelineStep > i;
                const active = pipelineStep === i;
                const pending = pipelineStep < i;
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                      done && 'bg-green-100',
                      active && 'bg-blue-100 ring-2 ring-[#185FA5]/30',
                      pending && 'bg-gray-100',
                    )}>
                      {done ? (
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                      ) : active ? (
                        <Loader2 className="w-3 h-3 text-[#185FA5] animate-spin" />
                      ) : (
                        <span className="text-[10px] text-gray-400 font-medium">{i + 1}</span>
                      )}
                    </div>
                    <span className={cn(
                      'text-xs leading-relaxed',
                      done && 'text-green-700',
                      active && 'text-[#185FA5] font-medium',
                      pending && 'text-gray-400',
                    )}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Historial de simulaciones */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-150">
          <h2 className="text-sm font-medium text-gray-900">Mis Simulaciones de Plagio</h2>
        </div>
        {simulations.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            No has realizado ninguna simulación todavía.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {simulations.map((sim: any) => {
              const score = sim.aiAnalysis?.overallScore;
              const similarity = sim.plagiarismReport?.overallSimilarity;
              const cleanTitle = sim.title?.replace('[SIMULACION] ', '');

              return (
                <button
                  key={sim.id}
                  onClick={() => router.push(`/advances/${sim.id}/review`)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{cleanTitle}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {sim.advanceType?.replace('_', ' ')} · {sim.createdAt ? formatDate(sim.createdAt) : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {similarity != null && (
                      <span className={cn(
                        'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                        similarity >= 15 ? 'bg-red-50 text-red-700 border-red-100' :
                        similarity >= 10 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-green-50 text-green-700 border-green-100'
                      )}>
                        Plagio: {similarity.toFixed(0)}%
                      </span>
                    )}
                    {score != null && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                        IA: {score.toFixed(0)}%
                      </span>
                    )}
                    <span className="text-xs text-[#185FA5] hover:underline flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      Ver Reporte
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
