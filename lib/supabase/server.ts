import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasSupabaseEnv, supabasePublishableKey, supabaseUrl } from "./env";

export async function createClient() {
  if (!hasSupabaseEnv) redirect("/setup");
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component ตั้ง cookie ไม่ได้ แต่ proxy.ts จะรีเฟรช session ให้
        }
      },
    },
  });
}
