import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { AccountForm } from "@/components/account-form";
import { createClient } from "@/lib/supabase/server";

type EditAccountPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditAccountPage({ params }: EditAccountPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, name, currency, is_active")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (accountError || !account) {
    notFound();
  }

  async function updateAccount(formData: FormData) {
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

    const { data: currentAccount, error: currentAccountError } = await supabase
      .from("accounts")
      .select("id, is_active")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (currentAccountError || !currentAccount) {
      throw new Error("ບໍ່ພົບບັນຊີ");
    }

    if (currentAccount.is_active) {
      const { data: duplicateAccount, error: duplicateError } = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", name)
        .eq("is_active", true)
        .neq("id", id)
        .maybeSingle();

      if (duplicateError) {
        throw new Error(duplicateError.message);
      }

      if (duplicateAccount) {
        throw new Error("ມີຊື່ບັນຊີນີ້ທີ່ເປີດໃຊ້ງານແລ້ວ");
      }
    }

    const { error } = await supabase
      .from("accounts")
      .update({ name, currency })
      .eq("id", id)
      .eq("user_id", user.id);

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
          <h1 className="text-3xl font-bold">ແກ້ໄຂ</h1>
        </div>
        <AccountForm
          action={updateAccount}
          defaultName={account.name}
          defaultCurrency={account.currency}
        />
      </div>
    </main>
  );
}
