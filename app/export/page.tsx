import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const exportOptions = [
  { kind: "transactions", label: "ສົ່ງອອກລາຍການ" },
  { kind: "accounts", label: "ສົ່ງອອກບັນຊີ" },
  { kind: "categories", label: "ສົ່ງອອກໝວດໝູ່" },
] as const;

export default async function ExportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold">ສຳຮອງຂໍ້ມູນ</h1>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center font-semibold hover:bg-slate-100"
          >
            ກັບ Dashboard
          </Link>
        </div>

        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-600">ຮູບແບບໄຟລ໌: CSV (UTF-8)</p>

          <div className="mt-6 space-y-3">
            {exportOptions.map((option) => (
              <a
                key={option.kind}
                href={`/api/export?kind=${option.kind}`}
                className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold hover:bg-slate-100"
              >
                <span>{option.label}</span>
                <span>ດາວໂຫຼດ</span>
              </a>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold">ສົ່ງອອກທັງໝົດ</h2>
          <p className="mt-2 text-slate-600">ດາວໂຫຼດໄຟລ໌ CSV ທັງ 3 ໄຟລ໌ເພື່ອສຳຮອງຂໍ້ມູນທັງໝົດ.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {exportOptions.map((option) => (
              <a
                key={option.kind}
                href={`/api/export?kind=${option.kind}`}
                className="rounded-lg bg-emerald-600 px-4 py-3 text-center font-semibold text-white hover:bg-emerald-700"
              >
                {option.label}
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
