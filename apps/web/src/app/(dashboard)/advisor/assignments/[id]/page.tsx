'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  ArrowLeft, Calendar, Clock, FileText, CheckCircle2,
  AlertTriangle, Users, BarChart3, ShieldCheck, Loader2, ExternalLink
} from 'lucide-react';
import { formatDayMonthYear, formatDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Student {
  id: string;
  name: string;
  email: string;
}

interface Advance {
  id: string;
  title: string;
  createdAt: string;
  fileType: string;
  student: Student;
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
  template?: {
    name: string;
    version: string;
  } | null;
  advanceType: string;
  advances?: Advance[];
}

export default function AdvisorAssignmentDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const { data: assignment, isLoading } = useQuery<Assignment>({
    queryKey: ['advisor-assignment-detail', id],
    queryFn: () => apiClient.get(`/assignments/${id}`).then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="p-8 text-center text-gray-500 space-y-4">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
        <p>Tarea no encontrada.</p>
        <button
          onClick={() => router.push('/advisor/assignments')}
          className="text-sm text-[#185FA5] font-medium hover:underline"
        >
          Volver a tareas
        </button>
      </div>
    );
  }

  const advances = assignment.advances || [];
  const totalSubmissions = advances.length;
  
  // Calculate averages
  const averageSimilarity = totalSubmissions > 0
    ? advances.reduce((sum, a) => sum + (a.plagiarismReport?.overallSimilarity ?? 0), 0) / totalSubmissions
    : 0;

  const gradedSubmissions = advances.filter(a => a.review?.finalGrade != null).length;

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Botón Volver */}
      <button
        onClick={() => router.push('/advisor/assignments')}
        className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1.5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver a tareas
      </button>

      {/* Cabecera de Tarea */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-gray-950 dark:text-white">{assignment.title}</h1>
            <div className="flex flex-wrap gap-2 text-[10px] mt-2">
              {assignment.template && (
                <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                  <FileText className="w-3 h-3" />
                  {assignment.template.name} (v{assignment.template.version})
                </span>
              )}
              <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono uppercase">
                {assignment.advanceType === 'full' ? 'Tesis Completa' : `Capítulo ${assignment.advanceType.replace('chapter_', '')}`}
              </span>
            </div>
          </div>
          <Badge className={assignment.isActive ? 'bg-green-100 text-green-700 border-0' : 'bg-gray-100 text-gray-600 border-0'}>
            {assignment.isActive ? 'Activa' : 'Inactiva'}
          </Badge>
        </div>

        {assignment.description && (
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
            {assignment.description}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-50 dark:border-gray-800/50 flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500">
          {assignment.startDate && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>Fecha de Inicio:</span>
              <span className="text-gray-900 dark:text-gray-200">
                {formatDayMonthYear(assignment.startDate)}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span>Fecha Límite:</span>
            {assignment.deadlineDate ? (
              <span className="text-gray-900 dark:text-gray-200 font-semibold">
                {formatDayMonthYear(assignment.deadlineDate)}
              </span>
            ) : (
              <span className="text-gray-400">Sin límite</span>
            )}
          </div>
        </div>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center text-blue-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Entregas recibidas</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalSubmissions}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-950/20 flex items-center justify-center text-green-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Calificadas</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {gradedSubmissions} <span className="text-xs font-normal text-gray-400">/ {totalSubmissions}</span>
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/20 flex items-center justify-center text-purple-600">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Similitud promedio</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {totalSubmissions > 0 ? `${averageSimilarity.toFixed(0)}%` : '--'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabla de Entregas de Estudiantes */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-50 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-950 dark:text-white">Avances Definitivos de Estudiantes</h2>
          <p className="text-xs text-gray-500 mt-1">Lista de entregas oficiales enviadas por los estudiantes asignados.</p>
        </div>

        {totalSubmissions === 0 ? (
          <div className="p-12 text-center text-gray-500 space-y-2">
            <ShieldCheck className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="text-sm font-medium">Ningún estudiante ha subido su entrega oficial para esta tarea.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-50 dark:border-gray-800 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/50 dark:bg-gray-950/25">
                  <th className="py-3 px-5">Estudiante</th>
                  <th className="py-3 px-5">Fecha de Entrega</th>
                  <th className="py-3 px-5">Documento</th>
                  <th className="py-3 px-5">Plagio (Copyleaks)</th>
                  <th className="py-3 px-5">Nota / Calificación</th>
                  <th className="py-3 px-5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800 text-xs">
                {advances.map((advance) => {
                  const similarity = advance.plagiarismReport?.overallSimilarity;
                  const grade = advance.review?.finalGrade;
                  
                  return (
                    <tr key={advance.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-950/10 transition-colors">
                      <td className="py-3.5 px-5">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{advance.student.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{advance.student.email}</p>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-gray-500">
                        {formatDateTime(advance.createdAt)}
                      </td>
                      <td className="py-3.5 px-5 max-w-xs truncate">
                        <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5" title={advance.title}>
                          <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{advance.title}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        {advance.plagiarismReport ? (
                          <span className={`inline-flex font-semibold px-2 py-0.5 rounded-full text-[10px] border ${
                            similarity != null && similarity >= 15
                              ? 'bg-red-50 text-red-700 border-red-100'
                              : 'bg-green-50 text-green-700 border-green-100'
                          }`}>
                            {similarity != null ? `${similarity.toFixed(0)}%` : 'Calculando...'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">Sin reporte</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        {grade != null ? (
                          <span className="inline-flex font-semibold px-2 py-0.5 rounded-full text-[10px] bg-green-50 text-green-700 border border-green-100">
                            {grade.toFixed(0)} / 20
                          </span>
                        ) : (
                          <span className="inline-flex font-medium px-2 py-0.5 rounded-full text-[10px] bg-amber-50 text-amber-700 border border-amber-100">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => router.push(`/advances/${advance.id}/review`)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-[#185FA5] dark:bg-gray-800 dark:hover:bg-gray-700 font-medium transition-colors"
                        >
                          Revisar
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
