import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MyTasksPage() {
  await requireUser();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-950">งานของฉัน</h1>
      <p className="mt-3 text-slate-600">หน้านี้เป็นงานเสริม US-5</p>
    </main>
  );
}
