import Link from "next/link";
import { cache } from "react";
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
import {
  getLatestSixMonths,
  getMonthRange,
  timeDashboardSection,
  type DashboardPeriod,
} from "./dashboard-utils";

const getAccounts = cache(async (userId: string) => {
  const supabase = await createClient();
  const result = await supabase
    .from("accounts")
    .select("id, name, currency, initial_balance, is_active")
    .eq("user_id", userId)
    .order("created_at");

  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
});

const getProfile = cache(async (userId: string) => {
  return timeDashboardSection("profile", async () => {
    const supabase = await createClient();
    const result = await supabase
      .from("profiles")
      .select("default_currency")
      .eq("id", userId)
      .single();

    if (result.error) throw new Error(result.error.message);
    return result.data;
  });
});

export async function DashboardHeader({ userId }: { userId: string }) {
  let currency = "LAK";

  try {
    currency = (await getProfile(userId))?.default_currency ?? "LAK";
  } catch {
    // The header can safely use the application default when the profile label is unavailable.
  }

  return (
    <div>
      <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
        ລະບົບບັນທຶກລາຍຮັບ–ລາຍຈ່າຍ
      </h1>
      <p className="mt-2 text-slate-600">ສະກຸນເງິນຫຼັກ: {currency}</p>
    </div>
  );
}

export function DashboardNavigation() {
  return <nav aria-label="ເມນູຫຼັກ" className="grid w-full grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
    <Link href="/accounts" prefetch={false} className="dashboard-nav-link">ຈັດການບັນຊີ</Link>
    <Link href="/categories" prefetch={false} className="dashboard-nav-link">ຈັດການໝວດໝູ່</Link>
    <Link href="/budgets" prefetch={false} className="dashboard-nav-link">ຈັດການງົບປະມານ</Link>
    <Link href="/recurring" prefetch={false} className="dashboard-nav-link">ລາຍການປະຈຳ</Link>
    <Link href="/goals" prefetch={false} className="dashboard-nav-link">ເປົ້າໝາຍການອອມ</Link>
    <Link href="/transactions" prefetch={false} className="dashboard-nav-link">ເບິ່ງລາຍການ</Link>
    <Link href="/transactions/new" prefetch={false} className="dashboard-nav-link bg-emerald-600 text-white hover:bg-emerald-700">+ ເພີ່ມລາຍການ</Link>
    <Link href="/transfers/new" prefetch={false} className="dashboard-nav-link">ໂອນເງິນ</Link>
    <Link href="/export" prefetch={false} className="dashboard-nav-link">ສຳຮອງຂໍ້ມູນ</Link>
    <Link href="/import" prefetch={false} className="dashboard-nav-link">ນຳເຂົ້າຂໍ້ມູນ</Link>
  </nav>;
}

export function SectionSkeleton({ cards = 1, className }: { cards?: number; className: string }) {
  return (
    <div className={`${className} grid gap-3 ${cards === 3 ? "md:grid-cols-3 md:gap-4" : ""}`} aria-label="ກຳລັງໂຫຼດ">
      {Array.from({ length: cards }, (_, index) => (
        <div key={index} className="h-32 rounded-2xl bg-white shadow-sm" />
      ))}
    </div>
  );
}

function SectionError() {
  return <p className="mt-4 text-sm text-slate-500">ບໍ່ສາມາດໂຫຼດຂໍ້ມູນສ່ວນນີ້ໄດ້</p>;
}

export async function MonthlySummaryCards({
  currentPeriod,
  userId,
}: {
  currentPeriod: DashboardPeriod;
  userId: string;
}) {
  try {
    return await timeDashboardSection("monthly-summary", async () => {
      const supabase = await createClient();
      const range = getMonthRange(currentPeriod.year, currentPeriod.month);
      const [accounts, profile, transactionsResult] = await Promise.all([
        getAccounts(userId),
        getProfile(userId),
        supabase
          .from("transactions")
          .select("type, amount, currency")
          .eq("user_id", userId)
          .in("type", ["income", "expense"])
          .gte("transaction_date", range.start)
          .lt("transaction_date", range.end),
      ]);

      if (transactionsResult.error) throw new Error(transactionsResult.error.message);
      const groups = createMonthlyIncomeExpenseReport(
        (transactionsResult.data ?? []).map((transaction) => ({
          ...transaction,
          transaction_date: range.start,
        })),
        [{ key: range.start.slice(0, 7), label: "" }],
        accounts.map((account) => account.currency),
      );

      return (
        <div className="mt-5 grid gap-3 md:mt-8 md:grid-cols-3 md:gap-4">
          <SummaryCard defaultCurrency={profile?.default_currency ?? "LAK"} groups={groups} label="ລາຍຮັບເດືອນນີ້" value="income" />
          <SummaryCard defaultCurrency={profile?.default_currency ?? "LAK"} groups={groups} label="ລາຍຈ່າຍເດືອນນີ້" value="expense" />
          <SummaryCard defaultCurrency={profile?.default_currency ?? "LAK"} groups={groups} label="ເງິນຄົງເຫຼືອ" value="balance" />
        </div>
      );
    });
  } catch {
    return <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm md:mt-8"><SectionError /></section>;
  }
}

function SummaryCard({ defaultCurrency, groups, label, value }: {
  defaultCurrency: string;
  groups: ReturnType<typeof createMonthlyIncomeExpenseReport>;
  label: string;
  value: "income" | "expense" | "balance";
}) {
  const className = value === "income" ? "text-emerald-600" : value === "expense" ? "text-red-600" : "text-slate-900";
  return <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5"><p className="text-sm text-slate-500">{label}</p><div className={`mt-2 space-y-1 text-2xl font-bold ${className}`}>{groups.map((group) => { const amount = value === "balance" ? group.months[0].income - group.months[0].expense : group.months[0][value]; return <p key={group.currency} className={value === "balance" && amount < 0 ? "text-red-600" : undefined}>{formatMoney(amount)} {group.currency}</p>; })}{!groups.length && <p>0 {defaultCurrency}</p>}</div></section>;
}

export async function BudgetSummarySection({ selectedPeriod, userId }: { selectedPeriod: DashboardPeriod; userId: string }) {
  try {
    return await timeDashboardSection("budget-summary", async () => {
      const supabase = await createClient();
      const range = getMonthRange(selectedPeriod.year, selectedPeriod.month);
      const [budgetsResult, expensesResult] = await Promise.all([
        supabase.from("budgets").select("id, category_id, amount, currency, categories ( name, is_active )").eq("user_id", userId).eq("month", selectedPeriod.month).eq("year", selectedPeriod.year).order("currency"),
        supabase.from("transactions").select("amount, currency, category_id").eq("user_id", userId).eq("type", "expense").gte("transaction_date", range.start).lt("transaction_date", range.end),
      ]);
      if (budgetsResult.error) throw new Error(budgetsResult.error.message);
      if (expensesResult.error) throw new Error(expensesResult.error.message);
      const budgetProgress = createBudgetProgressReport((budgetsResult.data ?? []).map((budget) => { const category = Array.isArray(budget.categories) ? budget.categories[0] : budget.categories; return { ...budget, categoryName: category?.name ?? "ບໍ່ພົບໝວດໝູ່", categoryIsActive: category?.is_active ?? false }; }), expensesResult.data ?? []);
      return <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">ງົບປະມານ</h2><p className="mt-1 text-sm text-slate-500">ເດືອນ {selectedPeriod.month} ປີ {selectedPeriod.year}</p></div><Link href={`/budgets?month=${selectedPeriod.month}&year=${selectedPeriod.year}`} prefetch={false} className="text-sm font-semibold text-emerald-700 underline">ຈັດການງົບປະມານ</Link></div><BudgetSummary budgets={budgetProgress} /></section>;
    });
  } catch {
    return <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-semibold">ງົບປະມານ</h2><SectionError /></section>;
  }
}

export async function SavingsGoalsSummarySection({ userId }: { userId: string }) {
  try {
    return await timeDashboardSection("savings-goals", async () => {
      const supabase = await createClient();
      const result = await supabase.from("savings_goals").select("id, name, target_amount, currency, target_date").eq("user_id", userId).eq("is_active", true).order("target_date").limit(5);
      if (result.error) throw new Error(result.error.message);
      return <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><div className="flex justify-between"><h2 className="text-lg font-semibold">ເປົ້າໝາຍການອອມ</h2><Link href="/goals" prefetch={false} className="text-sm font-semibold text-emerald-700 underline">ເບິ່ງທັງໝົດ</Link></div><div className="mt-4 space-y-2">{(result.data ?? []).map((goal) => <div key={goal.id} className="flex flex-col gap-1 rounded-lg border border-slate-200 p-3 sm:flex-row sm:justify-between"><span className="break-words">{goal.name}</span><span className="break-words">{formatMoney(Number(goal.target_amount))} {goal.currency}{goal.target_date ? ` · ${goal.target_date}` : ""}</span></div>)}{!result.data?.length && <p className="text-slate-500">ຍັງບໍ່ມີເປົ້າໝາຍ</p>}</div></section>;
    });
  } catch {
    return <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-semibold">ເປົ້າໝາຍການອອມ</h2><SectionError /></section>;
  }
}

export async function RecurringSummarySection({ userId }: { userId: string }) {
  try {
    return await timeDashboardSection("recurring-summary", async () => {
      const supabase = await createClient();
      const result = await supabase.from("recurring_transactions").select("id, name, next_due_date, amount, currency").eq("user_id", userId).eq("is_active", true).order("next_due_date").limit(5);
      if (result.error) throw new Error(result.error.message);
      const recurringItems = result.data ?? [];
      const today = new Date().toISOString().slice(0, 10);
      const overdueCount = recurringItems.filter((item) => item.next_due_date <= today).length;
      return <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">ລາຍການປະຈຳ</h2><p className={overdueCount ? "mt-1 text-sm font-semibold text-red-700" : "mt-1 text-sm text-slate-500"}>ຄົບກຳນົດແລ້ວ {overdueCount} ລາຍການ</p></div><Link href="/recurring" prefetch={false} className="text-sm font-semibold text-emerald-700 underline">ລາຍການປະຈຳ</Link></div><div className="mt-4 space-y-2">{recurringItems.map((item) => <div key={item.id} className="flex justify-between gap-4 rounded-lg border border-slate-200 p-3"><span>{item.name}</span><span className="text-right text-sm text-slate-600">{item.next_due_date} · {formatMoney(Number(item.amount))} {item.currency}</span></div>)}{!recurringItems.length && <p className="text-slate-500">ຍັງບໍ່ມີລາຍການປະຈຳ</p>}</div></section>;
    });
  } catch {
    return <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-semibold">ລາຍການປະຈຳ</h2><SectionError /></section>;
  }
}

export async function FinancialChartSection({ currentPeriod, userId }: { currentPeriod: DashboardPeriod; userId: string }) {
  try {
    return await timeDashboardSection("financial-chart", async () => {
      const supabase = await createClient();
      const now = new Date();
      const months = getLatestSixMonths(now);
      const range = { start: `${months[0].key}-01`, end: getMonthRange(currentPeriod.year, currentPeriod.month).end };
      const [accounts, transactionsResult] = await Promise.all([
        getAccounts(userId),
        supabase.from("transactions").select("transaction_date, type, amount, currency").eq("user_id", userId).in("type", ["income", "expense"]).gte("transaction_date", range.start).lt("transaction_date", range.end),
      ]);
      if (transactionsResult.error) throw new Error(transactionsResult.error.message);
      const groups = createMonthlyIncomeExpenseReport(transactionsResult.data ?? [], months, accounts.map((account) => account.currency));
      return <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-semibold">ລາຍຮັບ–ລາຍຈ່າຍ 6 ເດືອນຫຼ້າສຸດ</h2><MonthlyIncomeExpenseChart groups={groups} /></section>;
    });
  } catch {
    return <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-semibold">ລາຍຮັບ–ລາຍຈ່າຍ 6 ເດືອນຫຼ້າສຸດ</h2><SectionError /></section>;
  }
}

export async function AccountBalancesSection({
  currentPeriod,
  selectedPeriod,
  userId,
}: {
  currentPeriod: DashboardPeriod;
  selectedPeriod: DashboardPeriod;
  userId: string;
}) {
  try {
    return await timeDashboardSection("accounts-and-activity", async () => {
      const supabase = await createClient();
      const currentRange = getMonthRange(currentPeriod.year, currentPeriod.month);
      const selectedRange = getMonthRange(selectedPeriod.year, selectedPeriod.month);
      const [accounts, balanceTransactionsResult, categoriesResult, categoryExpensesResult, recentTransactionsResult] = await Promise.all([
        getAccounts(userId),
        supabase.from("transactions").select("type, amount, account_id, destination_account_id, currency").eq("user_id", userId),
        supabase.from("categories").select("id").eq("user_id", userId).eq("is_active", true),
        supabase.from("transactions").select("amount, currency, category_id, categories ( name )").eq("user_id", userId).eq("type", "expense").gte("transaction_date", selectedRange.start).lt("transaction_date", selectedRange.end),
        supabase.from("transactions").select("id, transaction_date, type, amount, description, currency").eq("user_id", userId).gte("transaction_date", currentRange.start).lt("transaction_date", currentRange.end).order("transaction_date", { ascending: false }).order("created_at", { ascending: false }).limit(10),
      ]);

      for (const result of [balanceTransactionsResult, categoriesResult, categoryExpensesResult, recentTransactionsResult]) {
        if (result.error) throw new Error(result.error.message);
      }

      const { accounts: accountBalances, totalsByCurrency } = calculateAccountBalances(accounts, balanceTransactionsResult.data ?? []);
      const categoryExpenses = (categoryExpensesResult.data ?? []).map((transaction) => {
        const category = Array.isArray(transaction.categories) ? transaction.categories[0] : transaction.categories;
        return { amount: transaction.amount, currency: transaction.currency, category_id: transaction.category_id, categoryName: category?.name ?? "ບໍ່ມີໝວດໝູ່" };
      });
      const recentTransactions = (recentTransactionsResult.data ?? []).map((transaction) => ({
        ...transaction,
        amount: parseWholeAmount(transaction.amount, "ຈຳນວນເງິນຂອງລາຍການ"),
      }));

      return <>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-semibold">ຍອດເງິນໃນແຕ່ລະບັນຊີ</h2><div className="mt-4 space-y-3">{accountBalances.map((account) => <div key={account.id} className="flex justify-between rounded-lg border border-slate-200 p-3"><div><p>{account.name}</p>{!account.is_active && <p className="mt-1 text-sm text-slate-500">ປິດໃຊ້ງານ</p>}</div><div className="text-right"><p className="text-sm text-slate-500">ຍອດຄົງເຫຼືອ</p><p className={`font-semibold ${account.balance > 0 ? "text-emerald-600" : account.balance < 0 ? "text-red-600" : "text-slate-700"}`}>{formatMoney(account.balance)} {account.currency}</p></div></div>)}{!accountBalances.length && <p className="text-slate-500">ຍັງບໍ່ມີບັນຊີ</p>}</div>{!!totalsByCurrency.length && <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">{totalsByCurrency.map((total) => <div key={total.currency} className="flex justify-between font-semibold"><span>ລວມທັງໝົດ</span><span className={total.total > 0 ? "text-emerald-600" : total.total < 0 ? "text-red-600" : "text-slate-700"}>{formatMoney(total.total)} {total.currency}</span></div>)}</div>}</section>
          <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-semibold">ໝວດໝູ່</h2><p className="mt-4 text-3xl font-bold">{categoriesResult.data?.length ?? 0}</p><p className="text-sm text-slate-500">ຈຳນວນໝວດລາຍຮັບ–ລາຍຈ່າຍ</p></section>
        </div>
        <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-lg font-semibold">ລາຍຈ່າຍຕາມໝວດໝູ່</h2><form action="/dashboard" className="flex gap-2"><select name="month" defaultValue={selectedPeriod.month} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 [color-scheme:light]">{Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{month}</option>)}</select><input name="year" type="number" min="1" max="9999" defaultValue={selectedPeriod.year} className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900" /><button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">ເບິ່ງ</button></form></div><CategoryExpenseSummary groups={createCategoryExpenseReport(categoryExpenses)} /></section>
        <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">ລາຍການເດືອນນີ້</h2><span className="text-sm text-slate-500">{recentTransactions.length} ລາຍການ</span></div><div className="mt-4 space-y-3">{recentTransactions.map((transaction) => { const isTransfer = transaction.type === "transfer"; return <div key={transaction.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4"><div><p className="font-medium">{transaction.description}</p><p className="mt-1 text-sm text-slate-500">{transaction.transaction_date}</p></div><p className={`font-semibold ${isTransfer ? "text-blue-600" : transaction.type === "income" ? "text-emerald-600" : "text-red-600"}`}>{!isTransfer && (transaction.type === "income" ? "+" : "-")}{formatMoney(transaction.amount)} {transaction.currency}</p></div>; })}{!recentTransactions.length && <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">ຍັງບໍ່ມີລາຍການໃນເດືອນນີ້</div>}</div></section>
      </>;
    });
  } catch {
    return <section className="mt-8 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-semibold">ຂໍ້ມູນບັນຊີ</h2><SectionError /></section>;
  }
}
