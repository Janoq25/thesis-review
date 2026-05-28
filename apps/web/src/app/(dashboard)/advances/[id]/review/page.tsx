'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
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
import { useI18n } from '@/lib/i18n/context';
import { useStatusConfig } from '@/lib/i18n/use-status-config';

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { t } = useI18n();
  const { config: STATUS_CONFIG } = useStatusConfig();
  const [activeTab, setActiveTab] = useState('ai');

  const { data, isLoading } = useQuery({
    queryKey: ['advance-review', id],
    queryFn: () => apiClient.get(`/reviews/panel/${id}`).then((r) => r.data),
    refetchInterval: ({ state }) =>
      ['PENDING', 'AI_PROCESSING'].includes(state.data?.advance?.status) ? 5000 : false,
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
      <div className="flex items-center justify-between px-5 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="min-w-0">
          <h1 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {advance?.title ?? t('review.title')}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {advance?.student?.name} · {advance?.program?.name}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {advance?.aiAnalysis && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-100 text-xs font-medium">
              Nota IA: {advance.aiAnalysis.gradeConverted?.toFixed(1)}
            </span>
          )}
          {data?.plagiarism?.overallSimilarity != null && (
            <span className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium",
              data.plagiarism.overallSimilarity >= 15 ? "bg-red-50 text-red-700 border-red-100" :
              data.plagiarism.overallSimilarity >= 10 ? "bg-amber-50 text-amber-700 border-amber-100" :
              "bg-green-50 text-green-700 border-green-100"
            )}>
              Plagio: {data.plagiarism.overallSimilarity.toFixed(1)}%
            </span>
          )}

          {data?.plagiarism?.aiScore != null && (
            <span className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium",
              data.plagiarism.aiScore >= 50 ? "bg-red-50 text-red-700 border-red-100" :
              data.plagiarism.aiScore >= 20 ? "bg-amber-50 text-amber-700 border-amber-100" :
              "bg-green-50 text-green-700 border-green-100"
            )}>
              Escritura IA: {data.plagiarism.aiScore.toFixed(1)}%
            </span>
          )}

          {/* Status badge */}
          <span
            className={cn(
              'text-xs font-medium px-2.5 py-1 rounded-full',
              STATUS_CONFIG[advance?.status ?? 'PENDING']?.className ?? STATUS_CONFIG.PENDING.className,
            )}
          >
            {STATUS_CONFIG[advance?.status ?? 'PENDING']?.label ?? advance?.status}
          </span>

          <button
            onClick={downloadReport}
            className="h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300
                       hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1.5"
          >
            <FileDown className="w-3.5 h-3.5" />
            {t('review.downloadReport')}
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
                {t('review.observe')}
              </button>
              <button
                onClick={() => reviewMutation.mutate({ status: 'REJECTED' })}
                disabled={reviewMutation.isPending}
                className="h-8 px-3 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs
                           hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                {t('review.reject')}
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
                {t('review.approve')}
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
        <div className="w-[420px] border-l border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <TabsList className="flex-shrink-0 rounded-none bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 h-10 px-2">
              <TabsTrigger value="ai" className="text-xs data-[state=active]:shadow-none dark:text-gray-300">
                {t('review.tabAi')}
              </TabsTrigger>
              <TabsTrigger value="human" className="text-xs data-[state=active]:shadow-none dark:text-gray-300">
                {t('review.tabHuman')}
              </TabsTrigger>
              <TabsTrigger value="plagiarism" className="text-xs data-[state=active]:shadow-none dark:text-gray-300">
                {t('review.tabPlagiarism')}
              </TabsTrigger>
              <TabsTrigger value="references" className="text-xs data-[state=active]:shadow-none dark:text-gray-300">
                {t('review.tabReferences')}
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
