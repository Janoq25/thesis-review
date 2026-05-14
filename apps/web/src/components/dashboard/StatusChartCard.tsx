'use client';

import { useEffect, useRef } from 'react';
import {
  Chart, BarController, BarElement,
  CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js';

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

const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Aprobados',
  HUMAN_REVIEW: 'En revisión',
  OBSERVED: 'Observados',
  REJECTED: 'Rechazados',
  PENDING: 'Pendientes',
  AI_PROCESSING: 'Analizando IA',
  AI_COMPLETE: 'IA completado',
};

export function StatusChartCard({ data }: { data?: Record<string, number> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    if (chartRef.current) chartRef.current.destroy();

    const entries = Object.entries(data).filter(([, v]) => v > 0);
    const labels = entries.map(([k]) => STATUS_LABELS[k] ?? k);
    const values = entries.map(([, v]) => v);
    const colors = entries.map(([k]) => STATUS_COLORS[k] ?? '#888780');

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
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y} avances` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { size: 11 } },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [data]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-900">Distribución de estados</h2>
        <span className="text-xs text-gray-400">Período 2025-II</span>
      </div>
      <div className="h-48">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
