import Link from "next/link";
import { redirect } from "next/navigation";
import { CategoryExpenseSummary } from "@/components/category-expense-summary";
import { MonthlyIncomeExpenseChart } from "@/components/monthly-income-expense-chart";
import { calculateAccountBalances, parseWholeAmount } from "@/lib/account-balances";
import {
  createCategoryExpenseReport,
  createMonthlyIncomeExpenseReport,
} from "@/lib/dashboard-reports";
import { formatMoney } from "@/lib/format-money";
import { createClient } from "@/lib/supabase/server";

type DashboardPageProps = {
  searchParams: Promise<{
    month?: string | string[];
    year?: string | string[];
  }>;
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    start,
    end: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
  };
}

function getLatestSixMonths(now: Date) {
  const months = [];
  const formatter = new Intl.DateTimeFormat("lo-LA", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    months.push({
      key: date.toISOString().slice(0, 7),
      label: formatter.format(date),
    });
  }

  return months;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const selectedMonthValue = Number(getSearchParam(params.month));
  const selectedYearValue = Number(getSearchParam(params.year));
  const selectedMonth = Number.isInteger(selectedMonthValue) && selectedMonthValue >= 1 && selectedMonthValue <= 12
    ? selectedMonthValue
    : currentMonth;
  const selectedYear = Number.isInteger(selectedYearValue) && selectedYearValue >= 1 && selectedYearValue <= 9999
    ? selectedYearValue
    : currentYear;
  const currentMonthRange = getMonthRange(currentYear, currentMonth);
  const selectedMonthRange = getMonthRange(selectedYear, selectedMonth);
  const latestSixMonths = getLatestSixMonths(now);
  const chartRange = {
    start: `${latestSixMonths[0].key}-01`,
    end: currentMonthRange.end,
  };

  const [
    profileResult,
    accountsResult,
    categoriesResult,
    transactionsResult,
    balanceTransactionsResult,
    chartTransactionsResult,
    categoryExpenseResult,
  ] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, default_currency, timezone")
        .eq("id", user.id)
        .single(),

      supabase
        .from("accounts")
        .select("id, name, account_type, currency, initial_balance, is_active")
        .eq("user_id", user.id)
        .order("created_at"),

      supabase
        .from("categories")
        .select("id, name, type")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("name"),

      supabase
        .from("transactions")
        .select(
          "id, transaction_date, type, amount, description, currency, created_at",
        )
        .eq("user_id", user.id)
        .gte("transaction_date", currentMonthRange.start)
        .lt("transaction_date", currentMonthRange.end)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false }),

      supabase
        .from("transactions")
        .select("type, amount, account_id, destination_account_id, currency")
        .eq("user_id", user.id),

      supabase
        .from("transactions")
        .select("transaction_date, type, amount, currency")
        .eq("user_id", user.id)
        .gte("transaction_date", chartRange.start)
        .lt("transaction_date", chartRange.end),

      supabase
        .from("transactions")
        .select("amount, currency, category_id, categories ( name )")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .gte("transaction_date", selectedMonthRange.start)
        .lt("transaction_date", selectedMonthRange.end),
    ]);

  if (profileResult.error) {
    throw new Error(profileResult.error.message);
  }

  if (accountsResult.error) {
    throw new Error(accountsResult.error.message);
  }

  if (categoriesResult.error) {
    throw new Error(categoriesResult.error.message);
  }

  if (transactionsResult.error) {
    throw new Error(transactionsResult.error.message);
  }

  if (balanceTransactionsResult.error) {
    throw new Error(balanceTransactionsResult.error.message);
  }

  if (chartTransactionsResult.error) {
    throw new Error(chartTransactionsResult.error.message);
  }

  if (categoryExpenseResult.error) {
    throw new Error(categoryExpenseResult.error.message);
  }

  const profile = profileResult.data;
  const accounts = accountsResult.data ?? [];
  const categories = categoriesResult.data ?? [];
  const transactions = transactionsResult.data ?? [];
  const currentTransactions = transactions.map((transaction) => ({
    ...transaction,
    amount: parseWholeAmount(transaction.amount, "ຈຳນວນເງິນຂອງລາຍການ"),
  }));
  const { accounts: accountBalances, totalsByCurrency } = calculateAccountBalances(
    accounts,
    balanceTransactionsResult.data ?? [],
  );
  const currentMonthGroups = createMonthlyIncomeExpenseReport(
    currentTransactions,
    [{ key: currentMonthRange.start.slice(0, 7), label: "" }],
    accountBalances.map((account) => account.currency),
  );
  const chartGroups = createMonthlyIncomeExpenseReport(
    chartTransactionsResult.data ?? [],
    latestSixMonths,
    accountBalances.map((account) => account.currency),
  );
  const categoryExpenseTransactions = (categoryExpenseResult.data ?? []).map((transaction) => {
    const category = Array.isArray(transaction.categories)
      ? transaction.categories[0]
      : transaction.categories;

    return {
      amount: transaction.amount,
      currency: transaction.currency,
      category_id: transaction.category_id,
      categoryName: category?.name ?? "ບໍ່ມີໝວດໝູ່",
    };
  });
  const categoryExpenseGroups = createCategoryExpenseReport(categoryExpenseTransactions);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">ລະບົບບັນທຶກລາຍຮັບ–ລາຍຈ່າຍ</h1>

            <p className="mt-2 text-slate-600">
              ສະກຸນເງິນຫຼັກ: {profile?.default_currency ?? "LAK"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/accounts"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center font-semibold hover:bg-slate-100"
            >
              ຈັດການບັນຊີ
            </Link>

            <Link
              href="/categories"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center font-semibold hover:bg-slate-100"
            >
              ຈັດການໝວດໝູ່
            </Link>

            <Link
              href="/transactions"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center font-semibold hover:bg-slate-100"
            >
              ເບິ່ງລາຍການ
            </Link>

            <Link
              href="/transactions/new"
              className="rounded-lg bg-emerald-600 px-5 py-3 text-center font-semibold text-white hover:bg-emerald-700"
            >
              + ເພີ່ມລາຍການ
            </Link>

            <Link
              href="/transfers/new"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center font-semibold hover:bg-slate-100"
            >
              ໂອນເງິນ
            </Link>

            <Link
              href="/export"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center font-semibold hover:bg-slate-100"
            >
              ສຳຮອງຂໍ້ມູນ
            </Link>

            <Link
              href="/import"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center font-semibold hover:bg-slate-100"
            >
              ນຳເຂົ້າຂໍ້ມູນ
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">ລາຍຮັບເດືອນນີ້</p>

            <div className="mt-2 space-y-1 text-2xl font-bold text-emerald-600">
              {currentMonthGroups.map((group) => (
                <p key={group.currency}>{formatMoney(group.months[0].income)} {group.currency}</p>
              ))}
              {!currentMonthGroups.length && <p>0 {profile?.default_currency ?? "LAK"}</p>}
            </div>
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">ລາຍຈ່າຍເດືອນນີ້</p>

            <div className="mt-2 space-y-1 text-2xl font-bold text-red-600">
              {currentMonthGroups.map((group) => (
                <p key={group.currency}>{formatMoney(group.months[0].expense)} {group.currency}</p>
              ))}
              {!currentMonthGroups.length && <p>0 {profile?.default_currency ?? "LAK"}</p>}
            </div>
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">ເງິນຄົງເຫຼືອ</p>

            <div className="mt-2 space-y-1 text-2xl font-bold">
              {currentMonthGroups.map((group) => {
                const netBalance = group.months[0].income - group.months[0].expense;

                return (
                  <p key={group.currency} className={netBalance >= 0 ? "text-slate-900" : "text-red-600"}>
                    {formatMoney(netBalance)} {group.currency}
                  </p>
                );
              })}
              {!currentMonthGroups.length && <p>0 {profile?.default_currency ?? "LAK"}</p>}
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">ລາຍຮັບ–ລາຍຈ່າຍ 6 ເດືອນຫຼ້າສຸດ</h2>
          <MonthlyIncomeExpenseChart groups={chartGroups} />
        </section>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">ຍອດເງິນໃນແຕ່ລະບັນຊີ</h2>

            <div className="mt-4 space-y-3">
              {accountBalances.map((account) => (
                <div
                  key={account.id}
                  className="flex justify-between rounded-lg border border-slate-200 p-3"
                >
                  <div>
                    <p>{account.name}</p>
                    {!account.is_active && (
                      <p className="mt-1 text-sm text-slate-500">ປິດໃຊ້ງານ</p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-slate-500">ຍອດຄົງເຫຼືອ</p>
                    <p
                      className={`font-semibold ${
                        account.balance > 0
                          ? "text-emerald-600"
                          : account.balance < 0
                            ? "text-red-600"
                            : "text-slate-700"
                      }`}
                    >
                      {formatMoney(account.balance)} {account.currency}
                    </p>
                  </div>
                </div>
              ))}

              {!accountBalances.length && (
                <p className="text-slate-500">ຍັງບໍ່ມີບັນຊີ</p>
              )}
            </div>

            {!!totalsByCurrency.length && (
              <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
                {totalsByCurrency.map((total) => (
                  <div key={total.currency} className="flex justify-between font-semibold">
                    <span>ລວມທັງໝົດ</span>
                    <span
                      className={
                        total.total > 0
                          ? "text-emerald-600"
                          : total.total < 0
                            ? "text-red-600"
                            : "text-slate-700"
                      }
                    >
                      {formatMoney(total.total)} {total.currency}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">ໝວດໝູ່</h2>

            <p className="mt-4 text-3xl font-bold">{categories.length}</p>

            <p className="text-sm text-slate-500">ຈຳນວນໝວດລາຍຮັບ–ລາຍຈ່າຍ</p>
          </section>
        </div>

        <section className="mt-8 rounded-xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">ລາຍຈ່າຍຕາມໝວດໝູ່</h2>

            <form action="/dashboard" className="flex gap-2">
              <select
                name="month"
                defaultValue={selectedMonth}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 [color-scheme:light]"
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
              <input
                name="year"
                type="number"
                min="1"
                max="9999"
                defaultValue={selectedYear}
                className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
              />
              <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">
                ເບິ່ງ
              </button>
            </form>
          </div>

          <CategoryExpenseSummary groups={categoryExpenseGroups} />
        </section>

        <section className="mt-8 rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">ລາຍການເດືອນນີ້</h2>

            <span className="text-sm text-slate-500">
              {transactions.length} ລາຍການ
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {currentTransactions.slice(0, 10).map((transaction) => {
              const isTransfer = transaction.type === "transfer";

              return (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4"
                >
                  <div>
                    <p className="font-medium">{transaction.description}</p>

                    <p className="mt-1 text-sm text-slate-500">
                      {transaction.transaction_date}
                    </p>
                  </div>

                  <p
                    className={`font-semibold ${
                      isTransfer
                        ? "text-blue-600"
                        : transaction.type === "income"
                          ? "text-emerald-600"
                          : "text-red-600"
                    }`}
                  >
                    {!isTransfer && (transaction.type === "income" ? "+" : "-")}
                    {formatMoney(transaction.amount)} {transaction.currency}
                  </p>
                </div>
              );
            })}

            {!currentTransactions.length && (
              <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
                ຍັງບໍ່ມີລາຍການໃນເດືອນນີ້
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
