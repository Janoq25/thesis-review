interface AdvisorRow {
  advisorId: string;
  name: string;
  totalReviews: number;
  avgReviewDays: number;
}

export function AdvisorWorkloadTable({ data }: { data: AdvisorRow[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-900">Carga de trabajo por asesor</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Asesor</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">Revisiones</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-gray-500">T. promedio</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Carga</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((row) => {
              const maxReviews = Math.max(...data.map((r) => r.totalReviews), 1);
              const pct = Math.round((row.totalReviews / maxReviews) * 100);
              return (
                <tr key={row.advisorId} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{row.name}</td>
                  <td className="px-5 py-3 text-right text-gray-700">{row.totalReviews}</td>
                  <td className="px-5 py-3 text-right text-gray-700">{row.avgReviewDays}d</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#185FA5]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
