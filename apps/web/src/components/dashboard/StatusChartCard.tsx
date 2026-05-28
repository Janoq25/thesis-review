'use client';

import { useEffect, useRef } from 'react';
import {
  Chart, BarController, BarElement,
  CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js';
import { useI18n } from '@/lib/i18n/context';
import { useTheme } from 'next-themes';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const STATUS_COLORS: Record<string, string> = {
  APPROVED: '#639922',
  HUMAN_REVIEW: '#185FA5',
  OBSERVED: '#BA7517',
  REJECTED: '#E24B4A',
  PENDING: '#888780',
  AI_PROCESSING: '#7F77DD',
  AI_COMPLETE: '#1D9E75',
};

export function StatusChartCard({ data }: { data?: Record<string, number> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const { t, locale } = useI18n();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    if (chartRef.current) chartRef.current.destroy();

    const entries = Object.entries(data).filter(([, v]) => v > 0);
    const labels = entries.map(([k]) => t(`status.${k}`));
    const values = entries.map(([, v]) => v);
    const colors = entries.map(([k]) => STATUS_COLORS[k] ?? '#888780');
    const isDark = resolvedTheme === 'dark';

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y}` } },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: isDark ? '#9ca3af' : '#6b7280' },
          },
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { size: 11 }, color: isDark ? '#9ca3af' : '#6b7280' },
            grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
          },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [data, locale, resolvedTheme, t]);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {t('dashboard.statusDistribution')}
        </h2>
        <span className="text-xs text-gray-400">{t('dashboard.period')}</span>
      </div>
      <div className="h-48">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
