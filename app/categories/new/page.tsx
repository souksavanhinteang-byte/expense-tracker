import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CategoryForm } from "@/components/category-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewCategoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  async function createCategory(formData: FormData) {
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

    const { data: duplicateCategory, error: duplicateError } = await supabase
      .from("categories")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", name)
      .eq("type", type)
      .eq("is_active", true)
      .maybeSingle();

    if (duplicateError) {
      throw new Error(duplicateError.message);
    }

    if (duplicateCategory) {
      throw new Error("ມີຊື່ໝວດໝູ່ນີ້ທີ່ເປີດໃຊ້ງານແລ້ວ");
    }

    const { error } = await supabase.from("categories").insert({
      user_id: user.id,
      name,
      type,
      is_active: true,
    });

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
        <div className="mb-6"><h1 className="text-3xl font-bold">ເພີ່ມໝວດໝູ່</h1></div>
        <CategoryForm action={createCategory} />
      </div>
    </main>
  );
}
