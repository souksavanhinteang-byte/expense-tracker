import type { CategoryExpenseGroup } from "@/lib/dashboard-reports";
import { formatMoney } from "@/lib/format-money";

type CategoryExpenseSummaryProps = {
  groups: CategoryExpenseGroup[];
};

export function CategoryExpenseSummary({ groups }: CategoryExpenseSummaryProps) {
  if (!groups.length) {
    return <p className="mt-4 text-slate-500">ບໍ່ມີຂໍ້ມູນ</p>;
  }

  return (
    <div className="mt-4 space-y-6">
      {groups.map((group) => (
        <section key={group.currency} aria-label={`ລາຍຈ່າຍ ${group.currency}`}>
          <div className="flex items-center justify-between font-semibold">
            <span>{group.currency}</span>
            <span>{formatMoney(group.total)} {group.currency}</span>
          </div>
          <div className="mt-3 space-y-3">
            {group.categories.map((category) => (
              <div key={category.id}>
                <div className="flex justify-between gap-4 text-sm">
                  <span className="truncate font-medium">{category.name}</span>
                  <span className="whitespace-nowrap">{formatMoney(category.amount)} {group.currency} ({category.percentage.toFixed(1)}%)</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-red-500" style={{ width: `${category.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
