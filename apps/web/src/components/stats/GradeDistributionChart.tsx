'use client';

import { useEffect, useRef } from 'react';
import {
  Chart, BarController, BarElement, CategoryScale,
  LinearScale, Tooltip, Legend,
} from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface GradeData { range: string; count: number }

export function GradeDistributionChart({ data }: { data: GradeData[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;
    if (chartRef.current) chartRef.current.destroy();

    const labels = data.map((d) => d.range);
    const values = data.map((d) => d.count);

    const colors = labels.map((l) => {
      const num = parseInt(l, 10);
      if (num >= 16) return '#1D9E75';
      if (num >= 11) return '#185FA5';
      if (num >= 6) return '#F59E0B';
      return '#EF4444';
    });

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Cantidad',
            data: values,
            backgroundColor: colors,
            borderRadius: 4,
            barThickness: 20,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
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
      <h3 className="text-sm font-medium text-gray-900 mb-4">Distribución de notas (IA)</h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Sin datos disponibles</p>
      ) : (
        <div className="h-52"><canvas ref={canvasRef} /></div>
      )}
    </div>
  );
}
