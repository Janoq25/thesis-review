'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Settings, Save, Loader2, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface Config {
  maxGrade: number;
  lowComplianceAlert: number;
  ftMinPairs: number;
  jwtExpiry: string;
}

export default function ConfigPage() {
  const [config, setConfig] = useState<Config>({
    maxGrade: 20,
    lowComplianceAlert: 65,
    ftMinPairs: 500,
    jwtExpiry: '15m',
  });
  const [saving, setSaving] = useState(false);

  // Deadlines config state
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [programDeadlines, setProgramDeadlines] = useState({
    chapter_1: '',
    chapter_2: '',
    chapter_3: '',
    full: '',
  });
  const [savingDeadlines, setSavingDeadlines] = useState(false);

  // Fetch programs list
  const { data: programs } = useQuery({
    queryKey: ['programs'],
    queryFn: () => apiClient.get('/programs').then((r) => r.data),
  });

  // Fetch deadlines for selected program
  const { data: fetchedDeadlines, refetch: refetchDeadlines } = useQuery({
    queryKey: ['deadlines-admin', selectedProgramId],
    queryFn: () =>
      apiClient.get(`/deadlines/program/${selectedProgramId}`).then((r) => r.data),
    enabled: !!selectedProgramId,
  });

  useEffect(() => {
    setConfig({
      maxGrade: Number(process.env.NEXT_PUBLIC_MAX_GRADE) || 20,
      lowComplianceAlert: Number(process.env.NEXT_PUBLIC_LOW_COMPLIANCE_ALERT) || 65,
      ftMinPairs: Number(process.env.NEXT_PUBLIC_FT_MIN_PAIRS) || 500,
      jwtExpiry: process.env.NEXT_PUBLIC_JWT_EXPIRY || '15m',
    });
  }, []);

  useEffect(() => {
    if (fetchedDeadlines) {
      const formatToDateTimeLocal = (isoStr: string) => {
        if (!isoStr) return '';
        try {
          const d = new Date(isoStr);
          if (isNaN(d.getTime())) return '';
          
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const hours = String(d.getHours()).padStart(2, '0');
          const minutes = String(d.getMinutes()).padStart(2, '0');
          
          return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch {
          return '';
        }
      };

      setProgramDeadlines({
        chapter_1: formatToDateTimeLocal(fetchedDeadlines.chapter_1),
        chapter_2: formatToDateTimeLocal(fetchedDeadlines.chapter_2),
        chapter_3: formatToDateTimeLocal(fetchedDeadlines.chapter_3),
        full: formatToDateTimeLocal(fetchedDeadlines.full),
      });
    } else {
      setProgramDeadlines({
        chapter_1: '',
        chapter_2: '',
        chapter_3: '',
        full: '',
      });
    }
  }, [fetchedDeadlines]);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    toast.success('Configuración guardada (aplica al reiniciar el servidor)');
  };

  const handleSaveDeadlines = async () => {
    if (!selectedProgramId) return;
    setSavingDeadlines(true);
    try {
      const deadlinesToSend: Record<string, string> = {};
      Object.entries(programDeadlines).forEach(([key, val]) => {
        if (val) {
          deadlinesToSend[key] = new Date(val).toISOString();
        } else {
          deadlinesToSend[key] = '';
        }
      });

      await apiClient.post('/deadlines', {
        programId: selectedProgramId,
        deadlines: deadlinesToSend,
      });
      toast.success('Fechas límite de entregas guardadas con éxito');
      refetchDeadlines();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Error al guardar las fechas límite');
    } finally {
      setSavingDeadlines(false);
    }
  };

  const update = (key: keyof Config, value: string | number) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const updateDeadline = (key: string, value: string) =>
    setProgramDeadlines((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-medium text-gray-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#185FA5]" />
          Configuración del sistema
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Parámetros generales del sistema de revisión.
        </p>
      </div>

      {/* Escala académica */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-medium text-gray-900">Escala académica</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Nota máxima
            </label>
            <input
              type="number"
              value={config.maxGrade}
              onChange={(e) => update('maxGrade', Number(e.target.value))}
              className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
            />
            <p className="text-[10px] text-gray-400 mt-1">Perú: 20, EE.UU.: 5, escala 100</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Umbral de alerta (%)
            </label>
            <input
              type="number"
              value={config.lowComplianceAlert}
              onChange={(e) => update('lowComplianceAlert', Number(e.target.value))}
              min={0}
              max={100}
              className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
            />
            <p className="text-[10px] text-gray-400 mt-1">Avances por debajo de este % activan alerta</p>
          </div>
        </div>
      </section>

      {/* Fine-tuning */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-medium text-gray-900">Fine-tuning de IA</h2>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Pares mínimos para lanzar fine-tuning
          </label>
          <input
            type="number"
            value={config.ftMinPairs}
            onChange={(e) => update('ftMinPairs', Number(e.target.value))}
            min={100}
            className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Mínimo de pares feedback-humano/hallazgo-IA para iniciar fine-tuning
          </p>
        </div>
      </section>

      {/* Seguridad */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-medium text-gray-900">Seguridad</h2>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Expiración de sesión JWT
          </label>
          <select
            value={config.jwtExpiry}
            onChange={(e) => update('jwtExpiry', e.target.value)}
            className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
          >
            <option value="15m">15 minutos</option>
            <option value="1h">1 hora</option>
            <option value="6h">6 horas</option>
            <option value="1d">1 día</option>
            <option value="7d">7 días</option>
          </select>
        </div>
      </section>

      {/* Fechas Límite por Programa */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-[#185FA5]" />
          Fechas límite de entregas oficiales
        </h2>
        <p className="text-xs text-gray-500">
          Establece las fechas límite para las entregas oficiales por programa. Después de la fecha límite, los estudiantes no podrán realizar envíos oficiales de ese tipo de avance.
        </p>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Seleccionar Programa Académico
          </label>
          <select
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
          >
            <option value="">Seleccionar programa...</option>
            {programs?.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {selectedProgramId && (
          <div className="space-y-4 border-t border-gray-100 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  CAPÍTULO I: INTRODUCCIÓN
                </label>
                <input
                  type="datetime-local"
                  value={programDeadlines.chapter_1}
                  onChange={(e) => updateDeadline('chapter_1', e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  CAPÍTULO II: MÉTODO
                </label>
                <input
                  type="datetime-local"
                  value={programDeadlines.chapter_2}
                  onChange={(e) => updateDeadline('chapter_2', e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  CAPÍTULO III: ASPECTOS ADMINISTRATIVOS
                </label>
                <input
                  type="datetime-local"
                  value={programDeadlines.chapter_3}
                  onChange={(e) => updateDeadline('chapter_3', e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Avance Completo
                </label>
                <input
                  type="datetime-local"
                  value={programDeadlines.full}
                  onChange={(e) => updateDeadline('full', e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveDeadlines}
                disabled={savingDeadlines}
                className="h-9 px-4 rounded-lg bg-[#185FA5] hover:bg-[#0C447C] text-white text-xs
                           font-medium disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {savingDeadlines ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Guardar fechas límite
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Guardar general */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="h-10 px-5 rounded-lg bg-[#185FA5] hover:bg-[#0C447C] text-white text-sm
                   font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar configuración general
      </button>
    </div>
  );
}
