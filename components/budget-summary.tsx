import type { BudgetProgress } from "@/lib/budget-reports";
import { formatMoney } from "@/lib/format-money";

type BudgetSummaryProps = {
  budgets: BudgetProgress[];
};

function getBudgetStatus(percentage: number) {
  if (percentage >= 100) return { label: "ເກີນງົບ", className: "bg-red-600", textClassName: "text-red-700" };
  if (percentage >= 80) return { label: "ໃກ້ເກີນງົບ", className: "bg-amber-500", textClassName: "text-amber-700" };
  return { label: "ປົກກະຕິ", className: "bg-emerald-600", textClassName: "text-emerald-700" };
}

export function BudgetSummary({ budgets }: BudgetSummaryProps) {
  if (!budgets.length) {
    return <p className="mt-4 text-slate-500">ຍັງບໍ່ມີງົບປະມານ</p>;
  }

  return (
    <div className="mt-4 space-y-5">
      {budgets.map((budget) => {
        const status = getBudgetStatus(budget.percentage);
        const visualPercentage = Math.min(budget.percentage, 100);
        return (
          <section key={budget.id} aria-label={`${budget.categoryName} ${budget.currency}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-semibold">
                {budget.categoryName} {!budget.categoryIsActive && <span className="text-sm font-normal text-slate-500">(ປິດໃຊ້ງານ)</span>}
              </p>
              <p className="text-sm font-medium">ງົບທັງໝົດ: {formatMoney(budget.budget)} {budget.currency}</p>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(visualPercentage)} aria-label={`${budget.categoryName}: ໃຊ້ໄປແລ້ວ ${budget.percentage.toFixed(1)}%`}>
              <div className={`h-full rounded-full ${status.className}`} style={{ width: `${visualPercentage}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
              <span>ໃຊ້ໄປແລ້ວ: {formatMoney(budget.spent)} {budget.currency} ({budget.percentage.toFixed(1)}%)</span>
              <span className={status.textClassName}>
                {budget.remaining < 0
                  ? `ເກີນງົບ: ${formatMoney(-budget.remaining)} ${budget.currency}`
                  : `ຍັງເຫຼືອ: ${formatMoney(budget.remaining)} ${budget.currency}`}
                {` (${status.label})`}
              </span>
            </div>
          </section>
        );
      })}
    </div>
  );
}
