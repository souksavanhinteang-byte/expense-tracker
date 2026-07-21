import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type EditTransactionPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditTransactionPage({
  params,
}: EditTransactionPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const [
    transactionResult,
    accountsResult,
    categoriesResult,
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select(`
        id,
        transaction_date,
        type,
        amount,
        description,
        account_id,
        category_id,
        note
      `)
      .eq("id", id)
      .single(),

    supabase
      .from("accounts")
      .select("id, name, currency")
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("categories")
      .select("id, name, type")
      .eq("is_active", true)
      .order("name"),
  ]);

  if (transactionResult.error || !transactionResult.data) {
    notFound();
  }

  if (accountsResult.error) {
    throw new Error(accountsResult.error.message);
  }

  if (categoriesResult.error) {
    throw new Error(categoriesResult.error.message);
  }

  const transaction = transactionResult.data;
  const accounts = accountsResult.data ?? [];
  const categories = categoriesResult.data ?? [];

  async function updateTransaction(formData: FormData) {
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

    const { data: selectedCategory, error: categoryError } =
      await supabase
        .from("categories")
        .select("type")
        .eq("id", categoryId)
        .single();

    if (categoryError || !selectedCategory) {
      throw new Error("ບໍ່ພົບໝວດໝູ່");
    }

    if (selectedCategory.type !== type) {
      throw new Error(
        "ປະເພດລາຍການບໍ່ກົງກັບໝວດໝູ່",
      );
    }

    const { error } = await supabase
      .from("transactions")
      .update({
        transaction_date: transactionDate,
        type,
        description,
        amount,
        account_id: accountId,
        category_id: categoryId,
        note: note || null,
      })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    redirect("/transactions");
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">
            ແກ້ໄຂລາຍການ
          </h1>

          <p className="mt-2 text-slate-600">
            ປັບປຸງຂໍ້ມູນລາຍຮັບ ຫຼືລາຍຈ່າຍ
          </p>
        </div>

        <form
          action={updateTransaction}
          className="space-y-6 rounded-2xl bg-white p-8 shadow-sm"
        >
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              ວັນທີ
            </label>

            <input
              name="transaction_date"
              type="date"
              defaultValue={transaction.transaction_date}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              ປະເພດ
            </label>

            <select
              name="type"
              defaultValue={transaction.type}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
            >
              <option value="expense">ລາຍຈ່າຍ</option>
              <option value="income">ລາຍຮັບ</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              ຊື່ລາຍການ
            </label>

            <input
              name="description"
              type="text"
              defaultValue={transaction.description}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
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
              defaultValue={transaction.amount}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              ໝວດໝູ່
            </label>

            <select
              name="category_id"
              defaultValue={transaction.category_id ?? ""}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} —{" "}
                  {category.type === "expense"
                    ? "ລາຍຈ່າຍ"
                    : "ລາຍຮັບ"}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">
              ບັນຊີ
            </label>

            <select
              name="account_id"
              defaultValue={transaction.account_id ?? ""}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
            >
              {accounts.map((account) => (
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
              defaultValue={transaction.note ?? ""}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
            />
          </div>

          <div className="flex gap-3">
            <Link
              href="/transactions"
              className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-center font-semibold hover:bg-slate-100"
            >
              ຍົກເລີກ
            </Link>

            <button
              type="submit"
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
            >
              ບັນທຶກການແກ້ໄຂ
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}