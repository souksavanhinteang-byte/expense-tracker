import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DeleteTransactionButton } from "@/components/delete-transaction-button";
import { createClient } from "@/lib/supabase/server";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("lo-LA").format(amount);
}

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

export default async function TransactionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: transactions, error } = await supabase
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
      )
    `)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

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
          <div className="border-b border-slate-200 p-5">
            <p className="font-semibold">
              ທັງໝົດ {transactions?.length ?? 0} ລາຍການ
            </p>
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
                {transactions?.map((transaction) => {
                  const category = Array.isArray(transaction.categories)
                    ? transaction.categories[0]
                    : transaction.categories;

                  const account = Array.isArray(transaction.accounts)
                    ? transaction.accounts[0]
                    : transaction.accounts;

                  return (
                    <tr
                      key={transaction.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-5 py-4">
                        {transaction.transaction_date}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium">
                          {transaction.description}
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
                            transaction.type === "income"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {transaction.type === "income"
                            ? "ລາຍຮັບ"
                            : "ລາຍຈ່າຍ"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {category?.name ?? "-"}
                      </td>

                      <td className="px-5 py-4">
                        {account?.name ?? "-"}
                      </td>

                      <td
                        className={`whitespace-nowrap px-5 py-4 text-right font-semibold ${
                          transaction.type === "income"
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {transaction.type === "income" ? "+" : "-"}
                        {formatMoney(Number(transaction.amount))}{" "}
                        {transaction.currency}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex justify-center gap-2">
                          <Link
                            href={`/transactions/${transaction.id}/edit`}
                            className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100"
                          >
                            ແກ້ໄຂ
                          </Link>

                          <DeleteTransactionButton
                            transactionId={transaction.id}
                            deleteAction={deleteTransaction}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!transactions?.length && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-slate-500"
                    >
                      ຍັງບໍ່ມີລາຍການ
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
