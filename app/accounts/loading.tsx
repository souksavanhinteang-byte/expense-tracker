export default function AccountsLoading() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="flex items-center justify-between gap-4">
          <div className="h-9 w-48 rounded bg-slate-200" />
          <div className="h-12 w-48 rounded-lg bg-slate-200" />
        </div>
        <section className="mt-8 overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="space-y-px bg-slate-200 p-px">
            <div className="h-14 bg-slate-100" />
            <div className="h-16 bg-white" />
            <div className="h-16 bg-white" />
            <div className="h-16 bg-white" />
          </div>
        </section>
      </div>
    </main>
  );
}
