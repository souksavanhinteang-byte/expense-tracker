import Link from "next/link";
import { redirect } from "next/navigation";
import { TransactionImportForm } from "@/components/transaction-import-form";
import { createClient } from "@/lib/supabase/server";

type ImportPageProps = {
  searchParams: Promise<{ success?: string | string[] }>;
};

export default async function ImportPage({ searchParams }: ImportPageProps) {
  const params = await searchParams;
  const success = Array.isArray(params.success) ? params.success[0] : params.success;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: batches, error } = await supabase
    .from("import_batches")
    .select("id, file_name, status, total_rows, imported_rows, skipped_rows, failed_rows, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold">ນຳເຂົ້າຂໍ້ມູນ</h1>
          <Link href="/dashboard" className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center font-semibold hover:bg-slate-100">
            ກັບ Dashboard
          </Link>
        </div>

        {success && <p className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">ນຳເຂົ້າຂໍ້ມູນສຳເລັດ</p>}

        <TransactionImportForm />

        <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6"><h2 className="text-xl font-bold">ປະຫວັດການນຳເຂົ້າ</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-slate-100 text-left text-sm"><tr><th className="px-5 py-4">ໄຟລ໌</th><th className="px-5 py-4">ສະຖານະ</th><th className="px-5 py-4">ທັງໝົດ</th><th className="px-5 py-4">ນຳເຂົ້າ</th><th className="px-5 py-4">ຂ້າມ</th><th className="px-5 py-4">ຜິດ</th><th className="px-5 py-4">ວັນທີ</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {(batches ?? []).map((batch) => (
                  <tr key={batch.id}>
                    <td className="px-5 py-4 font-medium">{batch.file_name}</td><td className="px-5 py-4">{batch.status}</td><td className="px-5 py-4">{batch.total_rows}</td><td className="px-5 py-4">{batch.imported_rows}</td><td className="px-5 py-4">{batch.skipped_rows}</td><td className="px-5 py-4">{batch.failed_rows}</td><td className="px-5 py-4">{batch.created_at}</td>
                  </tr>
                ))}
                {!batches?.length && <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-500">ຍັງບໍ່ມີປະຫວັດ</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
