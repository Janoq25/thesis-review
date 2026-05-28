'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Loader2, ZoomIn } from 'lucide-react';

interface DocumentViewerProps {
  advanceId: string;
}

export function DocumentViewer({ advanceId }: DocumentViewerProps) {
  const [fileType, setFileType] = useState<'pdf' | 'docx' | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  
  const { data: advance } = useQuery({
    queryKey: ['advance-detail', advanceId],
    queryFn: () => apiClient.get(`/advances/${advanceId}`).then((r) => r.data),
  });

  const { isLoading } = useQuery({
    queryKey: ['advance-file-blob', advanceId],
    queryFn: async () => {
      // Obtenemos el archivo a través de nuestra API para que use el token de autenticación
      // y evitamos los problemas de cabeceras de MinIO.
      const response = await apiClient.get(`/advances/${advanceId}/view`, {
        responseType: 'blob'
      });
      const url = URL.createObjectURL(response.data);
      setFileUrl(url);
      return url;
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (advance?.fileType) {
      setFileType(advance.fileType);
    }
  }, [advance]);

  const [highlightedUrl, setHighlightedUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'original' | 'highlighted'>('original');

  const { data: plagiarismReport } = useQuery({
    queryKey: ['plagiarism-report', advanceId],
    queryFn: () => apiClient.get(`/plagiarism/report/${advanceId}`).then((r) => r.data),
  });

  useQuery({
    queryKey: ['advance-highlighted-blob', advanceId],
    queryFn: async () => {
      const response = await apiClient.get(`/plagiarism/report/${advanceId}/view`, {
        responseType: 'blob'
      });
      const url = URL.createObjectURL(response.data);
      setHighlightedUrl(url);
      return url;
    },
    enabled: !!plagiarismReport?.copyleaksReportKey,
    staleTime: Infinity,
  });

  // Limpiar el blob URL del archivo original al cambiar o desmontar
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  // Limpiar el blob URL del reporte resaltado al cambiar o desmontar
  useEffect(() => {
    return () => {
      if (highlightedUrl) URL.revokeObjectURL(highlightedUrl);
    };
  }, [highlightedUrl]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100 h-full w-full">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Preparando visor seguro...</p>
        </div>
      </div>
    );
  }

  if (!fileUrl) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 h-full w-full border-r border-gray-200">
        <p className="text-sm text-gray-400">No se pudo cargar la vista previa</p>
      </div>
    );
  }

  // Si es PDF, usamos el visor nativo del navegador (con soporte de alternancia de reportes)
  if (fileType === 'pdf') {
    const showToggle = !!plagiarismReport?.copyleaksReportKey;
    const currentUrl = viewMode === 'original' ? fileUrl : highlightedUrl;
    const isReportLoading = viewMode === 'highlighted' && !highlightedUrl;

    return (
      <div className="flex flex-col h-full w-full bg-gray-50 border-r border-gray-200">
        {showToggle && (
          <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              Modo de Visualización:
            </span>
            <div className="flex bg-gray-200 dark:bg-gray-700 p-0.5 rounded-lg">
              <button
                onClick={() => setViewMode('original')}
                className={`text-xs px-3 py-1 rounded-md font-medium transition-all ${
                  viewMode === 'original'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                Documento Original
              </button>
              <button
                onClick={() => setViewMode('highlighted')}
                className={`text-xs px-3 py-1 rounded-md font-medium transition-all ${
                  viewMode === 'highlighted'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                Reporte Turnitin (IA/Plagio)
              </button>
            </div>
          </div>
        )}
        <div className="flex-1 flex flex-col min-h-0">
          {isReportLoading ? (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="flex flex-col items-center gap-3 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <p className="text-xs">Descargando reporte de marcas de Copyleaks...</p>
              </div>
            </div>
          ) : (
            <iframe
              src={`${currentUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
              className="w-full h-full border-none"
              title="Visor PDF"
            />
          )}
        </div>
      </div>
    );
  }

  // Si es DOCX, los visores externos como Google Docs no funcionan con URLs locales (localhost o blob).
  // Por lo tanto, mostramos una interfaz para descargarlo o abrirlo externamente.
  return (
    <div className="flex flex-col h-full bg-gray-50 border-r border-gray-200 items-center justify-center p-6 text-center">
      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm max-w-sm w-full">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Documento Word</h3>
        <p className="text-sm text-gray-500 mb-6">
          La vista previa integrada solo está disponible para archivos PDF. Por favor, descarga el documento para revisarlo.
        </p>
        <a
          href={`/api/v1/advances/${advanceId}/download`}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#185FA5] text-white text-sm font-medium rounded-lg hover:bg-[#0C447C] transition-colors w-full"
        >
          <ZoomIn className="w-4 h-4" />
          Descargar Documento
        </a>
      </div>
    </div>
  );
}
