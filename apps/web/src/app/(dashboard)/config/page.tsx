'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Settings, Save, Loader2 } from 'lucide-react';

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

  useEffect(() => {
    setConfig({
      maxGrade: Number(process.env.NEXT_PUBLIC_MAX_GRADE) || 20,
      lowComplianceAlert: Number(process.env.NEXT_PUBLIC_LOW_COMPLIANCE_ALERT) || 65,
      ftMinPairs: Number(process.env.NEXT_PUBLIC_FT_MIN_PAIRS) || 500,
      jwtExpiry: process.env.NEXT_PUBLIC_JWT_EXPIRY || '15m',
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    toast.success('Configuración guardada (aplica al reiniciar el servidor)');
  };

  const update = (key: keyof Config, value: string | number) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

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

      {/* Guardar */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="h-10 px-5 rounded-lg bg-[#185FA5] hover:bg-[#0C447C] text-white text-sm
                   font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar configuración
      </button>
    </div>
  );
}
