'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';

interface DocumentViewerProps {
  advanceId: string;
}

export function DocumentViewer({ advanceId }: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [isRendering, setIsRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: previewData, isLoading } = useQuery({
    queryKey: ['advance-preview-url', advanceId],
    queryFn: () => apiClient.get(`/advances/${advanceId}/preview-url`).then((r) => r.data),
  });

  // Cargar PDF.js desde CDN
  useEffect(() => {
    if (!previewData?.url) return;

    const loadPdf = async () => {
      // Importar PDF.js dinámicamente
      const pdfjsLib = (window as any)['pdfjs-dist/build/pdf'];
      if (!pdfjsLib) {
        // Cargar script si no está disponible
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => loadPdf();
        document.head.appendChild(script);
        return;
      }

      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const doc = await pdfjsLib.getDocument(previewData.url).promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
    };

    loadPdf();
  }, [previewData?.url]);

  // Renderizar página
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || isRendering) return;

    const renderPage = async () => {
      setIsRendering(true);
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: ctx, viewport }).promise;
      setIsRendering(false);
    };

    renderPage();
  }, [pdfDoc, currentPage, scale]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Cargando documento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-600 min-w-[80px] text-center">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage >= totalPages}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <button
          onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
          className="p-1 rounded hover:bg-gray-100"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
          className="p-1 rounded hover:bg-gray-100"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-400 ml-1">{Math.round(scale * 100)}%</span>

        <div className="ml-auto flex items-center gap-2">
          
            href={`/api/advances/${advanceId}/download`}
            className="text-xs text-[#185FA5] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Descargar
          </a>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-auto flex justify-center p-4">
        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}
        <canvas ref={canvasRef} className="shadow-lg" />
      </div>
    </div>
  );
}
