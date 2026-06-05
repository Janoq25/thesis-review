'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { OrcidProfileCard } from '@/components/orcid/OrcidProfileCard';
import { User, Mail, Shield, GraduationCap, Briefcase } from 'lucide-react';

interface UserSession {
  id: string;
  name: string;
  role: string;
  email: string;
  programId?: string;
  program?: {
    name: string;
  };
}

export default function ProfilePage() {
  const { t } = useI18n();
  const [user, setUser] = useState<UserSession | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('user');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading user session', e);
    }
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-gray-500">
        Cargando perfil...
      </div>
    );
  }

  const isAdvisor = user.role === 'ADVISOR';

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-950 dark:text-white flex items-center gap-2">
          <User className="w-6 h-6 text-[#185FA5]" />
          Mi Perfil
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Administra tus datos personales y configuraciones de investigador.
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-white dark:bg-gray-950 border border-gray-150 dark:border-gray-800 rounded-2xl shadow-sm p-6 flex flex-col md:flex-row gap-6 items-center md:items-start">
        {/* Avatar */}
        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#185FA5] to-blue-400 flex items-center justify-center text-white text-3xl font-semibold shadow-inner flex-shrink-0">
          {user.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase()}
        </div>

        {/* Details */}
        <div className="flex-1 space-y-4 text-center md:text-left">
          <div>
            <h2 className="text-xl font-medium text-gray-900 dark:text-white">{user.name}</h2>
            <div className="flex flex-wrap gap-2 justify-center md:justify-start items-center mt-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                <Shield className="w-3.5 h-3.5" />
                {t(`roles.${user.role}` as 'roles.STUDENT')}
              </span>
              {user.program?.name && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                  <GraduationCap className="w-3.5 h-3.5" />
                  {user.program.name}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-left">
            <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400">
              <Mail className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-[10px] text-gray-400 font-medium uppercase">Correo electrónico</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400">
              <Briefcase className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-[10px] text-gray-400 font-medium uppercase">Rol académico</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {user.role === 'STUDENT' ? 'Estudiante Tesista' : 'Docente / Asesor Científico'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ORCID Section (Only visible for advisors or admins) */}
      {(isAdvisor || user.role === 'ADMIN') && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Conexión Académica (ORCID)</h3>
            <p className="text-xs text-gray-500">
              Sincroniza tus áreas de especialidad y publicaciones desde la plataforma oficial de ORCID para habilitar el motor de recomendación inteligente.
            </p>
          </div>
          <OrcidProfileCard userId={user.id} />
        </div>
      )}
    </div>
  );
}
