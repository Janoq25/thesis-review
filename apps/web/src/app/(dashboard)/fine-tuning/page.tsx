import { Suspense } from 'react';
import { FineTuningDashboard } from '@/components/fine-tuning/FineTuningDashboard';
import { FineTuningPairsList } from '@/components/fine-tuning/FineTuningPairsList';
import { ModelMetricsCard } from '@/components/fine-tuning/ModelMetricsCard';

export const metadata = { title: 'Fine-tuning IA | ThesisReview' };

export default function FineTuningPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-medium text-gray-900">Fine-tuning con feedback humano</h1>
        <p className="mt-1 text-sm text-gray-500">
          El sistema recopila correcciones de asesores para mejorar el modelo de forma continua.
        </p>
      </div>

      <Suspense fallback={<div className="h-32 animate-pulse bg-gray-100 rounded-xl" />}>
        <FineTuningDashboard />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<div className="h-64 animate-pulse bg-gray-100 rounded-xl" />}>
          <ModelMetricsCard />
        </Suspense>
        <Suspense fallback={<div className="h-64 animate-pulse bg-gray-100 rounded-xl" />}>
          <FineTuningPairsList />
        </Suspense>
      </div>
    </div>
  );
}
