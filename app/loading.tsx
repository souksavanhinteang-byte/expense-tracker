export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="h-9 w-48 rounded bg-slate-200" />
        <div className="mt-8 space-y-4">
          <div className="h-32 rounded-xl bg-white shadow-sm" />
          <div className="h-48 rounded-xl bg-white shadow-sm" />
        </div>
      </div>
    </main>
  );
}
