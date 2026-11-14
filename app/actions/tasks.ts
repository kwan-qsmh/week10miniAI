"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import type { TaskStatus } from "@/lib/types";

export type TaskActionState = { ok: boolean; message: string };

const allowedStatuses: TaskStatus[] = ["todo", "doing", "done"];

export async function createTask(
  previousState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  void previousState;
  const titleValue = formData.get("title");
  const descriptionValue = formData.get("description");
  const dueDateValue = formData.get("dueDate");
  const assigneeValue = formData.get("assigneeId");
  const title = typeof titleValue === "string" ? titleValue.trim() : "";
  const description =
    typeof descriptionValue === "string" && descriptionValue.trim()
      ? descriptionValue.trim()
      : null;
  const dueDate =
    typeof dueDateValue === "string" && dueDateValue ? dueDateValue : null;
  const assigneeId = typeof assigneeValue === "string" ? assigneeValue : "";

  if (!title) return { ok: false, message: "กรุณากรอกชื่องาน" };
  if (!assigneeId) return { ok: false, message: "กรุณาเลือกผู้รับงาน" };

  const { supabase, userId } = await requireUser();
  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return { ok: false, message: "กรุณาสร้างหรือเข้าร่วมทีมก่อน" };

  const { error } = await supabase.from("tasks").insert({
    team_id: membership.team_id,
    title,
    description,
    due_date: dueDate,
    assignee_id: assigneeId,
    created_by: userId,
  });

  if (error) {
    const notMember =
      error.code === "23503" || /is_member_of|row-level security/i.test(error.message);
    return {
      ok: false,
      message: notMember
        ? "เลือกผู้รับงานได้เฉพาะสมาชิกในทีม"
        : "สร้างงานไม่สำเร็จ กรุณาลองใหม่",
    };
  }

  revalidatePath("/tasks");
  return { ok: true, message: "สร้างงานเรียบร้อย" };
}

export async function updateTaskStatus(
  previousState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  void previousState;
  const taskIdValue = formData.get("taskId");
  const statusValue = formData.get("status");
  const taskId = typeof taskIdValue === "string" ? taskIdValue : "";
  const status = typeof statusValue === "string" ? statusValue : "";

  if (!taskId || !allowedStatuses.includes(status as TaskStatus)) {
    return { ok: false, message: "ข้อมูลสถานะไม่ถูกต้อง" };
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", taskId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: "คุณไม่มีสิทธิ์เปลี่ยนสถานะงานนี้" };
  }

  revalidatePath("/tasks");
  return { ok: true, message: "อัปเดตสถานะแล้ว" };
}
