import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Status = { ok: boolean; title: string; detail: string };

async function checkSupabase(): Promise<Status> {
  if (!hasSupabaseEnv) {
    return {
      ok: false,
      title: "ยังไม่ได้ใส่ค่าใน .env.local",
      detail:
        "คัดลอกไฟล์ .env.example เป็น .env.local แล้วใส่ Project URL และ Publishable key จาก Supabase จากนั้นหยุดแล้วรัน npm run dev ใหม่",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });

  if (!error) {
    return {
      ok: true,
      title: "เชื่อม Supabase สำเร็จ และพบตาราง profiles แล้ว",
      detail: "พร้อมทำ user story ถัดไป",
    };
  }

  const missingTable =
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /could not find the table|does not exist/i.test(error.message);

  if (missingTable) {
    return {
      ok: true,
      title: "เชื่อม Supabase สำเร็จ",
      detail:
        "ยังไม่มีตาราง profiles ซึ่งถูกต้องสำหรับตอนเริ่มต้น ขั้นต่อไปคือออกแบบระบบ แล้วสั่ง Codex ทำ US-1",
    };
  }

  return {
    ok: false,
    title: "เชื่อม Supabase ไม่สำเร็จ",
    detail: `ตรวจ Project URL และ Publishable key ใน .env.local อีกครั้ง (ข้อความจากระบบ: ${error.message})`,
  };
}

export default async function Home() {
  const status = await checkSupabase();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold text-blue-900">ระบบติดตามงานทีม</h1>
      <p className="mt-2 text-slate-600">
        โปรเจกต์ตั้งต้นสำหรับ workshop สร้างระบบด้วย Codex
      </p>

      <section
        className={`mt-8 rounded-2xl border p-6 ${
          status.ok
            ? "border-emerald-300 bg-emerald-50"
            : "border-amber-300 bg-amber-50"
        }`}
      >
        <p className="text-sm font-semibold">
          {status.ok ? "สถานะ: พร้อม" : "สถานะ: ยังไม่พร้อม"}
        </p>
        <h2 className="mt-1 text-xl font-bold">{status.title}</h2>
        <p className="mt-2 text-slate-700">{status.detail}</p>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-blue-900">ขั้นต่อไป</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-slate-700">
          <li>อ่าน docs/plan.md และ docs/requirements.md</li>
          <li>สั่ง Codex: ใช้ $sdlc-spec เขียน docs/design.md</li>
          <li>สั่ง Codex: ใช้ $supabase-feature ทำ US-1</li>
        </ol>
      </section>
    </main>
  );
}
