import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AccountForm } from "@/components/account-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewAccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  async function createAccount(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login");
    }

    const name = String(formData.get("name") ?? "").trim();
    const currency = String(formData.get("currency") ?? "").trim().toUpperCase();

    if (!name || !currency) {
      throw new Error("ກະລຸນາປ້ອນຊື່ບັນຊີ ແລະ ສະກຸນເງິນ");
    }

    const { data: duplicateAccount, error: duplicateError } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", name)
      .eq("is_active", true)
      .maybeSingle();

    if (duplicateError) {
      throw new Error(duplicateError.message);
    }

    if (duplicateAccount) {
      throw new Error("ມີຊື່ບັນຊີນີ້ທີ່ເປີດໃຊ້ງານແລ້ວ");
    }

    const { error } = await supabase.from("accounts").insert({
      user_id: user.id,
      name,
      currency,
      is_active: true,
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    redirect("/accounts");
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">ເພີ່ມບັນຊີ</h1>
        </div>
        <AccountForm action={createAccount} />
      </div>
    </main>
  );
}
