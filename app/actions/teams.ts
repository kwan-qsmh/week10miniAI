"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export type TeamActionState = { message: string };

function errorMessage(message: string) {
  if (message.includes("ALREADY_IN_TEAM")) return "คุณมีทีมอยู่แล้ว";
  if (message.includes("TEAM_NOT_FOUND")) return "ไม่พบทีมจากรหัสนี้";
  if (message.includes("TEAM_NAME_REQUIRED")) return "กรุณากรอกชื่อทีม";
  return "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

export async function createTeam(
  previousState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  void previousState;
  const nameValue = formData.get("name");
  const name = typeof nameValue === "string" ? nameValue.trim() : "";
  if (!name) return { message: "กรุณากรอกชื่อทีม" };

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_team", { p_name: name });
  if (error) return { message: errorMessage(error.message) };

  revalidatePath("/team");
  redirect("/team");
}

export async function joinTeam(
  previousState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  void previousState;
  const codeValue = formData.get("inviteCode");
  const inviteCode =
    typeof codeValue === "string" ? codeValue.trim().toUpperCase() : "";
  if (!inviteCode) return { message: "กรุณากรอกรหัสเชิญ" };

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("join_team", {
    p_invite_code: inviteCode,
  });
  if (error) return { message: errorMessage(error.message) };

  revalidatePath("/team");
  redirect("/team");
}
