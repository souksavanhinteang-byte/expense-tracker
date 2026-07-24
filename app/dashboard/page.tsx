import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  AccountBalancesSection,
  BudgetSummarySection,
  DashboardHeader,
  DashboardNavigation,
  FinancialChartSection,
  MonthlySummaryCards,
  RecurringSummarySection,
  SavingsGoalsSummarySection,
  SectionSkeleton,
} from "./dashboard-sections";
import { type DashboardPeriod } from "./dashboard-utils";
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

function getSelectedPeriod(
  searchParams: Awaited<DashboardPageProps["searchParams"]>,
): DashboardPeriod {
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
  const now = new Date();
  const currentPeriod = {
    month: now.getUTCMonth() + 1,
    year: now.getUTCFullYear(),
  };
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Suspense fallback={<div><h1 className="text-2xl font-bold leading-tight sm:text-3xl">ລະບົບບັນທຶກລາຍຮັບ–ລາຍຈ່າຍ</h1><p className="mt-2 text-slate-600">ສະກຸນເງິນຫຼັກ: LAK</p></div>}>
            <DashboardHeader userId={user.id} />
          </Suspense>

          <DashboardNavigation />
        </div>

        <Suspense fallback={<SectionSkeleton className="mt-5 md:mt-8" cards={3} />}>
          <MonthlySummaryCards
            currentPeriod={currentPeriod}
            userId={user.id}
          />
        </Suspense>

        <Suspense fallback={<SectionSkeleton className="mt-8" />}>
          <BudgetSummarySection selectedPeriod={selectedPeriod} userId={user.id} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton className="mt-8" />}>
          <SavingsGoalsSummarySection userId={user.id} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton className="mt-8" />}>
          <RecurringSummarySection userId={user.id} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton className="mt-8" />}>
          <FinancialChartSection currentPeriod={currentPeriod} userId={user.id} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton className="mt-8" />}>
          <AccountBalancesSection
            currentPeriod={currentPeriod}
            selectedPeriod={selectedPeriod}
            userId={user.id}
          />
        </Suspense>
      </div>
    </main>
  );
}
