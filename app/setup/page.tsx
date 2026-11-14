import Link from "next/link";

export default function SetupPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16">
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-2xl font-bold text-slate-900">ระบบยังตั้งค่าการเชื่อมต่อไม่ครบ</h1>
        <p className="mt-3 text-slate-700">
          ผู้ดูแลระบบต้องตั้งค่าตัวแปร NEXT_PUBLIC_SUPABASE_URL และ
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ใน Environment Variables ของ Vercel
          แล้ว deploy ใหม่ หากรันบนเครื่องให้ตั้งค่าใน .env.local และเริ่ม server ใหม่
        </p>
        <Link href="/login" className="mt-5 inline-block font-semibold text-blue-800 underline">ลองเข้าสู่ระบบอีกครั้ง</Link>
      </section>
    </main>
  );
}
