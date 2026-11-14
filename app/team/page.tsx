import Link from "next/link";
import { CopyInviteCode } from "@/components/copy-invite-code";
import { TeamForms } from "@/components/team-forms";
import { requireUser } from "@/lib/auth";
import type { Team, TeamMember } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { supabase, userId } = await requireUser();
  const { data: membership, error: membershipError } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    return <TeamError message="โหลดข้อมูลทีมไม่สำเร็จ กรุณาลองใหม่" />;
  }

  if (!membership) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <p className="text-sm font-bold text-blue-700">เริ่มต้นใช้งาน</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">ทีมของฉัน</h1>
        <p className="mb-7 mt-2 text-slate-600">สร้างทีมใหม่ หรือใช้รหัสเชิญเพื่อเข้าร่วมทีมของเพื่อน</p>
        <TeamForms />
      </main>
    );
  }

  const [{ data: team, error: teamError }, { data: memberRows, error: memberError }] =
    await Promise.all([
      supabase.from("teams").select("id,name,invite_code,owner_id").eq("id", membership.team_id).single(),
      supabase.from("team_members").select("user_id").eq("team_id", membership.team_id),
    ]);

  if (teamError || memberError || !team || !memberRows) {
    return <TeamError message="โหลดข้อมูลทีมไม่สำเร็จ กรุณาลองใหม่" />;
  }

  const memberIds = memberRows.map((row) => row.user_id);
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id,display_name")
    .in("id", memberIds);

  if (profileError || !profiles) {
    return <TeamError message="โหลดรายชื่อสมาชิกไม่สำเร็จ กรุณาลองใหม่" />;
  }

  const typedTeam = team as Team;
  const members: TeamMember[] = profiles
    .map((profile) => ({
      user_id: profile.id,
      display_name: profile.display_name,
      is_owner: profile.id === typedTeam.owner_id,
    }))
    .sort((a, b) => Number(b.is_owner) - Number(a.is_owner));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-blue-700">ทีมของฉัน</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">{typedTeam.name}</h1>
        </div>
        <Link href="/tasks" className="rounded-xl bg-blue-700 px-4 py-3 font-bold text-white hover:bg-blue-800">ดูงานของทีม</Link>
      </div>

      <section className="mt-7 rounded-3xl border border-blue-100 bg-blue-50 p-6">
        <p className="text-sm font-semibold text-blue-800">รหัสเชิญ 6 ตัวอักษร</p>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <code className="text-2xl font-bold tracking-[0.2em] text-blue-950">{typedTeam.invite_code}</code>
          <CopyInviteCode code={typedTeam.invite_code} />
        </div>
      </section>

      <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold text-slate-950">สมาชิก ({members.length})</h2>
        <ul className="mt-4 divide-y divide-slate-100">
          {members.map((member) => (
            <li key={member.user_id} className="flex items-center justify-between gap-3 py-3">
              <span>{member.display_name}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${member.is_owner ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"}`}>
                {member.is_owner ? "หัวหน้า" : "สมาชิก"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function TeamError({ message }: { message: string }) {
  return <main className="mx-auto w-full max-w-3xl px-4 py-10"><div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><h1 className="font-bold">เกิดข้อผิดพลาด</h1><p className="mt-2">{message}</p></div></main>;
}
