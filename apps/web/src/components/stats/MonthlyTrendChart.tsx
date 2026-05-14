'use client';

import { useEffect, useRef } from 'react';
import { Chart, LineController, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip);

interface MonthlyData { month: string; total: number; approved: number }

export function MonthlyTrendChart({ data }: { data: MonthlyData[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;
    if (chartRef.current) chartRef.current.destroy();

    const labels = data.map((d) => {
      const [y, m] = d.month.split('-');
      return new Date(Number(y), Number(m) - 1).toLocaleString('es-PE', { month: 'short' });
    });

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total avances',
            data: data.map((d) => d.total),
            borderColor: '#185FA5',
            backgroundColor: 'rgba(24,95,165,0.08)',
            tension: 0.3,
            fill: true,
            pointRadius: 4,
          },
          {
            label: 'Aprobados',
            data: data.map((d) => d.approved),
            borderColor: '#1D9E75',
            backgroundColor: 'transparent',
            tension: 0.3,
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { beginAtZero: true, ticks: { stepSize: 5, font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
        },
      },
    });

    return () => chartRef.current?.destroy();
  }, [data]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-medium text-gray-900 mb-4">Avances por mes (2025)</h3>
      <div className="h-52"><canvas ref={canvasRef} /></div>
    </div>
  );
}
