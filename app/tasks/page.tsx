import { redirect } from "next/navigation";
import { TaskBoard } from "@/components/task-board";
import { TaskForm } from "@/components/task-form";
import { requireUser } from "@/lib/auth";
import type { TeamMember, TeamTask } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const { supabase, userId } = await requireUser();
  const { data: membership, error: membershipError } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) return <TasksError />;
  if (!membership) redirect("/team");

  const [{ data: team }, { data: memberRows }, { data: taskRows, error: taskError }] =
    await Promise.all([
      supabase.from("teams").select("name,owner_id").eq("id", membership.team_id).single(),
      supabase.from("team_members").select("user_id").eq("team_id", membership.team_id),
      supabase.from("tasks").select("id,title,description,due_date,assignee_id,status,created_at").eq("team_id", membership.team_id).order("created_at", { ascending: false }),
    ]);

  if (!team || !memberRows || taskError || !taskRows) return <TasksError />;

  const memberIds = memberRows.map((row) => row.user_id);
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id,display_name")
    .in("id", memberIds);
  if (profileError || !profiles) return <TasksError />;

  const nameById = new Map(profiles.map((profile) => [profile.id, profile.display_name]));
  const members: TeamMember[] = profiles.map((profile) => ({
    user_id: profile.id,
    display_name: profile.display_name,
    is_owner: profile.id === team.owner_id,
  }));
  const tasks: TeamTask[] = taskRows.map((task) => ({
    ...task,
    status: task.status as TeamTask["status"],
    assignee_name: nameById.get(task.assignee_id) ?? "ไม่ทราบชื่อ",
  }));
  const isOwner = team.owner_id === userId;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <div><p className="text-sm font-bold text-blue-700">{team.name}</p><h1 className="mt-1 text-3xl font-bold text-slate-950">งานของทีม</h1></div>
      {isOwner && <div className="mt-7"><TaskForm members={members} /></div>}
      <section className="mt-8">
        {tasks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-xl font-bold text-slate-900">ยังไม่มีงานในทีม</h2><p className="mt-2 text-slate-600">{isOwner ? "ใช้แบบฟอร์มด้านบนเพื่อสร้างงานแรก" : "รอหัวหน้าทีมสร้างและมอบหมายงาน"}</p></div>
        ) : <TaskBoard tasks={tasks} userId={userId} isOwner={isOwner} />}
      </section>
    </main>
  );
}

function TasksError() {
  return <main className="mx-auto w-full max-w-3xl px-4 py-10"><div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><h1 className="font-bold">โหลดงานไม่สำเร็จ</h1><p className="mt-2">กรุณาลองเปิดหน้านี้ใหม่อีกครั้ง</p></div></main>;
}
