'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { 
  Upload, FileText, Plus, Loader2, Trash2, 
  CheckCircle2, AlertCircle, Calendar, Tag
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [programId, setProgramId] = useState('');
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');

  // 1. Obtener programas
  const { data: programs } = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiClient.get('/programs').then((r) => r.data),
  });

  // 2. Obtener templates del programa seleccionado
  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['templates', programId],
    queryFn: () => apiClient.get(`/templates/program/${programId}`).then((r) => r.data),
    enabled: !!programId,
  });

  // 3. Mutación para subir
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiClient.post('/templates', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      toast.success('Documento patrón subido y procesado por la IA');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Error al subir el patrón');
    },
  });

  // 4. Mutación para eliminar
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/templates/${id}`),
    onSuccess: () => {
      toast.success('Template eliminado');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'No se pudo eliminar el template');
    },
  });

  const resetForm = () => {
    setFile(null);
    setName('');
    setVersion('');
    setIsUploading(false);
  };

  const handleUpload = () => {
    if (!file || !programId || !name || !version) {
      toast.error('Complete todos los campos');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('programId', programId);
    fd.append('name', name);
    fd.append('version', version);
    uploadMutation.mutate(fd);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Documentos Patrón</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona los documentos de referencia que la IA usará para evaluar las tesis.
          </p>
        </div>
        {!isUploading && (
          <button
            onClick={() => setIsUploading(true)}
            className="h-9 px-4 rounded-lg bg-[#185FA5] text-white text-sm font-medium
                       hover:bg-[#0C447C] transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo Patrón
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selector de Programa */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Filtrar por Programa Académico
            </label>
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm focus:ring-2 focus:ring-[#185FA5]/20 focus:outline-none"
            >
              <option value="">Seleccionar programa...</option>
              {programs?.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {isUploading && (
            <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-[#185FA5]">Subir Nuevo Patrón</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nombre del Patrón</label>
                  <input
                    type="text"
                    placeholder="Ej. Estructura Tesis Pregrado"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-9 rounded-lg border border-gray-200 px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Versión</label>
                  <input
                    type="text"
                    placeholder="Ej. 2024-I"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-full h-9 rounded-lg border border-gray-200 px-3 text-sm"
                  />
                </div>

                <div 
                  className={cn(
                    "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer",
                    file ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"
                  )}
                  onClick={() => document.getElementById('template-file')?.click()}
                >
                  <input 
                    id="template-file"
                    type="file" 
                    className="hidden" 
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  {file ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-medium text-green-700 truncate max-w-[150px]">{file.name}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="w-5 h-5 text-gray-400 mb-1" />
                      <span className="text-[10px] text-gray-500 font-medium">Click para subir PDF/DOCX</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleUpload}
                  disabled={uploadMutation.isPending || !file || !name || !version || !programId}
                  className="flex-1 h-9 rounded-lg bg-[#185FA5] text-white text-xs font-bold disabled:opacity-50"
                >
                  {uploadMutation.isPending ? 'Procesando...' : 'Guardar'}
                </button>
                <button
                  onClick={resetForm}
                  className="px-3 h-9 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 bg-white"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lista de Templates */}
        <div className="lg:col-span-2">
          {!programId ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Selecciona un programa para ver sus documentos patrón.</p>
            </div>
          ) : loadingTemplates ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#185FA5] animate-spin" />
            </div>
          ) : templates?.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No hay documentos patrón registrados para este programa.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {templates?.map((t: any) => (
                <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      t.isActive ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-400"
                    )}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        {t.name}
                        {t.isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold uppercase">
                            Vigente
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1 text-[11px] text-gray-500">
                          <Tag className="w-3 h-3" /> v{t.version}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-gray-500">
                          <Calendar className="w-3 h-3" /> {formatDate(t.createdAt)}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-gray-500">
                          <CheckCircle2 className="w-3 h-3" /> {t._count.advances} avances evaluados
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (confirm('¿Estás seguro de eliminar este documento patrón?')) {
                          deleteMutation.mutate(t.id);
                        }
                      }}
                      disabled={t.isActive || t._count.advances > 0}
                      className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                      title={t.isActive ? "No se puede eliminar el patrón vigente" : t._count.advances > 0 ? "No se puede eliminar un patrón con avances asociados" : "Eliminar"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
