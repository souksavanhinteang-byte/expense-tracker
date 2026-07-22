import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { calculateAccountBalances } from "@/lib/account-balances";
import { createClient } from "@/lib/supabase/server";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("lo-LA").format(amount);
}

type AccountsPageProps = {
  searchParams: Promise<{
    error?: string | string[];
  }>;
};

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, name, currency, initial_balance, is_active")
    .eq("user_id", user.id)
    .order("name");

  const { data: transactions, error: transactionsError } = await supabase
    .from("transactions")
    .select("type, amount, account_id, destination_account_id, currency")
    .eq("user_id", user.id);

  if (accountsError) {
    throw new Error(accountsError.message);
  }

  if (transactionsError) {
    throw new Error(transactionsError.message);
  }

  const { accounts: accountBalances } = calculateAccountBalances(
    accounts ?? [],
    transactions ?? [],
  );

  async function toggleAccountStatus(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login");
    }

    const accountId = String(formData.get("account_id") ?? "");

    if (!accountId) {
      throw new Error("ບໍ່ພົບບັນຊີ");
    }

    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id, name, is_active")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      throw new Error("ບໍ່ພົບບັນຊີ");
    }

    if (account.is_active) {
      const { count, error: activeAccountsError } = await supabase
        .from("accounts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (activeAccountsError) {
        throw new Error(activeAccountsError.message);
      }

      if ((count ?? 0) <= 1) {
        redirect("/accounts?error=last-active-account");
      }
    } else {
      const { data: duplicateAccount, error: duplicateError } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", account.name)
        .eq("is_active", true)
        .maybeSingle();

      if (duplicateError) {
        throw new Error(duplicateError.message);
      }

      if (duplicateAccount) {
        redirect("/accounts?error=duplicate-active-account");
      }
    }

    const { error: updateError } = await supabase
      .from("accounts")
      .update({ is_active: !account.is_active })
      .eq("id", account.id)
      .eq("user_id", user.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    redirect("/accounts");
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">ຈັດການບັນຊີ</h1>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center font-semibold hover:bg-slate-100"
            >
              ກັບ Dashboard
            </Link>
            <Link
              href="/accounts/new"
              className="rounded-lg bg-emerald-600 px-5 py-3 text-center font-semibold text-white hover:bg-emerald-700"
            >
              + ເພີ່ມບັນຊີ
            </Link>
          </div>
        </div>

        {error === "last-active-account" && (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            ບໍ່ສາມາດປິດໃຊ້ງານບັນຊີສຸດທ້າຍໄດ້
          </p>
        )}

        {error === "duplicate-active-account" && (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            ມີຊື່ບັນຊີນີ້ທີ່ເປີດໃຊ້ງານແລ້ວ
          </p>
        )}

        <section className="mt-8 overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-slate-100 text-left text-sm">
                <tr>
                  <th className="px-5 py-4">ຊື່ບັນຊີ</th>
                  <th className="px-5 py-4">ສະກຸນເງິນ</th>
                  <th className="px-5 py-4 text-right">ຍອດຄົງເຫຼືອ</th>
                  <th className="px-5 py-4">ສະຖານະ</th>
                  <th className="px-5 py-4 text-center">ຈັດການ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {accountBalances.map((account) => (
                  <tr key={account.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-medium">{account.name}</td>
                    <td className="px-5 py-4">{account.currency}</td>
                    <td
                      className={`whitespace-nowrap px-5 py-4 text-right font-semibold ${
                        account.balance > 0
                          ? "text-emerald-600"
                          : account.balance < 0
                            ? "text-red-600"
                            : "text-slate-700"
                      }`}
                    >
                      {formatMoney(account.balance)} {account.currency}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-medium ${
                          account.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {account.is_active ? "ເປີດໃຊ້ງານ" : "ປິດໃຊ້ງານ"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-center gap-2">
                        <Link
                          href={`/accounts/${account.id}/edit`}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100"
                        >
                          ແກ້ໄຂ
                        </Link>
                        <form action={toggleAccountStatus}>
                          <input type="hidden" name="account_id" value={account.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100"
                          >
                            {account.is_active ? "ປິດໃຊ້ງານ" : "ເປີດໃຊ້ງານ"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
                {!accountBalances.length && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                      ຍັງບໍ່ມີບັນຊີ
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
