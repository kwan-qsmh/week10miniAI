export default function LoginLoading() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-8">
        <div className="h-8 w-40 rounded bg-slate-200" />
        <div className="mt-8 h-12 rounded bg-slate-100" />
        <div className="mt-4 h-12 rounded bg-slate-100" />
        <p className="mt-6 text-center text-sm text-slate-500">กำลังโหลด…</p>
      </div>
    </main>
  );
}
