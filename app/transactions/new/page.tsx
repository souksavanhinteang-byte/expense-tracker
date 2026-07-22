import { redirect } from "next/navigation";
import { TransactionTypeCategoryFields } from "@/components/transaction-type-category-fields";
import { createClient } from "@/lib/supabase/server";

export default async function NewTransactionPage() {
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

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, type, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("name");

  if (accountsError) {
    throw new Error(accountsError.message);
  }

  if (categoriesError) {
    throw new Error(categoriesError.message);
  }

  async function addTransaction(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login");
    }

    const transactionDate = String(
      formData.get("transaction_date") ?? "",
    );

    const type = String(formData.get("type") ?? "");
    const description = String(
      formData.get("description") ?? "",
    ).trim();

    const amount = Number(formData.get("amount"));
    const accountId = String(formData.get("account_id") ?? "");
    const categoryId = String(formData.get("category_id") ?? "");
    const note = String(formData.get("note") ?? "").trim();

    if (
      !transactionDate ||
      !description ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !accountId ||
      !categoryId ||
      !["income", "expense"].includes(type)
    ) {
      throw new Error("ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບ");
    }

    const { data: selectedAccount, error: accountError } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (accountError || !selectedAccount) {
      throw new Error("ບໍ່ພົບບັນຊີທີ່ເປີດໃຊ້ງານ");
    }

    const { data: selectedCategory, error: categoryError } =
      await supabase
        .from("categories")
        .select("id, type")
        .eq("id", categoryId)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

    if (categoryError || !selectedCategory) {
      throw new Error("ບໍ່ພົບໝວດໝູ່ທີ່ເລືອກ");
    }

    if (selectedCategory.type !== type) {
      throw new Error(
        "ປະເພດລາຍການບໍ່ກົງກັບໝວດໝູ່",
      );
    }

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      transaction_date: transactionDate,
      type,
      description,
      amount,
      account_id: accountId,
      category_id: categoryId,
      currency: "LAK",
      note: note || null,
    });

    if (error) {
      throw new Error(error.message);
    }

    redirect("/transactions");
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">
            ເພີ່ມລາຍການໃໝ່
          </h1>

          <p className="mt-2 text-slate-600">
            ບັນທຶກລາຍຮັບ ຫຼື ລາຍຈ່າຍ
          </p>
        </div>

        <form
          action={addTransaction}
          className="space-y-6 rounded-2xl bg-white p-8 shadow-sm"
        >
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              ວັນທີ
            </label>

            <input
              name="transaction_date"
              type="date"
              defaultValue={today}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <TransactionTypeCategoryFields
            categories={categories ?? []}
            defaultType="expense"
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              ຊື່ລາຍການ
            </label>

            <input
              name="description"
              type="text"
              placeholder="ຕົວຢ່າງ: ຄ່າອາຫານ"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              ຈຳນວນເງິນ
            </label>

            <input
              name="amount"
              type="number"
              min="1"
              step="1"
              placeholder="50000"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              ບັນຊີ
            </label>

            <select
              name="account_id"
              required
              defaultValue=""
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              <option value="" disabled>
                ເລືອກບັນຊີ
              </option>

              {accounts?.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} — {account.currency}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              ໝາຍເຫດ
            </label>

            <textarea
              name="note"
              rows={3}
              placeholder="ບໍ່ບັງຄັບ"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="flex gap-3">
            <a
              href="/transactions"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-center font-semibold hover:bg-slate-100"
            >
              ຍົກເລີກ
            </a>

            <button
              type="submit"
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
            >
              ບັນທຶກລາຍການ
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
