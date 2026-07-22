import { addWholeAmounts, parseWholeAmount } from "@/lib/account-balances";

type BudgetSource = {
  id: string;
  category_id: string;
  amount: unknown;
  currency: string;
  categoryName: string;
  categoryIsActive: boolean;
};

type ExpenseSource = {
  category_id: string | null;
  amount: unknown;
  currency: string;
};

export type BudgetProgress = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIsActive: boolean;
  currency: string;
  budget: number;
  spent: number;
  remaining: number;
  percentage: number;
};

export function createBudgetProgressReport(
  budgets: BudgetSource[],
  expenses: ExpenseSource[],
): BudgetProgress[] {
  const spentByBudgetKey = new Map<string, number>();

  for (const expense of expenses) {
    if (!expense.category_id) {
      continue;
    }

    const amount = parseWholeAmount(expense.amount, "ຈຳນວນເງິນລາຍຈ່າຍ");
    if (amount <= 0) {
      throw new Error("ຈຳນວນເງິນລາຍຈ່າຍຕ້ອງເປັນເລກເຕັມບວກ");
    }

    const key = `${expense.category_id}:${expense.currency}`;
    spentByBudgetKey.set(
      key,
      addWholeAmounts(spentByBudgetKey.get(key) ?? 0, amount, "ລາຍຈ່າຍຕາມງົບ"),
    );
  }

  return budgets.map((budget) => {
    const amount = parseWholeAmount(budget.amount, "ຈຳນວນເງິນງົບປະມານ");
    if (amount <= 0) {
      throw new Error("ຈຳນວນເງິນງົບປະມານຕ້ອງເປັນເລກເຕັມບວກ");
    }

    const spent = spentByBudgetKey.get(`${budget.category_id}:${budget.currency}`) ?? 0;
    return {
      id: budget.id,
      categoryId: budget.category_id,
      categoryName: budget.categoryName,
      categoryIsActive: budget.categoryIsActive,
      currency: budget.currency,
      budget: amount,
      spent,
      remaining: amount - spent,
      percentage: (spent / amount) * 100,
    };
  }).sort((left, right) =>
    left.currency.localeCompare(right.currency) || left.categoryName.localeCompare(right.categoryName),
  );
}
