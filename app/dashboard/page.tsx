import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("lo-LA").format(amount);
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const [profileResult, accountsResult, categoriesResult, transactionsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, default_currency, timezone")
        .eq("id", user.id)
        .single(),

      supabase
        .from("accounts")
        .select("id, name, account_type, currency, initial_balance")
        .eq("user_id", user.id)
        .eq("is_active", true)
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
        .gte("transaction_date", startOfMonth)
        .lte("transaction_date", endOfMonth)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false }),
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

  const profile = profileResult.data;
  const accounts = accountsResult.data ?? [];
  const categories = categoriesResult.data ?? [];
  const transactions = transactionsResult.data ?? [];

  const totalIncome = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const totalExpense = transactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const netBalance = totalIncome - totalExpense;

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
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">ລາຍຮັບເດືອນນີ້</p>

            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {formatMoney(totalIncome)} ₭
            </p>
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">ລາຍຈ່າຍເດືອນນີ້</p>

            <p className="mt-2 text-2xl font-bold text-red-600">
              {formatMoney(totalExpense)} ₭
            </p>
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">ເງິນຄົງເຫຼືອ</p>

            <p
              className={`mt-2 text-2xl font-bold ${
                netBalance >= 0 ? "text-slate-900" : "text-red-600"
              }`}
            >
              {formatMoney(netBalance)} ₭
            </p>
          </section>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">ບັນຊີຂອງຂ້ອຍ</h2>

            <div className="mt-4 space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex justify-between rounded-lg border border-slate-200 p-3"
                >
                  <span>{account.name}</span>

                  <span>
                    {formatMoney(Number(account.initial_balance))}{" "}
                    {account.currency}
                  </span>
                </div>
              ))}

              {!accounts.length && (
                <p className="text-slate-500">ຍັງບໍ່ມີບັນຊີ</p>
              )}
            </div>
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">ໝວດໝູ່</h2>

            <p className="mt-4 text-3xl font-bold">{categories.length}</p>

            <p className="text-sm text-slate-500">ຈຳນວນໝວດລາຍຮັບ–ລາຍຈ່າຍ</p>
          </section>
        </div>

        <section className="mt-8 rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">ລາຍການເດືອນນີ້</h2>

            <span className="text-sm text-slate-500">
              {transactions.length} ລາຍການ
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {transactions.slice(0, 10).map((transaction) => {
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
                    {formatMoney(Number(transaction.amount))} ₭
                  </p>
                </div>
              );
            })}

            {!transactions.length && (
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
