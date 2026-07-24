import Link from "next/link";
import { BudgetSummary } from "@/components/budget-summary";
import { CategoryExpenseSummary } from "@/components/category-expense-summary";
import { MonthlyIncomeExpenseChart } from "@/components/monthly-income-expense-chart";
import { calculateAccountBalances, parseWholeAmount } from "@/lib/account-balances";
import { createBudgetProgressReport } from "@/lib/budget-reports";
import {
  createCategoryExpenseReport,
  createMonthlyIncomeExpenseReport,
} from "@/lib/dashboard-reports";
import { formatMoney } from "@/lib/format-money";
import { createClient } from "@/lib/supabase/server";

type SelectedPeriod = { month: number; year: number };

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return { start, end: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01` };
}

function getLatestSixMonths(now: Date) {
  const formatter = new Intl.DateTimeFormat("lo-LA", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
    return { key: date.toISOString().slice(0, 7), label: formatter.format(date) };
  });
}

export function DashboardSummaryFallback() {
  return (
    <div className="mt-5 grid gap-3 md:mt-8 md:grid-cols-3 md:gap-4" aria-label="ກຳລັງໂຫຼດສະຫຼຸບ">
      {["income", "expense", "balance"].map((card) => (
        <div key={card} className="h-28 rounded-2xl bg-white shadow-sm" />
      ))}
    </div>
  );
}

export async function DashboardSummary({ userId }: { userId: string }) {
  const supabase = await createClient();
  const now = new Date();
  const currentRange = getMonthRange(now.getUTCFullYear(), now.getUTCMonth() + 1);
  const [profileResult, accountsResult, transactionsResult] = await Promise.all([
    supabase.from("profiles").select("default_currency").eq("id", userId).single(),
    supabase.from("accounts").select("currency").eq("user_id", userId),
    supabase
      .from("transactions")
      .select("transaction_date, type, amount, currency")
      .eq("user_id", userId)
      .gte("transaction_date", currentRange.start)
      .lt("transaction_date", currentRange.end),
  ]);

  if (profileResult.error) throw new Error(profileResult.error.message);
  if (accountsResult.error) throw new Error(accountsResult.error.message);
  if (transactionsResult.error) throw new Error(transactionsResult.error.message);

  const transactions = (transactionsResult.data ?? []).map((transaction) => ({
    ...transaction,
    amount: parseWholeAmount(transaction.amount, "ຈຳນວນເງິນຂອງລາຍການ"),
  }));
  const groups = createMonthlyIncomeExpenseReport(
    transactions,
    [{ key: currentRange.start.slice(0, 7), label: "" }],
    (accountsResult.data ?? []).map((account) => account.currency),
  );
  const defaultCurrency = profileResult.data?.default_currency ?? "LAK";

  return (
    <div className="mt-5 grid gap-3 md:mt-8 md:grid-cols-3 md:gap-4">
      <SummaryCard label="ລາຍຮັບເດືອນນີ້" className="text-emerald-600" groups={groups} value="income" defaultCurrency={defaultCurrency} />
      <SummaryCard label="ລາຍຈ່າຍເດືອນນີ້" className="text-red-600" groups={groups} value="expense" defaultCurrency={defaultCurrency} />
      <SummaryCard label="ເງິນຄົງເຫຼືອ" className="text-slate-900" groups={groups} value="balance" defaultCurrency={defaultCurrency} />
    </div>
  );
}

function SummaryCard({ className, defaultCurrency, groups, label, value }: {
  className: string;
  defaultCurrency: string;
  groups: ReturnType<typeof createMonthlyIncomeExpenseReport>;
  label: string;
  value: "income" | "expense" | "balance";
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <div className={`mt-2 space-y-1 text-2xl font-bold ${className}`}>
        {groups.map((group) => {
          const amount = value === "balance" ? group.months[0].income - group.months[0].expense : group.months[0][value];
          return <p key={group.currency} className={value === "balance" && amount < 0 ? "text-red-600" : undefined}>{formatMoney(amount)} {group.currency}</p>;
        })}
        {!groups.length && <p>0 {defaultCurrency}</p>}
      </div>
    </section>
  );
}

export function DashboardDetailsFallback() {
  return <div className="mt-8 h-44 rounded-2xl bg-white shadow-sm" aria-label="ກຳລັງໂຫຼດລາຍງານ" />;
}

export async function DashboardDetails({ userId, selectedPeriod }: { userId: string; selectedPeriod: SelectedPeriod }) {
  const supabase = await createClient();
  const now = new Date();
  const currentRange = getMonthRange(now.getUTCFullYear(), now.getUTCMonth() + 1);
  const selectedRange = getMonthRange(selectedPeriod.year, selectedPeriod.month);
  const latestSixMonths = getLatestSixMonths(now);
  const chartRange = { start: `${latestSixMonths[0].key}-01`, end: currentRange.end };
  const [accountsResult, categoriesResult, balanceTransactionsResult, chartTransactionsResult, categoryExpenseResult, budgetsResult, recurringResult, goalsResult, transactionsResult] = await Promise.all([
    supabase.from("accounts").select("id, name, account_type, currency, initial_balance, is_active").eq("user_id", userId).order("created_at"),
    supabase.from("categories").select("id, name, type").eq("user_id", userId).eq("is_active", true).order("name"),
    supabase.from("transactions").select("type, amount, account_id, destination_account_id, currency").eq("user_id", userId),
    supabase.from("transactions").select("transaction_date, type, amount, currency").eq("user_id", userId).gte("transaction_date", chartRange.start).lt("transaction_date", chartRange.end),
    supabase.from("transactions").select("amount, currency, category_id, categories ( name )").eq("user_id", userId).eq("type", "expense").gte("transaction_date", selectedRange.start).lt("transaction_date", selectedRange.end),
    supabase.from("budgets").select("id, category_id, amount, currency, categories ( name, is_active )").eq("user_id", userId).eq("month", selectedPeriod.month).eq("year", selectedPeriod.year).order("currency"),
    supabase.from("recurring_transactions").select("id, name, next_due_date, amount, currency, is_active").eq("user_id", userId).eq("is_active", true).order("next_due_date").limit(5),
    supabase.from("savings_goals").select("id, name, target_amount, currency, target_date, is_active").eq("user_id", userId).eq("is_active", true).order("target_date").limit(5),
    supabase.from("transactions").select("id, transaction_date, type, amount, description, currency, created_at").eq("user_id", userId).gte("transaction_date", currentRange.start).lt("transaction_date", currentRange.end).order("transaction_date", { ascending: false }).order("created_at", { ascending: false }),
  ]);

  for (const result of [accountsResult, categoriesResult, balanceTransactionsResult, chartTransactionsResult, categoryExpenseResult, budgetsResult, recurringResult, goalsResult, transactionsResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const accounts = accountsResult.data ?? [];
  const { accounts: accountBalances, totalsByCurrency } = calculateAccountBalances(accounts, balanceTransactionsResult.data ?? []);
  const chartGroups = createMonthlyIncomeExpenseReport(chartTransactionsResult.data ?? [], latestSixMonths, accountBalances.map((account) => account.currency));
  const categoryExpenseTransactions = (categoryExpenseResult.data ?? []).map((transaction) => {
    const category = Array.isArray(transaction.categories) ? transaction.categories[0] : transaction.categories;
    return { amount: transaction.amount, currency: transaction.currency, category_id: transaction.category_id, categoryName: category?.name ?? "ບໍ່ມີໝວດໝູ່" };
  });
  const budgetProgress = createBudgetProgressReport((budgetsResult.data ?? []).map((budget) => {
    const category = Array.isArray(budget.categories) ? budget.categories[0] : budget.categories;
    return { ...budget, categoryName: category?.name ?? "ບໍ່ພົບໝວດໝູ່", categoryIsActive: category?.is_active ?? false };
  }), categoryExpenseResult.data ?? []);
  const recurringItems = recurringResult.data ?? [];
  const activeGoals = goalsResult.data ?? [];
  const overdueRecurringCount = recurringItems.filter((item) => item.next_due_date <= new Date().toISOString().slice(0, 10)).length;
  const categoryExpenseGroups = createCategoryExpenseReport(categoryExpenseTransactions);
  const transactions = (transactionsResult.data ?? []).map((transaction) => ({ ...transaction, amount: parseWholeAmount(transaction.amount, "ຈຳນວນເງິນຂອງລາຍການ") }));

  return <DashboardReports accountBalances={accountBalances} activeGoals={activeGoals} budgetProgress={budgetProgress} categoriesCount={(categoriesResult.data ?? []).length} categoryExpenseGroups={categoryExpenseGroups} chartGroups={chartGroups} overdueRecurringCount={overdueRecurringCount} recurringItems={recurringItems} selectedPeriod={selectedPeriod} totalsByCurrency={totalsByCurrency} transactions={transactions} />;
}

type DashboardReportsProps = { accountBalances: ReturnType<typeof calculateAccountBalances>["accounts"]; activeGoals: Array<{ id: string; name: string; target_amount: number | string; currency: string; target_date: string | null }>; budgetProgress: ReturnType<typeof createBudgetProgressReport>; categoriesCount: number; categoryExpenseGroups: ReturnType<typeof createCategoryExpenseReport>; chartGroups: ReturnType<typeof createMonthlyIncomeExpenseReport>; overdueRecurringCount: number; recurringItems: Array<{ id: string; name: string; next_due_date: string; amount: number | string; currency: string }>; selectedPeriod: SelectedPeriod; totalsByCurrency: ReturnType<typeof calculateAccountBalances>["totalsByCurrency"]; transactions: Array<{ id: string; transaction_date: string; type: string; amount: number; description: string | null; currency: string }> };

function DashboardReports({ accountBalances, activeGoals, budgetProgress, categoriesCount, categoryExpenseGroups, chartGroups, overdueRecurringCount, recurringItems, selectedPeriod, totalsByCurrency, transactions }: DashboardReportsProps) {
  return <>
    <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">ງົບປະມານ</h2><p className="mt-1 text-sm text-slate-500">ເດືອນ {selectedPeriod.month} ປີ {selectedPeriod.year}</p></div><Link href={`/budgets?month=${selectedPeriod.month}&year=${selectedPeriod.year}`} className="text-sm font-semibold text-emerald-700 underline">ຈັດການງົບປະມານ</Link></div><BudgetSummary budgets={budgetProgress} /></section>
    <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><div className="flex justify-between"><h2 className="text-lg font-semibold">ເປົ້າໝາຍການອອມ</h2><Link href="/goals" className="text-sm font-semibold text-emerald-700 underline">ເບິ່ງທັງໝົດ</Link></div><div className="mt-4 space-y-2">{activeGoals.map((goal) => <div key={goal.id} className="flex flex-col gap-1 rounded-lg border border-slate-200 p-3 sm:flex-row sm:justify-between"><span className="break-words">{goal.name}</span><span className="break-words">{formatMoney(Number(goal.target_amount))} {goal.currency}{goal.target_date ? ` · ${goal.target_date}` : ""}</span></div>)}{!activeGoals.length && <p className="text-slate-500">ຍັງບໍ່ມີເປົ້າໝາຍ</p>}</div></section>
    <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">ລາຍການປະຈຳ</h2><p className={overdueRecurringCount ? "mt-1 text-sm font-semibold text-red-700" : "mt-1 text-sm text-slate-500"}>ຄົບກຳນົດແລ້ວ {overdueRecurringCount} ລາຍການ</p></div><Link href="/recurring" className="text-sm font-semibold text-emerald-700 underline">ລາຍການປະຈຳ</Link></div><div className="mt-4 space-y-2">{recurringItems.map((item) => <div key={item.id} className="flex justify-between gap-4 rounded-lg border border-slate-200 p-3"><span>{item.name}</span><span className="text-right text-sm text-slate-600">{item.next_due_date} · {formatMoney(Number(item.amount))} {item.currency}</span></div>)}{!recurringItems.length && <p className="text-slate-500">ຍັງບໍ່ມີລາຍການປະຈຳ</p>}</div></section>
    <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-semibold">ລາຍຮັບ–ລາຍຈ່າຍ 6 ເດືອນຫຼ້າສຸດ</h2><MonthlyIncomeExpenseChart groups={chartGroups} /></section>
    <div className="mt-8 grid gap-6 md:grid-cols-2"><section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-semibold">ຍອດເງິນໃນແຕ່ລະບັນຊີ</h2><div className="mt-4 space-y-3">{accountBalances.map((account) => <div key={account.id} className="flex justify-between rounded-lg border border-slate-200 p-3"><div><p>{account.name}</p>{!account.is_active && <p className="mt-1 text-sm text-slate-500">ປິດໃຊ້ງານ</p>}</div><div className="text-right"><p className="text-sm text-slate-500">ຍອດຄົງເຫຼືອ</p><p className={`font-semibold ${account.balance > 0 ? "text-emerald-600" : account.balance < 0 ? "text-red-600" : "text-slate-700"}`}>{formatMoney(account.balance)} {account.currency}</p></div></div>)}{!accountBalances.length && <p className="text-slate-500">ຍັງບໍ່ມີບັນຊີ</p>}</div>{!!totalsByCurrency.length && <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">{totalsByCurrency.map((total) => <div key={total.currency} className="flex justify-between font-semibold"><span>ລວມທັງໝົດ</span><span className={total.total > 0 ? "text-emerald-600" : total.total < 0 ? "text-red-600" : "text-slate-700"}>{formatMoney(total.total)} {total.currency}</span></div>)}</div>}</section><section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-semibold">ໝວດໝູ່</h2><p className="mt-4 text-3xl font-bold">{categoriesCount}</p><p className="text-sm text-slate-500">ຈຳນວນໝວດລາຍຮັບ–ລາຍຈ່າຍ</p></section></div>
    <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-lg font-semibold">ລາຍຈ່າຍຕາມໝວດໝູ່</h2><form action="/dashboard" className="flex gap-2"><select name="month" defaultValue={selectedPeriod.month} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 [color-scheme:light]">{Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{month}</option>)}</select><input name="year" type="number" min="1" max="9999" defaultValue={selectedPeriod.year} className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" /><button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">ເບິ່ງ</button></form></div><CategoryExpenseSummary groups={categoryExpenseGroups} /></section>
    <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">ລາຍການເດືອນນີ້</h2><span className="text-sm text-slate-500">{transactions.length} ລາຍການ</span></div><div className="mt-4 space-y-3">{transactions.slice(0, 10).map((transaction) => { const isTransfer = transaction.type === "transfer"; return <div key={transaction.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4"><div><p className="font-medium">{transaction.description}</p><p className="mt-1 text-sm text-slate-500">{transaction.transaction_date}</p></div><p className={`font-semibold ${isTransfer ? "text-blue-600" : transaction.type === "income" ? "text-emerald-600" : "text-red-600"}`}>{!isTransfer && (transaction.type === "income" ? "+" : "-")}{formatMoney(transaction.amount)} {transaction.currency}</p></div>; })}{!transactions.length && <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">ຍັງບໍ່ມີລາຍການໃນເດືອນນີ້</div>}</div></section>
  </>;
}
