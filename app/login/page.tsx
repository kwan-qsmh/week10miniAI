import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims.sub) redirect("/team");

  return (
    <main className="mx-auto grid min-h-[calc(100vh-1px)] w-full max-w-5xl items-center gap-10 px-4 py-10 lg:grid-cols-2">
      <section>
        <p className="text-sm font-bold text-blue-700">พื้นที่ทำงานของทีม</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          ติดตามงานได้ชัดเจนในที่เดียว
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">
          สมัครด้วยชื่อที่เพื่อนร่วมทีมจำได้ แล้วเริ่มสร้างหรือเข้าร่วมทีมของคุณ
        </p>
      </section>
      <AuthForm />
    </main>
  );
}
