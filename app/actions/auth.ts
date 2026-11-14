"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  message: string;
  fieldErrors?: {
    displayName?: string;
    email?: string;
    password?: string;
  };
};

const initialState: AuthState = { message: "" };

function readText(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function validateCredentials(formData: FormData, requireName: boolean) {
  const displayName = readText(formData, "displayName");
  const email = readText(formData, "email").toLowerCase();
  const passwordValue = formData.get("password");
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const fieldErrors: AuthState["fieldErrors"] = {};

  if (requireName && !displayName) {
    fieldErrors.displayName = "กรุณากรอกชื่อที่แสดง";
  }
  if (!email || !email.includes("@")) {
    fieldErrors.email = "กรุณากรอกอีเมลให้ถูกต้อง";
  }
  if (password.length < 6) {
    fieldErrors.password = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
  }

  return { displayName, email, password, fieldErrors };
}

export async function signUp(
  previousState: AuthState = initialState,
  formData: FormData,
): Promise<AuthState> {
  void previousState;
  const { displayName, email, password, fieldErrors } = validateCredentials(
    formData,
    true,
  );

  if (Object.keys(fieldErrors).length > 0) {
    return { message: "กรุณาตรวจข้อมูลที่กรอก", fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error) {
    const duplicate = /already registered|already exists/i.test(error.message);
    return {
      message: duplicate
        ? "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ"
        : "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่",
    };
  }

  if (!data.session) {
    return {
      message:
        "สร้างบัญชีแล้ว แต่ยังไม่ได้เข้าสู่ระบบ กรุณาปิด Confirm email ใน Supabase ตามขั้นตอนทดสอบ แล้วลองสมัครด้วยอีเมลใหม่",
    };
  }

  redirect("/team");
}

export async function signIn(
  previousState: AuthState = initialState,
  formData: FormData,
): Promise<AuthState> {
  void previousState;
  const { email, password, fieldErrors } = validateCredentials(formData, false);

  delete fieldErrors.displayName;
  if (Object.keys(fieldErrors).length > 0) {
    return { message: "กรุณาตรวจข้อมูลที่กรอก", fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  redirect("/team");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
