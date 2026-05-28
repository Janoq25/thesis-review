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
import { Loader2, FileDown, FileText, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { useStatusConfig } from '@/lib/i18n/use-status-config';

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { t } = useI18n();
  const { config: STATUS_CONFIG } = useStatusConfig();
  const [activeTab, setActiveTab] = useState('ai');
  // Mobile: toggle between document viewer and review panel
  const [mobileView, setMobileView] = useState<'doc' | 'panel'>('doc');

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

  const reviewPanel = (
    <div className="w-full lg:w-[420px] border-l border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden bg-white dark:bg-gray-900 h-full">
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
            <AIEvaluationPanel analysis={advance?.aiAnalysis} advanceId={id} />
          </TabsContent>
          <TabsContent value="human" className="p-4 m-0">
            <HumanReviewPanel
              advanceId={id}
              existingReview={advance?.review}
              rubric={advance?.template?.rubric}
              onSave={(data) => reviewMutation.mutate(data)}
              isSaving={reviewMutation.isPending}
              disabled={!canReview}
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
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Topbar ── */}
      <div className="flex items-start sm:items-center justify-between px-3 sm:px-5 py-2.5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {advance?.title ?? t('review.title')}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {advance?.student?.name} · {advance?.program?.name}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {advance?.aiAnalysis && (
            <span className="flex items-center px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-100 text-[10px] sm:text-xs font-medium whitespace-nowrap">
              IA: {advance.aiAnalysis.gradeConverted?.toFixed(1)}
            </span>
          )}

          {data?.plagiarism?.overallSimilarity != null && (
            <span className={cn(
              'flex items-center px-2 py-0.5 rounded-lg border text-[10px] sm:text-xs font-medium whitespace-nowrap',
              data.plagiarism.overallSimilarity >= 15 ? 'bg-red-50 text-red-700 border-red-100' :
              data.plagiarism.overallSimilarity >= 10 ? 'bg-amber-50 text-amber-700 border-amber-100' :
              'bg-green-50 text-green-700 border-green-100',
            )}>
              Plagio: {data.plagiarism.overallSimilarity.toFixed(1)}%
            </span>
          )}

          {data?.plagiarism?.aiScore != null && (
            <span className={cn(
              'hidden sm:flex items-center px-2 py-0.5 rounded-lg border text-[10px] sm:text-xs font-medium whitespace-nowrap',
              data.plagiarism.aiScore >= 50 ? 'bg-red-50 text-red-700 border-red-100' :
              data.plagiarism.aiScore >= 20 ? 'bg-amber-50 text-amber-700 border-amber-100' :
              'bg-green-50 text-green-700 border-green-100',
            )}>
              Escrit. IA: {data.plagiarism.aiScore.toFixed(1)}%
            </span>
          )}

          {/* Status badge */}
          <span className={cn(
            'text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap',
            STATUS_CONFIG[advance?.status ?? 'PENDING']?.className ?? STATUS_CONFIG.PENDING.className,
          )}>
            {STATUS_CONFIG[advance?.status ?? 'PENDING']?.label ?? advance?.status}
          </span>

          <button
            onClick={downloadReport}
            className="h-7 sm:h-8 px-2 sm:px-3 rounded-lg border border-gray-200 dark:border-gray-600 text-[10px] sm:text-xs
                       text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800
                       flex items-center gap-1 whitespace-nowrap"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('review.downloadReport')}</span>
          </button>
        </div>
      </div>

      {/* ── Mobile view toggle ── */}
      <div className="lg:hidden flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
        <button
          onClick={() => setMobileView('doc')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors border-b-2',
            mobileView === 'doc'
              ? 'border-[#185FA5] text-[#185FA5]'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
          )}
        >
          <FileText className="w-3.5 h-3.5" />
          Documento
        </button>
        <button
          onClick={() => setMobileView('panel')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors border-b-2',
            mobileView === 'panel'
              ? 'border-[#185FA5] text-[#185FA5]'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
          )}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Revisión
        </button>
      </div>

      {/* ── Main layout ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document viewer: always visible on desktop, toggled on mobile */}
        <div className={cn(
          'overflow-hidden flex-1 w-full',
          mobileView === 'panel' ? 'hidden lg:flex' : 'flex',
        )}>
          <DocumentViewer advanceId={id} />
        </div>

        {/* Review panel: always visible on desktop, toggled on mobile */}
        <div className={cn(
          'overflow-hidden',
          mobileView === 'doc'
            ? 'hidden lg:flex lg:w-[360px] lg:flex-shrink-0'
            : 'flex flex-1 lg:flex-none lg:w-[360px] lg:flex-shrink-0',
        )}>
          {reviewPanel}
        </div>
      </div>
    </div>
  );
}
