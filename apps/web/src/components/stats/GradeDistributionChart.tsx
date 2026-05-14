'use client';

import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface GradeDistributionChartProps {
  data: Array<{ grade: number; count: number }>;
}

export function GradeDistributionChart({ data }: GradeDistributionChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !data?.length) return;

    chartRef.current?.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: data.map((d) => `Nota ${d.grade}`),
        datasets: [
          {
            label: 'Avances',
            data: data.map((d) => d.count),
            backgroundColor: 'rgba(24, 95, 165, 0.8)',
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } },
          x: { ticks: { font: { size: 11 } } },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [data]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-900 mb-4">Distribución de notas IA</p>
      {!data?.length ? (
        <div className="h-48 flex items-center justify-center text-sm text-gray-400">
          Sin datos disponibles
        </div>
      ) : (
        <div className="h-48 relative">
          <canvas ref={canvasRef} />
        </div>
      )}
    </div>
  );
}
