import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const controlClassName =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 [color-scheme:light]";

function isValidTransferDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export default async function NewTransferPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, name, currency")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("name");

  if (accountsError) {
    throw new Error(accountsError.message);
  }

  const activeAccounts = accounts ?? [];
  const currencies = [...new Set(activeAccounts.map((account) => account.currency))];

  async function createTransfer(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login");
    }

    const transactionDate = String(formData.get("transaction_date") ?? "");
    const sourceAccountId = String(formData.get("source_account_id") ?? "");
    const destinationAccountId = String(formData.get("destination_account_id") ?? "");
    const amount = Number(formData.get("amount"));
    const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
    const note = String(formData.get("note") ?? "").trim();

    if (!isValidTransferDate(transactionDate)) {
      throw new Error("ກະລຸນາເລືອກວັນທີໃຫ້ຖືກຕ້ອງ");
    }

    if (!sourceAccountId) {
      throw new Error("ກະລຸນາເລືອກບັນຊີຕົ້ນທາງ");
    }

    if (!destinationAccountId) {
      throw new Error("ກະລຸນາເລືອກບັນຊີປາຍທາງ");
    }

    if (sourceAccountId === destinationAccountId) {
      throw new Error("ບັນຊີຕົ້ນທາງ ແລະ ບັນຊີປາຍທາງ ຕ້ອງບໍ່ແມ່ນບັນຊີດຽວກັນ");
    }

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error("ຈຳນວນເງິນຕ້ອງເປັນເລກເຕັມບວກ");
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error("ສະກຸນເງິນບໍ່ຖືກຕ້ອງ");
    }

    const [sourceAccountResult, destinationAccountResult] = await Promise.all([
      supabase
        .from("accounts")
        .select("id, name, currency")
        .eq("id", sourceAccountId)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single(),
      supabase
        .from("accounts")
        .select("id, name, currency")
        .eq("id", destinationAccountId)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single(),
    ]);

    const sourceAccount = sourceAccountResult.data;
    const destinationAccount = destinationAccountResult.data;

    if (sourceAccountResult.error || !sourceAccount) {
      throw new Error("ບໍ່ພົບບັນຊີຕົ້ນທາງທີ່ເປີດໃຊ້ງານ");
    }

    if (destinationAccountResult.error || !destinationAccount) {
      throw new Error("ບໍ່ພົບບັນຊີປາຍທາງທີ່ເປີດໃຊ້ງານ");
    }

    if (sourceAccount.currency !== destinationAccount.currency) {
      throw new Error("ບໍ່ສາມາດໂອນເງິນລະຫວ່າງບັນຊີທີ່ມີສະກຸນເງິນຕ່າງກັນ");
    }

    if (currency !== sourceAccount.currency || currency !== destinationAccount.currency) {
      throw new Error("ສະກຸນເງິນຕ້ອງກົງກັບບັນຊີທັງສອງ");
    }

    const description = `ໂອນຈາກ ${sourceAccount.name} ໄປ ${destinationAccount.name}`;
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      transaction_date: transactionDate,
      type: "transfer",
      amount,
      description,
      account_id: sourceAccount.id,
      destination_account_id: destinationAccount.id,
      category_id: null,
      currency,
      note: note || null,
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    redirect("/transactions");
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold">ໂອນເງິນ</h1>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center font-semibold hover:bg-slate-100"
          >
            ກັບ Dashboard
          </Link>
        </div>

        <form action={createTransfer} className="space-y-6 rounded-2xl bg-white p-8 shadow-sm">
          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="transaction_date">
              ວັນທີ
            </label>
            <input
              id="transaction_date"
              name="transaction_date"
              type="date"
              defaultValue={today}
              required
              className={controlClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="source_account_id">
              ບັນຊີຕົ້ນທາງ
            </label>
            <select id="source_account_id" name="source_account_id" defaultValue="" required className={controlClassName}>
              <option value="" disabled>ເລືອກບັນຊີ</option>
              {activeAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} — {account.currency}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="destination_account_id">
              ບັນຊີປາຍທາງ
            </label>
            <select id="destination_account_id" name="destination_account_id" defaultValue="" required className={controlClassName}>
              <option value="" disabled>ເລືອກບັນຊີ</option>
              {activeAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} — {account.currency}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="amount">ຈຳນວນເງິນ</label>
            <input id="amount" name="amount" type="number" min="1" step="1" required className={controlClassName} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="currency">ສະກຸນເງິນ</label>
            <select id="currency" name="currency" defaultValue={currencies[0] ?? "LAK"} required className={controlClassName}>
              {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="note">ໝາຍເຫດ</label>
            <textarea id="note" name="note" rows={3} className={controlClassName} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard" className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-center font-semibold hover:bg-slate-100">
              ກັບ Dashboard
            </Link>
            <Link href="/transactions" className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-center font-semibold hover:bg-slate-100">
              ຍົກເລີກ
            </Link>
            <button type="submit" className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700">
              ຢືນຢັນການໂອນ
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
