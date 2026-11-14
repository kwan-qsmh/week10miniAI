import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export async function AppHeader() {
  if (!hasSupabaseEnv) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  const metadataName = data.claims.user_metadata?.display_name;
  const displayName =
    profile?.display_name ||
    (typeof metadataName === "string" ? metadataName : "ผู้ใช้");

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/team" className="font-bold text-blue-900">ระบบติดตามงานทีม</Link>
          <nav className="flex items-center gap-3 text-sm font-semibold text-slate-600" aria-label="เมนูหลัก">
            <Link href="/team" className="hover:text-blue-700">ทีม</Link>
            <Link href="/tasks" className="hover:text-blue-700">งาน</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="max-w-48 truncate text-sm text-slate-700" title={displayName}>
            {displayName}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ออกจากระบบ
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
