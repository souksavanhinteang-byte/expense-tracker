import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { TransactionTypeCategoryFields } from "@/components/transaction-type-category-fields";
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

  const { data: transaction, error: transactionError } = await supabase
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
    .eq("user_id", user.id)
    .single();

  if (transactionError || !transaction) {
    notFound();
  }

  if (transaction.type === "transfer") {
    redirect("/transactions");
  }

  const accountFilter = transaction.account_id
    ? `is_active.eq.true,id.eq.${transaction.account_id}`
    : "is_active.eq.true";
  const categoryFilter = transaction.category_id
    ? `is_active.eq.true,id.eq.${transaction.category_id}`
    : "is_active.eq.true";

  const [accountsResult, categoriesResult] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, currency")
      .eq("user_id", user.id)
      .or(accountFilter)
      .order("name"),

    supabase
      .from("categories")
      .select("id, name, type, is_active")
      .eq("user_id", user.id)
      .or(categoryFilter)
      .order("name"),
  ]);

  if (accountsResult.error) {
    throw new Error(accountsResult.error.message);
  }

  if (categoriesResult.error) {
    throw new Error(categoriesResult.error.message);
  }

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

    const [
      existingTransactionResult,
      selectedAccountResult,
      selectedCategoryResult,
    ] = await Promise.all([
      supabase
        .from("transactions")
        .select("account_id, category_id, type")
        .eq("id", id)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("accounts")
        .select("id, is_active")
        .eq("id", accountId)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("categories")
        .select("id, type, is_active")
        .eq("id", categoryId)
        .eq("user_id", user.id)
        .single(),
    ]);

    if (
      existingTransactionResult.error ||
      !existingTransactionResult.data ||
      selectedAccountResult.error ||
      !selectedAccountResult.data ||
      selectedCategoryResult.error ||
      !selectedCategoryResult.data
    ) {
      throw new Error("ບໍ່ພົບບັນຊີ");
    }

    if (existingTransactionResult.data.type === "transfer") {
      throw new Error("ບໍ່ສາມາດແກ້ໄຂລາຍການໂອນເງິນ");
    }

    if (
      !selectedAccountResult.data.is_active &&
      existingTransactionResult.data.account_id !== accountId
    ) {
      throw new Error("ບໍ່ສາມາດເລືອກບັນຊີທີ່ປິດໃຊ້ງານ");
    }

    if (
      !selectedCategoryResult.data.is_active &&
      existingTransactionResult.data.category_id !== categoryId
    ) {
      throw new Error("ບໍ່ສາມາດເລືອກໝວດໝູ່ທີ່ປິດໃຊ້ງານ");
    }

    if (selectedCategoryResult.data.type !== type) {
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
      .eq("id", id)
      .eq("user_id", user.id);

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

          <TransactionTypeCategoryFields
            categories={categories}
            defaultType={transaction.type === "income" ? "income" : "expense"}
            defaultCategoryId={transaction.category_id}
          />

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
