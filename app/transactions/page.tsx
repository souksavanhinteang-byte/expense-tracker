import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DeleteTransactionButton } from "@/components/delete-transaction-button";
import { createClient } from "@/lib/supabase/server";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("lo-LA").format(amount);
}

type TransactionsPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    type?: string | string[];
    month?: string | string[];
    year?: string | string[];
    category?: string | string[];
    account?: string | string[];
    page?: string | string[];
  }>;
};

const pageSize = 25;

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function escapeFilterValue(value: string) {
  return value.replace(/[\\%_]/g, "\\\\$&").replace(/[(),]/g, "");
}

function getPageNumber(value: string | string[] | undefined) {
  const page = Number(getSearchParam(value));

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function getTransactionsPageHref({
  keyword,
  type,
  month,
  year,
  categoryId,
  accountId,
  page,
}: {
  keyword: string;
  type: string;
  month?: number;
  year?: number;
  categoryId: string;
  accountId: string;
  page: number;
}) {
  const searchParams = new URLSearchParams();

  if (keyword) searchParams.set("q", keyword);
  if (type) searchParams.set("type", type);
  if (month) searchParams.set("month", String(month));
  if (year) searchParams.set("year", String(year));
  if (categoryId) searchParams.set("category", categoryId);
  if (accountId) searchParams.set("account", accountId);
  if (page > 1) searchParams.set("page", String(page));

  const query = searchParams.toString();
  return query ? `/transactions?${query}` : "/transactions";
}

const filterControlClassName =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 [color-scheme:light]";

async function deleteTransaction(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const transactionId = String(formData.get("transaction_id") ?? "");

  if (!transactionId) {
    throw new Error("ບໍ່ພົບລາຍການທີ່ຕ້ອງການລຶບ");
  }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const params = await searchParams;
  const keyword = getSearchParam(params.q)?.trim() ?? "";
  const selectedType = getSearchParam(params.type);
  const type = selectedType === "income" || selectedType === "expense" || selectedType === "transfer"
    ? selectedType
    : "";
  const selectedMonth = Number(getSearchParam(params.month));
  const month = Number.isInteger(selectedMonth) && selectedMonth >= 1 && selectedMonth <= 12
    ? selectedMonth
    : undefined;
  const selectedYear = Number(getSearchParam(params.year));
  const year = Number.isInteger(selectedYear) && selectedYear >= 1 && selectedYear <= 9999
    ? selectedYear
    : undefined;
  const categoryId = getSearchParam(params.category) ?? "";
  const accountId = getSearchParam(params.account) ?? "";
  const requestedPage = getPageNumber(params.page);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  let monthYears: number[] = [];

  if (month && !year) {
    const [earliestTransactionResult, latestTransactionResult] = await Promise.all([
      supabase
        .from("transactions")
        .select("transaction_date")
        .eq("user_id", user.id)
        .order("transaction_date")
        .limit(1),
      supabase
        .from("transactions")
        .select("transaction_date")
        .eq("user_id", user.id)
        .order("transaction_date", { ascending: false })
        .limit(1),
    ]);

    if (earliestTransactionResult.error || latestTransactionResult.error) {
      throw new Error(
        earliestTransactionResult.error?.message ?? latestTransactionResult.error?.message,
      );
    }

    const earliestYear = Number(earliestTransactionResult.data?.[0]?.transaction_date.slice(0, 4));
    const latestYear = Number(latestTransactionResult.data?.[0]?.transaction_date.slice(0, 4));

    if (Number.isInteger(earliestYear) && Number.isInteger(latestYear)) {
      monthYears = Array.from(
        { length: latestYear - earliestYear + 1 },
        (_, index) => earliestYear + index,
      );
    }
  }

  let transactionsQuery = supabase
    .from("transactions")
    .select(`
      id,
      transaction_date,
      type,
      amount,
      description,
      currency,
      note,
      created_at,
      categories (
        name
      ),
      accounts!transactions_account_id_fkey (
        name
      ),
      destination_account:accounts!transactions_destination_account_id_fkey (
        name
      )
    `, { count: "exact" })
    .eq("user_id", user.id);

  if (keyword) {
    const filterKeyword = escapeFilterValue(keyword);
    transactionsQuery = transactionsQuery.or(
      `description.ilike.%${filterKeyword}%,note.ilike.%${filterKeyword}%`,
    );
  }

  if (type) {
    transactionsQuery = transactionsQuery.eq("type", type);
  }

  if (categoryId) {
    transactionsQuery = transactionsQuery.eq("category_id", categoryId);
  }

  if (accountId) {
    transactionsQuery = transactionsQuery.eq("account_id", accountId);
  }

  if (year && month) {
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonthYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthStart = `${nextMonthYear}-${String(nextMonth).padStart(2, "0")}-01`;

    transactionsQuery = transactionsQuery
      .gte("transaction_date", monthStart)
      .lt("transaction_date", nextMonthStart);
  } else if (year) {
    transactionsQuery = transactionsQuery
      .gte("transaction_date", `${year}-01-01`)
      .lt("transaction_date", `${year + 1}-01-01`);
  } else if (month) {
    const monthValue = String(month).padStart(2, "0");
    const monthRanges = monthYears.map((monthYear) => {
      const monthStart = `${monthYear}-${monthValue}-01`;
      const nextMonthYear = month === 12 ? monthYear + 1 : monthYear;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextMonthStart = `${nextMonthYear}-${String(nextMonth).padStart(2, "0")}-01`;

      return `and(transaction_date.gte.${monthStart},transaction_date.lt.${nextMonthStart})`;
    });

    if (monthRanges.length) {
      transactionsQuery = transactionsQuery.or(monthRanges.join(","));
    }
  }

  const paginationHref = (page: number) => getTransactionsPageHref({
    keyword,
    type,
    month,
    year,
    categoryId,
    accountId,
    page,
  });

  const { data: transactionsData, count, error } = await transactionsQuery
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((requestedPage - 1) * pageSize, requestedPage * pageSize - 1);

  if (error) {
    throw new Error(error.message);
  }

  const totalTransactions = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalTransactions / pageSize));

  if (requestedPage > totalPages) {
    redirect(paginationHref(totalPages));
  }

  const transactions = transactionsData ?? [];

  const [categoriesResult, accountsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("accounts")
      .select("id, name")
      .eq("user_id", user.id)
      .order("name"),
  ]);

  if (categoriesResult.error || accountsResult.error) {
    throw new Error(categoriesResult.error?.message ?? accountsResult.error?.message);
  }

  const categories = categoriesResult.data;
  const accounts = accountsResult.data;

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              ລາຍການທັງໝົດ
            </h1>

            <p className="mt-2 text-slate-600">
              ລາຍຮັບ ແລະລາຍຈ່າຍທີ່ບັນທຶກໄວ້
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center font-semibold hover:bg-slate-100"
            >
              Dashboard
            </Link>

            <Link
              href="/transactions/new"
              className="rounded-lg bg-emerald-600 px-5 py-3 text-center font-semibold text-white hover:bg-emerald-700"
            >
              + ເພີ່ມລາຍການ
            </Link>
          </div>
        </div>

        <section className="mt-8 overflow-hidden rounded-xl bg-white shadow-sm">
          <form
            action="/transactions"
            className="grid gap-4 border-b border-slate-200 p-5 sm:grid-cols-2 lg:grid-cols-7"
          >
            <label className="space-y-1 lg:col-span-2">
              <span className="block text-sm font-medium">ຄົ້ນຫາ</span>
              <input
                name="q"
                type="search"
                defaultValue={keyword}
                placeholder="ຄົ້ນຫາ..."
                className={filterControlClassName}
              />
            </label>

            <label className="space-y-1">
              <span className="block text-sm font-medium">ປະເພດ</span>
              <select
                name="type"
                defaultValue={type}
                className={filterControlClassName}
              >
                <option value="">ທັງໝົດ</option>
                <option value="income">ລາຍຮັບ</option>
                <option value="expense">ລາຍຈ່າຍ</option>
                <option value="transfer">ໂອນເງິນ</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="block text-sm font-medium">ເດືອນ</span>
              <select
                name="month"
                defaultValue={month ? String(month) : ""}
                className={filterControlClassName}
              >
                <option value="">ທັງໝົດ</option>
                {Array.from({ length: 12 }, (_, index) => index + 1).map(
                  (monthNumber) => (
                    <option key={monthNumber} value={monthNumber}>
                      {monthNumber}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="space-y-1">
              <span className="block text-sm font-medium">ປີ</span>
              <input
                name="year"
                type="number"
                min="1"
                max="9999"
                defaultValue={year ?? ""}
                placeholder="ປີ"
                className={filterControlClassName}
              />
            </label>

            <label className="space-y-1">
              <span className="block text-sm font-medium">ໝວດໝູ່</span>
              <select
                name="category"
                defaultValue={categoryId}
                className={filterControlClassName}
              >
                <option value="">ທັງໝົດ</option>
                {categories?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="block text-sm font-medium">ບັນຊີ</span>
              <select
                name="account"
                defaultValue={accountId}
                className={filterControlClassName}
              >
                <option value="">ທັງໝົດ</option>
                {accounts?.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-3 lg:col-span-7">
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700"
              >
                ກັ່ນຕອງ
              </button>

              <Link
                href="/transactions"
                className="rounded-lg border border-slate-300 bg-white px-5 py-2 font-semibold hover:bg-slate-100"
              >
                ລ້າງຕົວກອງ
              </Link>
            </div>
          </form>

          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold">
              ຈຳນວນທັງໝົດ {totalTransactions} ລາຍການ
            </p>

            <div className="flex items-center gap-3">
              {requestedPage > 1 ? (
                <Link
                  href={paginationHref(requestedPage - 1)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold hover:bg-slate-100"
                >
                  ໜ້າກ່ອນ
                </Link>
              ) : (
                <span className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 font-semibold text-slate-400">
                  ໜ້າກ່ອນ
                </span>
              )}

              <span className="whitespace-nowrap text-sm font-medium">
                ໜ້າ {requestedPage} ຈາກ {totalPages}
              </span>

              {requestedPage < totalPages ? (
                <Link
                  href={paginationHref(requestedPage + 1)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold hover:bg-slate-100"
                >
                  ໜ້າຕໍ່ໄປ
                </Link>
              ) : (
                <span className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 font-semibold text-slate-400">
                  ໜ້າຕໍ່ໄປ
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="bg-slate-100 text-left text-sm">
                <tr>
                  <th className="px-5 py-4">ວັນທີ</th>
                  <th className="px-5 py-4">ລາຍການ</th>
                  <th className="px-5 py-4">ປະເພດ</th>
                  <th className="px-5 py-4">ໝວດໝູ່</th>
                  <th className="px-5 py-4">ບັນຊີ</th>
                  <th className="px-5 py-4 text-right">ຈຳນວນ</th>
                  <th className="px-5 py-4 text-center">ຈັດການ</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {transactions.map((transaction) => {
                  const category = Array.isArray(transaction.categories)
                    ? transaction.categories[0]
                    : transaction.categories;

                  const account = Array.isArray(transaction.accounts)
                    ? transaction.accounts[0]
                    : transaction.accounts;
                  const destinationAccount = Array.isArray(transaction.destination_account)
                    ? transaction.destination_account[0]
                    : transaction.destination_account;
                  const isTransfer = transaction.type === "transfer";
                  const transferDescription = `ໂອນຈາກ ${account?.name ?? "-"} ໄປ ${destinationAccount?.name ?? "-"}`;

                  return (
                    <tr
                      key={transaction.id}
                      className={isTransfer ? "bg-blue-50/50 hover:bg-blue-50" : "hover:bg-slate-50"}
                    >
                      <td className="whitespace-nowrap px-5 py-4">
                        {transaction.transaction_date}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium">
                          {isTransfer ? transferDescription : transaction.description}
                        </p>

                        {transaction.note && (
                          <p className="mt-1 text-sm text-slate-500">
                            {transaction.note}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-medium ${
                            isTransfer
                              ? "bg-blue-100 text-blue-700"
                              : transaction.type === "income"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {isTransfer
                            ? "ໂອນເງິນ"
                            : transaction.type === "income"
                              ? "ລາຍຮັບ"
                              : "ລາຍຈ່າຍ"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {isTransfer ? "-" : category?.name ?? "-"}
                      </td>

                      <td className="px-5 py-4">
                        {isTransfer
                          ? `${account?.name ?? "-"} → ${destinationAccount?.name ?? "-"}`
                          : account?.name ?? "-"}
                      </td>

                      <td
                        className={`whitespace-nowrap px-5 py-4 text-right font-semibold ${
                          isTransfer
                            ? "text-blue-600"
                            : transaction.type === "income"
                              ? "text-emerald-600"
                              : "text-red-600"
                        }`}
                      >
                        {!isTransfer && (transaction.type === "income" ? "+" : "-")}
                        {formatMoney(Number(transaction.amount))}{" "}
                        {transaction.currency}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex justify-center gap-2">
                          {!isTransfer && (
                            <Link
                              href={`/transactions/${transaction.id}/edit`}
                              className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100"
                            >
                              ແກ້ໄຂ
                            </Link>
                          )}

                          <DeleteTransactionButton
                            transactionId={transaction.id}
                            deleteAction={deleteTransaction}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!transactions.length && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-slate-500"
                    >
                      ບໍ່ພົບລາຍການທີ່ຄົ້ນຫາ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
