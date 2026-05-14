'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocumentViewer } from '@/components/review/DocumentViewer';
import { AIEvaluationPanel } from '@/components/review/AIEvaluationPanel';
import { HumanReviewPanel } from '@/components/review/HumanReviewPanel';
import { PlagiarismPanel } from '@/components/plagiarism/PlagiarismPanel';
import { ReferencesPanel } from '@/components/references/ReferencesPanel';
import { CheckCircle2, XCircle, Eye, Loader2, FileDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_FLOW: Record<string, string[]> = {
  PENDING: ['AI_PROCESSING'],
  AI_PROCESSING: ['AI_COMPLETE'],
  AI_COMPLETE: ['HUMAN_REVIEW', 'OBSERVED', 'APPROVED', 'REJECTED'],
  HUMAN_REVIEW: ['OBSERVED', 'APPROVED', 'REJECTED'],
  OBSERVED: ['APPROVED', 'REJECTED'],
};

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('ai');

  const { data, isLoading } = useQuery({
    queryKey: ['advance-review', id],
    queryFn: () => apiClient.get(`/reviews/panel/${id}`).then((r) => r.data),
    refetchInterval: (data) =>
      ['PENDING', 'AI_PROCESSING'].includes(data?.advance?.status) ? 5000 : false,
  });

  const reviewMutation = useMutation({
    mutationFn: (body: {
      status: 'OBSERVED' | 'APPROVED' | 'REJECTED';
      finalGrade?: number;
      humanComment?: string;
      rubricAnswers?: Record<string, boolean>;
    }) => apiClient.post(`/reviews/${id}`, body),
    onSuccess: (_, vars) => {
      toast.success(
        vars.status === 'APPROVED' ? 'Avance aprobado' :
        vars.status === 'REJECTED' ? 'Avance rechazado' : 'Observación registrada',
      );
      qc.invalidateQueries({ queryKey: ['advance-review', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message ?? 'Error al guardar'),
  });

  const downloadReport = async () => {
    const { data: blob } = await apiClient.get(`/reports/advance/${id}`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-${id}.pdf`;
    a.click();
  };

  const advance = data?.advance;
  const canReview = advance && ['AI_COMPLETE', 'HUMAN_REVIEW', 'OBSERVED'].includes(advance.status);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Topbar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="min-w-0">
          <h1 className="text-sm font-medium text-gray-900 truncate">
            {advance?.title ?? 'Revisión de avance'}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {advance?.student?.name} · {advance?.program?.name}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Status badge */}
          <span className={cn(
            'text-xs font-medium px-2.5 py-1 rounded-full',
            advance?.status === 'APPROVED' ? 'bg-green-50 text-green-700' :
            advance?.status === 'REJECTED' ? 'bg-red-50 text-red-700' :
            advance?.status === 'AI_PROCESSING' ? 'bg-purple-50 text-purple-700' :
            'bg-blue-50 text-blue-700',
          )}>
            {advance?.status}
          </span>

          <button
            onClick={downloadReport}
            className="h-8 px-3 rounded-lg border border-gray-200 text-xs text-gray-600
                       hover:bg-gray-50 flex items-center gap-1.5"
          >
            <FileDown className="w-3.5 h-3.5" />
            Reporte PDF
          </button>

          {canReview && (
            <>
              <button
                onClick={() => reviewMutation.mutate({ status: 'OBSERVED' })}
                disabled={reviewMutation.isPending}
                className="h-8 px-3 rounded-lg border border-amber-200 text-amber-700 text-xs
                           hover:bg-amber-50 flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                Observar
              </button>
              <button
                onClick={() => reviewMutation.mutate({ status: 'REJECTED' })}
                disabled={reviewMutation.isPending}
                className="h-8 px-3 rounded-lg border border-red-200 text-red-700 text-xs
                           hover:bg-red-50 flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                Rechazar
              </button>
              <button
                onClick={() => reviewMutation.mutate({ status: 'APPROVED' })}
                disabled={reviewMutation.isPending}
                className="h-8 px-3 rounded-lg bg-green-600 hover:bg-green-700 text-white
                           text-xs flex items-center gap-1.5"
              >
                {reviewMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <CheckCircle2 className="w-3.5 h-3.5" />}
                Aprobar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Layout principal */}
      <div className="flex-1 flex overflow-hidden">
        {/* Visor documento */}
        <div className="flex-1 overflow-hidden">
          <DocumentViewer advanceId={id} />
        </div>

        {/* Panel revisión */}
        <div className="w-[420px] border-l border-gray-200 flex flex-col overflow-hidden bg-white">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <TabsList className="flex-shrink-0 rounded-none bg-white border-b border-gray-200 h-10 px-2">
              <TabsTrigger value="ai" className="text-xs data-[state=active]:shadow-none">
                Evaluación IA
              </TabsTrigger>
              <TabsTrigger value="human" className="text-xs data-[state=active]:shadow-none">
                Mi revisión
              </TabsTrigger>
              <TabsTrigger value="plagiarism" className="text-xs data-[state=active]:shadow-none">
                Plagio
              </TabsTrigger>
              <TabsTrigger value="references" className="text-xs data-[state=active]:shadow-none">
                Referencias
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto">
              <TabsContent value="ai" className="p-4 m-0">
                <AIEvaluationPanel
                  analysis={advance?.aiAnalysis}
                  advanceId={id}
                />
              </TabsContent>
              <TabsContent value="human" className="p-4 m-0">
                <HumanReviewPanel
                  advanceId={id}
                  existingReview={advance?.review}
                  rubric={advance?.template?.rubric}
                  onSave={(data) => reviewMutation.mutate(data)}
                />
              </TabsContent>
              <TabsContent value="plagiarism" className="p-4 m-0">
                <PlagiarismPanel advanceId={id} />
              </TabsContent>
              <TabsContent value="references" className="p-4 m-0">
                <ReferencesPanel advanceId={id} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
