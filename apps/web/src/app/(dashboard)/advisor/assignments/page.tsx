'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Calendar, Trash2, Edit, Plus, X, Layers, Clock, FileText } from 'lucide-react';
import { formatDayMonth } from '@/lib/utils';
import { toast } from 'sonner';

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
  } | null;
  _count: {
    advances: number;
  };
}

export default function AdvisorAssignmentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [programId, setProgramId] = useState('');
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    startDate: '',
    deadlineDate: '',
    templateId: '',
    advanceType: 'chapter_1',
  });

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

  const { data: assignments, isLoading } = useQuery<Assignment[]>({
    queryKey: ['advisor-assignments'],
    queryFn: () => apiClient.get('/assignments/advisor').then((r) => r.data),
  });

  const { data: templates } = useQuery<any[]>({
    queryKey: ['templates', programId],
    queryFn: () => apiClient.get(`/templates/program/${programId}`).then((r) => r.data),
    enabled: !!programId,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiClient.post('/assignments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advisor-assignments'] });
      setIsModalOpen(false);
      resetForm();
      toast.success('Tarea creada correctamente.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Error al crear la tarea');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof form & { id: string }) =>
      apiClient.patch(`/assignments/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advisor-assignments'] });
      setIsModalOpen(false);
      resetForm();
      toast.success('Tarea actualizada correctamente.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Error al actualizar la tarea');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/assignments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advisor-assignments'] });
      toast.success('Tarea eliminada correctamente.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message ?? 'Error al eliminar la tarea');
    },
  });

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      startDate: '',
      deadlineDate: '',
      templateId: templates?.[0]?.id || '',
      advanceType: 'chapter_1',
    });
    setEditingAssignment(null);
  };

  // Set default template once loaded
  useEffect(() => {
    if (templates && templates.length > 0 && !form.templateId && !editingAssignment) {
      setForm((prev) => ({ ...prev, templateId: templates[0].id }));
    }
  }, [templates, form.templateId, editingAssignment]);

  const handleEdit = (e: React.MouseEvent, assignment: Assignment) => {
    e.stopPropagation();
    setEditingAssignment(assignment);
    setForm({
      title: assignment.title,
      description: assignment.description || '',
      startDate: assignment.startDate ? new Date(assignment.startDate).toISOString().split('T')[0] : '',
      deadlineDate: assignment.deadlineDate ? new Date(assignment.deadlineDate).toISOString().split('T')[0] : '',
      templateId: assignment.templateId || '',
      advanceType: assignment.advanceType || 'chapter_1',
    });
    setIsModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('¿Estás seguro de que deseas eliminar esta tarea? Esto eliminará todos los avances oficiales de tus estudiantes.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAssignment) {
      updateMutation.mutate({ id: editingAssignment.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-950 dark:text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-[#185FA5]" />
            Tareas Asignadas
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configura y administra las tareas, plazos y documentos patrón de tesis de tus estudiantes.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="h-9 px-4 rounded-lg bg-[#185FA5] text-white text-sm font-medium hover:bg-[#0C447C] transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Nueva Tarea
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20 text-gray-500">Cargando tareas...</div>
      ) : assignments?.length === 0 ? (
        <div className="border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center space-y-3">
          <Layers className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto" />
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">No hay tareas creadas</div>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Crea tu primera tarea para que tus estudiantes asesorados puedan empezar a enviar sus borradores de tesis y reportes de plagio.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignments?.map((assignment) => {
            const hasStarted = !assignment.startDate || new Date(assignment.startDate) <= new Date();
            const hasPassed = assignment.deadlineDate && new Date(assignment.deadlineDate) < new Date();
            return (
              <div
                key={assignment.id}
                onClick={() => router.push(`/advisor/assignments/${assignment.id}`)}
                className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5 shadow-sm 
                           hover:border-[#185FA5]/30 cursor-pointer transition-all flex flex-col justify-between group"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-medium text-gray-950 dark:text-white leading-tight group-hover:text-[#185FA5] transition-colors">
                      {assignment.title}
                    </h3>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleEdit(e, assignment)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        title="Editar tarea"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, assignment.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-red-500 transition-colors"
                        title="Eliminar tarea"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3">
                    {assignment.description || 'Sin descripción.'}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1 text-[10px]">
                    {assignment.template && (
                      <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                        <FileText className="w-3 h-3" />
                        {assignment.template.name}
                      </span>
                    )}
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono uppercase">
                      {assignment.advanceType === 'full' ? 'Tesis Completa' : `Capítulo ${assignment.advanceType.replace('chapter_', '')}`}
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-50 dark:border-gray-800/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                  <div className="flex flex-col gap-1 text-gray-500 dark:text-gray-400">
                    {assignment.startDate && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>Inicio: </span>
                        <span className={hasStarted ? 'text-gray-900 dark:text-gray-100' : 'text-amber-600 font-medium'}>
                          {formatDayMonth(assignment.startDate)} {!hasStarted && '(Pendiente)'}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>Plazo: </span>
                      {assignment.deadlineDate ? (
                        <span className={hasPassed ? 'text-red-500 font-medium' : 'text-gray-900 dark:text-gray-100'}>
                          {formatDayMonth(assignment.deadlineDate)}
                        </span>
                      ) : (
                        <span className="text-gray-400">Sin límite</span>
                      )}
                    </div>
                  </div>

                  <span className="self-end sm:self-center px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium">
                    {assignment._count.advances} entregas
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* modal de formulario */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingAssignment ? 'Editar Tarea' : 'Nueva Tarea'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Título de la Tarea</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 1er Avance Capítulo I"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Descripción / Instrucciones</label>
                <textarea
                  placeholder="Detalles sobre qué entregar..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Fecha de Inicio</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Fecha Límite</label>
                  <input
                    type="date"
                    value={form.deadlineDate}
                    onChange={(e) => setForm({ ...form, deadlineDate: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Documento Patrón (Plantilla)</label>
                  <select
                    required
                    value={form.templateId}
                    onChange={(e) => setForm({ ...form, templateId: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
                  >
                    <option value="" disabled>Seleccionar patrón...</option>
                    {templates?.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Estructura</label>
                  <select
                    required
                    value={form.advanceType}
                    onChange={(e) => setForm({ ...form, advanceType: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
                  >
                    <option value="chapter_1">Capítulo I</option>
                    <option value="chapter_2">Capítulo II</option>
                    <option value="chapter_3">Capítulo III</option>
                    <option value="full">Tesis Completa</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-10 px-4 rounded-lg border border-gray-200 dark:border-gray-800 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="h-10 px-4 rounded-lg bg-[#185FA5] text-white text-sm font-medium hover:bg-[#0C447C] transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar Tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
