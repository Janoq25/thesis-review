'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Upload, FileText, X, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const PIPELINE_STEPS = [
  'Subiendo archivo...',
  'Extrayendo texto (mammoth.js / pdf-parse)...',
  'Segmentando en chunks (LangChain.js)...',
  'Generando embeddings (text-embedding-3-large)...',
  'Comparando con documento patrón...',
  'Analizando con GPT-4o...',
  'Guardando hallazgos...',
  'Análisis completado',
];

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [programId, setProgramId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [advanceType, setAdvanceType] = useState('chapter_1');
  const [pipelineStep, setPipelineStep] = useState(-1);
  const [isDragging, setIsDragging] = useState(false);

  const { data: programs } = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiClient.get('/programs').then((r) => r.data),
  });

  const { data: templates } = useQuery({
    queryKey: ['templates', programId],
    queryFn: () => apiClient.get(`/templates/program/${programId}`).then((r) => r.data),
    enabled: !!programId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      // Simular progreso del pipeline
      let step = 0;
      const interval = setInterval(() => {
        if (step < PIPELINE_STEPS.length - 2) {
          setPipelineStep(step++);
        }
      }, 1200);

      try {
        const result = await apiClient.post('/advances', formData, {
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
      toast.success('Avance cargado. Análisis IA iniciado en background.');
      setTimeout(() => router.push(`/advances/${data.id}/review`), 1500);
    },
    onError: (err: any) => {
      setPipelineStep(-1);
      toast.error(err.response?.data?.message ?? 'Error al subir el archivo');
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.type.includes('pdf') || dropped.name.endsWith('.docx'))) {
      setFile(dropped);
    } else {
      toast.error('Solo se aceptan archivos PDF o Word (.docx)');
    }
  }, []);

  const handleSubmit = () => {
    if (!file || !programId || !templateId) {
      toast.error('Complete todos los campos');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('programId', programId);
    fd.append('templateId', templateId);
    fd.append('advanceType', advanceType);
    uploadMutation.mutate(fd);
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-medium text-gray-900">Cargar nuevo avance</h1>
        <p className="text-sm text-gray-500 mt-1">
          El análisis IA se inicia automáticamente al subir el documento.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Formulario */}
        <div className="lg:col-span-3 space-y-5">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !file && document.getElementById('file-input')?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
              isDragging ? 'border-[#185FA5] bg-blue-50' : 'border-gray-200 hover:border-gray-300',
              file && 'cursor-default',
            )}
          >
            <input
              id="file-input"
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-8 h-8 text-[#185FA5]" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="text-gray-400 hover:text-red-500 ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">
                  Arrastra o haz clic para seleccionar
                </p>
                <p className="text-xs text-gray-400 mt-1">Word (.docx) o PDF · máx. 50 MB</p>
              </>
            )}
          </div>

          {/* Campos */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Programa académico</label>
            <select
              value={programId}
              onChange={(e) => { setProgramId(e.target.value); setTemplateId(''); }}
              className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
            >
              <option value="">Seleccionar programa...</option>
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
              <option value="">Seleccionar patrón...</option>
              {templates?.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name} v{t.version} {t.isActive ? '(vigente)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Tipo de avance</label>
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

          <button
            onClick={handleSubmit}
            disabled={uploadMutation.isPending || !file || !programId || !templateId}
            className="w-full h-10 rounded-lg bg-[#185FA5] hover:bg-[#0C447C] text-white
                       text-sm font-medium disabled:opacity-50 transition-colors
                       flex items-center justify-center gap-2"
          >
            {uploadMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {uploadMutation.isPending ? 'Procesando...' : 'Subir y analizar con IA'}
          </button>
        </div>

        {/* Pipeline progress */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-medium text-gray-700 mb-4">Pipeline de análisis IA</h3>
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
    </div>
  );
}
