import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { CategoryForm } from "@/components/category-form";
import { createClient } from "@/lib/supabase/server";

type EditCategoryPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function EditCategoryPage({
  params,
  searchParams,
}: EditCategoryPageProps) {
  const { id } = await params;
  const searchParamsValue = await searchParams;
  const error = Array.isArray(searchParamsValue.error)
    ? searchParamsValue.error[0]
    : searchParamsValue.error;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id, name, type, is_active")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (categoryError || !category) {
    notFound();
  }

  async function updateCategory(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login");
    }

    const name = String(formData.get("name") ?? "").trim();
    const type = String(formData.get("type") ?? "");

    if (!name || !["income", "expense"].includes(type)) {
      throw new Error("ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບ");
    }

    const { data: currentCategory, error: currentCategoryError } = await supabase
      .from("categories")
      .select("id, type, is_active")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (currentCategoryError || !currentCategory) {
      throw new Error("ບໍ່ພົບໝວດໝູ່");
    }

    if (type !== currentCategory.type) {
      const { count, error: transactionsError } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("category_id", id);

      if (transactionsError) {
        throw new Error(transactionsError.message);
      }

      if ((count ?? 0) > 0) {
        redirect(`/categories/${id}/edit?error=type-in-use`);
      }
    }

    if (currentCategory.is_active) {
      const { data: duplicateCategory, error: duplicateError } = await supabase
        .from("categories")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", name)
        .eq("type", type)
        .eq("is_active", true)
        .neq("id", id)
        .maybeSingle();

      if (duplicateError) {
        throw new Error(duplicateError.message);
      }

      if (duplicateCategory) {
        throw new Error("ມີຊື່ໝວດໝູ່ນີ້ທີ່ເປີດໃຊ້ງານແລ້ວ");
      }
    }

    const { error } = await supabase
      .from("categories")
      .update({ name, type })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/categories");
    revalidatePath("/dashboard");
    redirect("/categories");
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6"><h1 className="text-3xl font-bold">ແກ້ໄຂ</h1></div>
        {error === "type-in-use" && (
          <p className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            ບໍ່ສາມາດປ່ຽນປະເພດໝວດໝູ່ທີ່ຖືກໃຊ້ແລ້ວ
          </p>
        )}
        <CategoryForm
          action={updateCategory}
          defaultName={category.name}
          defaultType={category.type === "income" ? "income" : "expense"}
        />
      </div>
    </main>
  );
}
