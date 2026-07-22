import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BudgetSummary } from "@/components/budget-summary";
import { createBudgetProgressReport } from "@/lib/budget-reports";
import { createClient } from "@/lib/supabase/server";

type BudgetsPageProps = {
  searchParams: Promise<{ month?: string | string[]; year?: string | string[]; edit?: string | string[]; error?: string | string[] }>;
};

const controlClassName = "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 [color-scheme:light]";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getMonthYear(monthValue: unknown, yearValue: unknown) {
  const month = Number(monthValue);
  const year = Number(yearValue);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("ເດືອນ ຫຼື ປີ ບໍ່ຖືກຕ້ອງ");
  }
  return { month, year };
}

function budgetUrl(month: number, year: number, extra = "") {
  return `/budgets?month=${month}&year=${year}${extra}`;
}

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  return { supabase, user };
}

async function saveBudget(formData: FormData) {
  "use server";
  const { supabase, user } = await getAuthenticatedUser();
  const { month, year } = getMonthYear(formData.get("month"), formData.get("year"));
  const budgetId = String(formData.get("budget_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "");
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();
  const rawAmount = String(formData.get("amount") ?? "").trim();
  const amount = Number(rawAmount);

  if (!categoryId || !/^[A-Z]{3}$/.test(currency) || !/^\d+$/.test(rawAmount) || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("ກະລຸນາປ້ອນຂໍ້ມູນງົບປະມານໃຫ້ຖືກຕ້ອງ");
  }

  const [categoryResult, profileResult, accountsResult, currentBudgetResult] = await Promise.all([
    supabase.from("categories").select("id, type, is_active").eq("id", categoryId).eq("user_id", user.id).maybeSingle(),
    supabase.from("profiles").select("default_currency").eq("id", user.id).maybeSingle(),
    supabase.from("accounts").select("currency").eq("user_id", user.id),
    budgetId ? supabase.from("budgets").select("id, category_id").eq("id", budgetId).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);

  if (categoryResult.error || !categoryResult.data || categoryResult.data.type !== "expense") throw new Error("ບໍ່ພົບໝວດໝູ່ລາຍຈ່າຍ");
  if (profileResult.error) throw new Error(profileResult.error.message);
  if (accountsResult.error) throw new Error(accountsResult.error.message);
  if (currentBudgetResult.error) throw new Error(currentBudgetResult.error.message);
  if (budgetId && !currentBudgetResult.data) throw new Error("ບໍ່ພົບງົບປະມານ");

  const allowedCurrencies = new Set([profileResult.data?.default_currency ?? "LAK", ...(accountsResult.data ?? []).map((account) => account.currency)]);
  if (!allowedCurrencies.has(currency)) throw new Error("ສະກຸນເງິນບໍ່ຮອງຮັບ");
  if (!categoryResult.data.is_active && currentBudgetResult.data?.category_id !== categoryId) throw new Error("ໝວດໝູ່ນີ້ປິດໃຊ້ງານແລ້ວ");

  const values = { category_id: categoryId, month, year, amount, currency };
  const result = budgetId
    ? await supabase.from("budgets").update(values).eq("id", budgetId).eq("user_id", user.id)
    : await supabase.from("budgets").insert({ ...values, user_id: user.id });

  if (result.error?.code === "23505") redirect(budgetUrl(month, year, "&error=duplicate"));
  if (result.error) throw new Error(result.error.message);
  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  redirect(budgetUrl(month, year));
}

async function deleteBudget(formData: FormData) {
  "use server";
  const { supabase, user } = await getAuthenticatedUser();
  const { month, year } = getMonthYear(formData.get("month"), formData.get("year"));
  const budgetId = String(formData.get("budget_id") ?? "");
  if (!budgetId) throw new Error("ບໍ່ພົບງົບປະມານ");
  const { error } = await supabase.from("budgets").delete().eq("id", budgetId).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  redirect(budgetUrl(month, year));
}

async function copyPreviousMonth(formData: FormData) {
  "use server";
  const { supabase, user } = await getAuthenticatedUser();
  const { month, year } = getMonthYear(formData.get("month"), formData.get("year"));
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const [sourceResult, existingResult, activeCategoriesResult] = await Promise.all([
    supabase.from("budgets").select("category_id, amount, currency").eq("user_id", user.id).eq("month", previousMonth).eq("year", previousYear),
    supabase.from("budgets").select("category_id, currency").eq("user_id", user.id).eq("month", month).eq("year", year),
    supabase.from("categories").select("id").eq("user_id", user.id).eq("type", "expense").eq("is_active", true),
  ]);
  if (sourceResult.error) throw new Error(sourceResult.error.message);
  if (existingResult.error) throw new Error(existingResult.error.message);
  if (activeCategoriesResult.error) throw new Error(activeCategoriesResult.error.message);

  const activeIds = new Set((activeCategoriesResult.data ?? []).map((category) => category.id));
  const existingKeys = new Set((existingResult.data ?? []).map((budget) => `${budget.category_id}:${budget.currency}`));
  const newBudgets = (sourceResult.data ?? []).filter((budget) => activeIds.has(budget.category_id) && !existingKeys.has(`${budget.category_id}:${budget.currency}`)).map((budget) => ({ ...budget, user_id: user.id, month, year }));
  if (!newBudgets.length) redirect(budgetUrl(month, year, "&error=nothing-to-copy"));
  const { error } = await supabase.from("budgets").insert(newBudgets);
  if (error?.code === "23505") redirect(budgetUrl(month, year, "&error=duplicate"));
  if (error) throw new Error(error.message);
  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  redirect(budgetUrl(month, year));
}

export default async function BudgetsPage({ searchParams }: BudgetsPageProps) {
  const params = await searchParams;
  const now = new Date();
  const selectedMonth = Number(first(params.month));
  const selectedYear = Number(first(params.year));
  const month = Number.isInteger(selectedMonth) && selectedMonth >= 1 && selectedMonth <= 12 ? selectedMonth : now.getUTCMonth() + 1;
  const year = Number.isInteger(selectedYear) && selectedYear >= 2000 && selectedYear <= 2100 ? selectedYear : now.getUTCFullYear();
  const editId = first(params.edit) ?? "";
  const error = first(params.error);
  const { supabase, user } = await getAuthenticatedUser();
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  const [budgetsResult, categoriesResult, profileResult, accountsResult, expensesResult] = await Promise.all([
    supabase.from("budgets").select("id, category_id, amount, currency, categories ( name, is_active )").eq("user_id", user.id).eq("month", month).eq("year", year).order("currency"),
    supabase.from("categories").select("id, name, is_active").eq("user_id", user.id).eq("type", "expense").order("name"),
    supabase.from("profiles").select("default_currency").eq("id", user.id).maybeSingle(),
    supabase.from("accounts").select("currency").eq("user_id", user.id),
    supabase.from("transactions").select("category_id, amount, currency").eq("user_id", user.id).eq("type", "expense").gte("transaction_date", start).lt("transaction_date", end),
  ]);
  for (const result of [budgetsResult, categoriesResult, profileResult, accountsResult, expensesResult]) if (result.error) throw new Error(result.error.message);

  const budgets = (budgetsResult.data ?? []).map((budget) => {
    const category = Array.isArray(budget.categories) ? budget.categories[0] : budget.categories;
    return { ...budget, categoryName: category?.name ?? "ບໍ່ພົບໝວດໝູ່", categoryIsActive: category?.is_active ?? false };
  });
  const progress = createBudgetProgressReport(budgets, expensesResult.data ?? []);
  const editBudget = budgets.find((budget) => budget.id === editId);
  const categories = categoriesResult.data ?? [];
  const currencies = Array.from(new Set([profileResult.data?.default_currency ?? "LAK", ...(accountsResult.data ?? []).map((account) => account.currency)])).sort();

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900"><div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><h1 className="text-3xl font-bold">ຈັດການງົບປະມານ</h1><Link href="/dashboard" className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center font-semibold hover:bg-slate-100">ກັບ Dashboard</Link></div>
      {error === "duplicate" && <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">ມີງົບປະມານສຳລັບໝວດໝູ່, ເດືອນ, ປີ ແລະສະກຸນເງິນນີ້ແລ້ວ</p>}
      {error === "nothing-to-copy" && <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">ບໍ່ມີງົບໃໝ່ຈາກເດືອນກ່ອນໃຫ້ຄັດລອກ</p>}
      <section className="mt-8 rounded-xl bg-white p-6 shadow-sm"><form action="/budgets" className="grid gap-4 sm:grid-cols-3"><label><span className="mb-2 block text-sm font-medium">ເດືອນ</span><select name="month" defaultValue={month} className={controlClassName}>{Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><span className="mb-2 block text-sm font-medium">ປີ</span><input name="year" type="number" min="2000" max="2100" defaultValue={year} className={controlClassName} /></label><div className="flex items-end"><button className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold hover:bg-slate-100">ເລືອກເດືອນ</button></div></form></section>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]"><section className="rounded-xl bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">ງົບທັງໝົດ</h2>{progress.length ? <BudgetSummary budgets={progress} /> : <div className="mt-4 text-slate-500">ຍັງບໍ່ມີງົບປະມານ. <a href="#budget-form" className="font-semibold text-emerald-700 underline">ເພີ່ມງົບປະມານທຳອິດ</a></div>} {progress.length > 0 && <div className="mt-6 space-y-3 border-t border-slate-200 pt-5">{progress.map((budget) => <div key={budget.id} className="flex flex-wrap items-center justify-between gap-3"><span className="font-medium">{budget.categoryName} — {budget.currency}</span><div className="flex gap-2"><Link href={budgetUrl(month, year, `&edit=${budget.id}`)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100">ແກ້ໄຂ</Link><form action={deleteBudget}><input type="hidden" name="budget_id" value={budget.id} /><input type="hidden" name="month" value={month} /><input type="hidden" name="year" value={year} /><button className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">ລຶບ</button></form></div></div>)}</div>}</section>
      <aside className="space-y-6"><form action={copyPreviousMonth}><input type="hidden" name="month" value={month} /><input type="hidden" name="year" value={year} /><button className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold hover:bg-slate-100">ຄັດລອກຈາກເດືອນກ່ອນ</button></form><form id="budget-form" action={saveBudget} className="space-y-4 rounded-xl bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{editBudget ? "ແກ້ໄຂ" : "ເພີ່ມງົບປະມານ"}</h2><input type="hidden" name="budget_id" value={editBudget?.id ?? ""} /><input type="hidden" name="month" value={month} /><input type="hidden" name="year" value={year} /><label><span className="mb-2 block text-sm font-medium">ໝວດໝູ່</span><select name="category_id" defaultValue={editBudget?.category_id ?? ""} required className={controlClassName}><option value="" disabled>ເລືອກໝວດໝູ່</option>{categories.filter((category) => category.is_active || category.id === editBudget?.category_id).map((category) => <option key={category.id} value={category.id}>{category.name}{!category.is_active ? " (ປິດໃຊ້ງານ)" : ""}</option>)}</select></label><label><span className="mb-2 block text-sm font-medium">ຈຳນວນເງິນ</span><input name="amount" type="number" min="1" step="1" defaultValue={editBudget?.amount ?? ""} required className={controlClassName} /></label><label><span className="mb-2 block text-sm font-medium">ສະກຸນເງິນ</span><select name="currency" defaultValue={editBudget?.currency ?? profileResult.data?.default_currency ?? "LAK"} className={controlClassName}>{currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label><div className="flex gap-3"><button className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700">ບັນທຶກ</button>{editBudget && <Link href={budgetUrl(month, year)} className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-center font-semibold hover:bg-slate-100">ຍົກເລີກ</Link>}</div></form></aside></div>
    </div></main>
  );
}
