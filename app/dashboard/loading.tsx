export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="h-10 w-80 rounded-lg bg-slate-200" />
        <div className="mt-3 h-5 w-44 rounded bg-slate-200" />

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-32 rounded-xl bg-white shadow-sm"
            />
          ))}
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="h-44 rounded-xl bg-white shadow-sm" />
          <div className="h-44 rounded-xl bg-white shadow-sm" />
        </div>
      </div>
    </main>
  );
}
