"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "@/app/actions/auth";

const initialState: AuthState = { message: "" };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-700">{message}</p>;
}

export function AuthForm() {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    initialState,
  );
  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    initialState,
  );

  const state = mode === "signup" ? signUpState : signInState;
  const pending = mode === "signup" ? signUpPending : signInPending;

  return (
    <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1" aria-label="เลือกวิธีเข้าใช้งาน">
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            mode === "signup"
              ? "bg-white text-blue-800 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          สมัครสมาชิก
        </button>
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            mode === "signin"
              ? "bg-white text-blue-800 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          เข้าสู่ระบบ
        </button>
      </div>

      <form action={mode === "signup" ? signUpAction : signInAction} className="mt-6 space-y-4">
        {mode === "signup" && (
          <div>
            <label htmlFor="displayName" className="text-sm font-semibold text-slate-700">
              ชื่อที่แสดง
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="name"
              required
              maxLength={80}
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder="เช่น กานต์"
            />
            <FieldError message={state.fieldErrors?.displayName} />
          </div>
        )}

        <div>
          <label htmlFor="email" className="text-sm font-semibold text-slate-700">
            อีเมล
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            placeholder="name@example.com"
          />
          <FieldError message={state.fieldErrors?.email} />
        </div>

        <div>
          <label htmlFor="password" className="text-sm font-semibold text-slate-700">
            รหัสผ่าน
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={6}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            placeholder="อย่างน้อย 6 ตัวอักษร"
          />
          <FieldError message={state.fieldErrors?.password} />
        </div>

        {state.message && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {pending
            ? "กำลังดำเนินการ…"
            : mode === "signup"
              ? "สมัครสมาชิก"
              : "เข้าสู่ระบบ"}
        </button>
      </form>
    </section>
  );
}
