"use client";

import { useActionState, useEffect, useRef } from "react";
import { createTask, type TaskActionState } from "@/app/actions/tasks";
import type { TeamMember } from "@/lib/types";

const initialState: TaskActionState = { ok: false, message: "" };

export function TaskForm({ members }: { members: TeamMember[] }) {
  const [state, action, pending] = useActionState(createTask, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="rounded-3xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-bold text-slate-950">สร้างงานใหม่</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="task-title" className="text-sm font-semibold">ชื่องาน</label>
          <input id="task-title" name="title" required maxLength={160} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        <div>
          <label htmlFor="assignee" className="text-sm font-semibold">ผู้รับงาน</label>
          <select id="assignee" name="assigneeId" required defaultValue="" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
            <option value="" disabled>เลือกสมาชิกในทีม</option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.display_name}{member.is_owner ? " (หัวหน้า)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="due-date" className="text-sm font-semibold">วันกำหนดส่ง (ไม่บังคับ)</label>
          <input id="due-date" name="dueDate" type="date" className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="description" className="text-sm font-semibold">รายละเอียด (ไม่บังคับ)</label>
          <textarea id="description" name="description" rows={3} maxLength={2000} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
      </div>
      {state.message && (
        <p role="status" className={`mt-4 rounded-xl px-4 py-3 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {state.message}
        </p>
      )}
      <button disabled={pending} className="mt-5 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-800 disabled:bg-slate-400">
        {pending ? "กำลังสร้าง…" : "สร้างงาน"}
      </button>
    </form>
  );
}
