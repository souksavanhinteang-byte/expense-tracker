import { addWholeAmounts, parseWholeAmount } from "@/lib/account-balances";

type IncomeExpenseTransaction = {
  transaction_date: string;
  type: string;
  amount: unknown;
  currency: string;
};

type CategoryExpenseTransaction = {
  amount: unknown;
  currency: string;
  category_id: string | null;
  categoryName: string;
};

export type MonthlyIncomeExpenseGroup = {
  currency: string;
  months: Array<{
    key: string;
    label: string;
    income: number;
    expense: number;
  }>;
};

export type CategoryExpenseGroup = {
  currency: string;
  total: number;
  categories: Array<{
    id: string;
    name: string;
    amount: number;
    percentage: number;
  }>;
};

function validateTransactionDate(transactionDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
    throw new Error("ວັນທີຂອງລາຍການບໍ່ຖືກຕ້ອງ");
  }

  return transactionDate.slice(0, 7);
}

function validatePositiveAmount(value: unknown) {
  const amount = parseWholeAmount(value, "ຈຳນວນເງິນຂອງລາຍການ");

  if (amount <= 0) {
    throw new Error("ຈຳນວນເງິນຂອງລາຍການຕ້ອງເປັນເລກເຕັມບວກ");
  }

  return amount;
}

export function createMonthlyIncomeExpenseReport(
  transactions: IncomeExpenseTransaction[],
  months: Array<{ key: string; label: string }>,
  currencies: string[] = [],
) {
  const groups = new Map<string, MonthlyIncomeExpenseGroup>();
  const monthKeys = new Set(months.map((month) => month.key));

  for (const currency of currencies) {
    groups.set(currency, {
      currency,
      months: months.map((month) => ({ ...month, income: 0, expense: 0 })),
    });
  }

  for (const transaction of transactions) {
    const monthKey = validateTransactionDate(transaction.transaction_date);
    const amount = validatePositiveAmount(transaction.amount);

    if (transaction.type === "transfer") {
      continue;
    }

    if (transaction.type !== "income" && transaction.type !== "expense") {
      throw new Error("ພົບປະເພດລາຍການທີ່ບໍ່ຮອງຮັບ");
    }

    if (!monthKeys.has(monthKey)) {
      continue;
    }

    let group = groups.get(transaction.currency);

    if (!group) {
      group = {
        currency: transaction.currency,
        months: months.map((month) => ({ ...month, income: 0, expense: 0 })),
      };
      groups.set(transaction.currency, group);
    }

    const month = group.months.find((item) => item.key === monthKey);

    if (!month) {
      throw new Error("ບໍ່ພົບເດືອນສຳລັບລາຍງານ");
    }

    if (transaction.type === "income") {
      month.income = addWholeAmounts(month.income, amount, "ລາຍຮັບປະຈຳເດືອນ");
    } else {
      month.expense = addWholeAmounts(month.expense, amount, "ລາຍຈ່າຍປະຈຳເດືອນ");
    }
  }

  return Array.from(groups.values()).sort((left, right) =>
    left.currency.localeCompare(right.currency),
  );
}

export function createCategoryExpenseReport(transactions: CategoryExpenseTransaction[]) {
  const groups = new Map<
    string,
    { total: number; categories: Map<string, { name: string; amount: number }> }
  >();

  for (const transaction of transactions) {
    const amount = validatePositiveAmount(transaction.amount);
    let group = groups.get(transaction.currency);

    if (!group) {
      group = { total: 0, categories: new Map() };
      groups.set(transaction.currency, group);
    }

    const categoryId = transaction.category_id ?? "uncategorized";
    const category = group.categories.get(categoryId) ?? {
      name: transaction.categoryName,
      amount: 0,
    };

    category.amount = addWholeAmounts(category.amount, amount, "ລາຍຈ່າຍຕາມໝວດໝູ່");
    group.categories.set(categoryId, category);
    group.total = addWholeAmounts(group.total, amount, "ລາຍຈ່າຍລວມ");
  }

  return Array.from(groups, ([currency, group]) => ({
    currency,
    total: group.total,
    categories: Array.from(group.categories, ([id, category]) => ({
      id,
      name: category.name,
      amount: category.amount,
      percentage: (category.amount / group.total) * 100,
    })).sort((left, right) => right.amount - left.amount),
  })).sort((left, right) => left.currency.localeCompare(right.currency)) satisfies CategoryExpenseGroup[];
}
