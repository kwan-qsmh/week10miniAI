"use client";

import { useActionState } from "react";
import {
  createTeam,
  joinTeam,
  type TeamActionState,
} from "@/app/actions/teams";

const initialState: TeamActionState = { message: "" };

function Message({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
      {text}
    </p>
  );
}

export function TeamForms() {
  const [createState, createAction, creating] = useActionState(
    createTeam,
    initialState,
  );
  const [joinState, joinAction, joining] = useActionState(joinTeam, initialState);

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <form action={createAction} className="rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold text-slate-950">สร้างทีม</h2>
        <p className="mt-1 text-sm text-slate-600">คุณจะเป็นหัวหน้าของทีมนี้</p>
        <label htmlFor="team-name" className="mt-5 block text-sm font-semibold">
          ชื่อทีม
        </label>
        <input
          id="team-name"
          name="name"
          required
          maxLength={100}
          className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
          placeholder="เช่น ทีมการตลาด"
        />
        <Message text={createState.message} />
        <button
          disabled={creating}
          className="mt-5 w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white hover:bg-blue-800 disabled:bg-slate-400"
        >
          {creating ? "กำลังสร้าง…" : "สร้างทีม"}
        </button>
      </form>

      <form action={joinAction} className="rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold text-slate-950">เข้าร่วมทีม</h2>
        <p className="mt-1 text-sm text-slate-600">ใช้รหัส 6 ตัวอักษรจากเพื่อนร่วมทีม</p>
        <label htmlFor="invite-code" className="mt-5 block text-sm font-semibold">
          รหัสเชิญ
        </label>
        <input
          id="invite-code"
          name="inviteCode"
          required
          minLength={6}
          maxLength={6}
          className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 uppercase tracking-[0.2em] focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
          placeholder="ABC123"
        />
        <Message text={joinState.message} />
        <button
          disabled={joining}
          className="mt-5 w-full rounded-xl border border-blue-700 px-4 py-3 font-bold text-blue-800 hover:bg-blue-50 disabled:border-slate-300 disabled:text-slate-400"
        >
          {joining ? "กำลังเข้าร่วม…" : "เข้าร่วมทีม"}
        </button>
      </form>
    </div>
  );
}
