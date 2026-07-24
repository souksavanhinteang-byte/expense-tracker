import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  DashboardDetails,
  DashboardDetailsFallback,
  DashboardSummary,
  DashboardSummaryFallback,
} from "./dashboard-content";
import { createClient } from "@/lib/supabase/server";

type DashboardPageProps = {
  searchParams: Promise<{
    month?: string | string[];
    year?: string | string[];
  }>;
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getSelectedPeriod(searchParams: Awaited<DashboardPageProps["searchParams"]>) {
  const now = new Date();
  const selectedMonthValue = Number(getSearchParam(searchParams.month));
  const selectedYearValue = Number(getSearchParam(searchParams.year));

  return {
    month:
      Number.isInteger(selectedMonthValue) && selectedMonthValue >= 1 && selectedMonthValue <= 12
        ? selectedMonthValue
        : now.getUTCMonth() + 1,
    year:
      Number.isInteger(selectedYearValue) && selectedYearValue >= 1 && selectedYearValue <= 9999
        ? selectedYearValue
        : now.getUTCFullYear(),
  };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const [params, supabase] = await Promise.all([searchParams, createClient()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const selectedPeriod = getSelectedPeriod(params);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              ລະບົບບັນທຶກລາຍຮັບ–ລາຍຈ່າຍ
            </h1>
            <p className="mt-2 text-slate-600">ສະຫຼຸບລາຍຮັບ–ລາຍຈ່າຍຂອງທ່ານ</p>
          </div>

          <nav
            aria-label="ເມນູຫຼັກ"
            className="grid w-full grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5"
          >
            <Link href="/accounts" className="dashboard-nav-link">ຈັດການບັນຊີ</Link>
            <Link href="/categories" className="dashboard-nav-link">ຈັດການໝວດໝູ່</Link>
            <Link href="/budgets" className="dashboard-nav-link">ຈັດການງົບປະມານ</Link>
            <Link href="/recurring" className="dashboard-nav-link">ລາຍການປະຈຳ</Link>
            <Link href="/goals" className="dashboard-nav-link">ເປົ້າໝາຍການອອມ</Link>
            <Link href="/transactions" className="dashboard-nav-link">ເບິ່ງລາຍການ</Link>
            <Link href="/transactions/new" className="dashboard-nav-link bg-emerald-600 text-white hover:bg-emerald-700">+ ເພີ່ມລາຍການ</Link>
            <Link href="/transfers/new" className="dashboard-nav-link">ໂອນເງິນ</Link>
            <Link href="/export" className="dashboard-nav-link">ສຳຮອງຂໍ້ມູນ</Link>
            <Link href="/import" className="dashboard-nav-link">ນຳເຂົ້າຂໍ້ມູນ</Link>
          </nav>
        </div>

        <Suspense fallback={<DashboardSummaryFallback />}>
          <DashboardSummary userId={user.id} />
        </Suspense>

        <Suspense fallback={<DashboardDetailsFallback />}>
          <DashboardDetails userId={user.id} selectedPeriod={selectedPeriod} />
        </Suspense>
      </div>
    </main>
  );
}
