export default function EditCategoryLoading() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-2xl animate-pulse">
        <div className="mb-6 h-9 w-28 rounded bg-slate-200" />
        <div className="space-y-6 rounded-2xl bg-white p-8 shadow-sm">
          <div className="space-y-2">
            <div className="h-5 w-24 rounded bg-slate-200" />
            <div className="h-12 rounded-lg bg-slate-200" />
          </div>
          <div className="space-y-2">
            <div className="h-5 w-24 rounded bg-slate-200" />
            <div className="h-12 rounded-lg bg-slate-200" />
          </div>
          <div className="flex gap-3">
            <div className="h-12 flex-1 rounded-lg bg-slate-200" />
            <div className="h-12 flex-1 rounded-lg bg-slate-200" />
          </div>
        </div>
      </div>
    </main>
  );
}
