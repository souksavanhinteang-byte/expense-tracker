export type DashboardPeriod = {
  month: number;
  year: number;
};

export function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    start,
    end: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
  };
}

export function getLatestSixMonths(now: Date) {
  const formatter = new Intl.DateTimeFormat("lo-LA", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1),
    );

    return { key: date.toISOString().slice(0, 7), label: formatter.format(date) };
  });
}

export async function timeDashboardSection<T>(name: string, load: () => Promise<T>) {
  const startedAt = performance.now();

  try {
    return await load();
  } finally {
    if (process.env.NODE_ENV === "development") {
      console.info(`[dashboard] ${name}: ${Math.round(performance.now() - startedAt)}ms`);
    }
  }
}
