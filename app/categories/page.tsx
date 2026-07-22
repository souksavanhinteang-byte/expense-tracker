import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type CategoriesPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, type, is_active")
    .eq("user_id", user.id)
    .order("name");

  if (categoriesError) {
    throw new Error(categoriesError.message);
  }

  async function toggleCategoryStatus(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login");
    }

    const categoryId = String(formData.get("category_id") ?? "");
    if (!categoryId) {
      throw new Error("ບໍ່ພົບໝວດໝູ່");
    }

    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id, name, type, is_active")
      .eq("id", categoryId)
      .eq("user_id", user.id)
      .single();

    if (categoryError || !category) {
      throw new Error("ບໍ່ພົບໝວດໝູ່");
    }

    if (!category.is_active) {
      const { data: duplicateCategory, error: duplicateError } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", category.name)
        .eq("type", category.type)
        .eq("is_active", true)
        .maybeSingle();

      if (duplicateError) {
        throw new Error(duplicateError.message);
      }

      if (duplicateCategory) {
        redirect("/categories?error=duplicate-active-category");
      }
    }

    const { error: updateError } = await supabase
      .from("categories")
      .update({ is_active: !category.is_active })
      .eq("id", category.id)
      .eq("user_id", user.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    revalidatePath("/categories");
    revalidatePath("/dashboard");
    redirect("/categories");
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold">ຈັດການໝວດໝູ່</h1>
          <div className="flex gap-3">
            <Link href="/dashboard" className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center font-semibold hover:bg-slate-100">
              ກັບ Dashboard
            </Link>
            <Link href="/categories/new" className="rounded-lg bg-emerald-600 px-5 py-3 text-center font-semibold text-white hover:bg-emerald-700">
              + ເພີ່ມໝວດໝູ່
            </Link>
          </div>
        </div>

        {error === "duplicate-active-category" && (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            ມີຊື່ໝວດໝູ່ນີ້ທີ່ເປີດໃຊ້ງານແລ້ວ
          </p>
        )}

        <section className="mt-8 overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead className="bg-slate-100 text-left text-sm">
                <tr>
                  <th className="px-5 py-4">ຊື່ໝວດໝູ່</th>
                  <th className="px-5 py-4">ປະເພດ</th>
                  <th className="px-5 py-4">ສະຖານະ</th>
                  <th className="px-5 py-4 text-center">ຈັດການ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(categories ?? []).map((category) => (
                  <tr key={category.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-medium">{category.name}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-sm font-medium ${category.type === "income" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {category.type === "income" ? "ລາຍຮັບ" : "ລາຍຈ່າຍ"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-sm font-medium ${category.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                        {category.is_active ? "ເປີດໃຊ້ງານ" : "ປິດໃຊ້ງານ"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-center gap-2">
                        <Link href={`/categories/${category.id}/edit`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100">
                          ແກ້ໄຂ
                        </Link>
                        <form action={toggleCategoryStatus}>
                          <input type="hidden" name="category_id" value={category.id} />
                          <button type="submit" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100">
                            {category.is_active ? "ປິດໃຊ້ງານ" : "ເປີດໃຊ້ງານ"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
                {!categories?.length && (
                  <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-500">ຍັງບໍ່ມີໝວດໝູ່</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
