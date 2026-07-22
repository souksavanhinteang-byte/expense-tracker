import type { MonthlyIncomeExpenseGroup } from "@/lib/dashboard-reports";
import { formatMoney } from "@/lib/format-money";

type MonthlyIncomeExpenseChartProps = {
  groups: MonthlyIncomeExpenseGroup[];
};

export function MonthlyIncomeExpenseChart({ groups }: MonthlyIncomeExpenseChartProps) {
  if (!groups.length) {
    return <p className="mt-4 text-slate-500">ບໍ່ມີຂໍ້ມູນ</p>;
  }

  return (
    <div className="mt-4 space-y-6">
      {groups.map((group) => {
        const maximum = Math.max(
          1,
          ...group.months.flatMap((month) => [month.income, month.expense]),
        );

        return (
          <section key={group.currency} aria-label={`ລາຍງານ ${group.currency}`}>
            <p className="mb-3 font-semibold">{group.currency}</p>
            <div className="mb-3 flex gap-4 text-sm">
              <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-emerald-500" />ລາຍຮັບ</span>
              <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-red-500" />ລາຍຈ່າຍ</span>
            </div>
            <div className="grid grid-cols-6 gap-2" role="list">
              {group.months.map((month) => (
                <div key={month.key} className="min-w-0" role="listitem">
                  <div className="flex h-40 items-end justify-center gap-1 rounded-lg bg-slate-50 p-2">
                    <div
                      aria-label={`${month.label} ລາຍຮັບ ${formatMoney(month.income)} ${group.currency}`}
                      className="w-1/2 rounded-t bg-emerald-500"
                      style={{ height: `${(month.income / maximum) * 100}%` }}
                      title={`ລາຍຮັບ: ${formatMoney(month.income)} ${group.currency}`}
                    />
                    <div
                      aria-label={`${month.label} ລາຍຈ່າຍ ${formatMoney(month.expense)} ${group.currency}`}
                      className="w-1/2 rounded-t bg-red-500"
                      style={{ height: `${(month.expense / maximum) * 100}%` }}
                      title={`ລາຍຈ່າຍ: ${formatMoney(month.expense)} ${group.currency}`}
                    />
                  </div>
                  <p className="mt-2 truncate text-center text-xs text-slate-500">{month.label}</p>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
