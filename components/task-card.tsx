"use client";

import { useActionState } from "react";
import { updateTaskStatus, type TaskActionState } from "@/app/actions/tasks";
import type { TaskStatus, TeamTask } from "@/lib/types";

const initialState: TaskActionState = { ok: false, message: "" };
const labels: Record<TaskStatus, string> = {
  todo: "ยังไม่เริ่ม",
  doing: "กำลังทำ",
  done: "เสร็จแล้ว",
};

export function TaskCard({
  task,
  canUpdate,
  formattedDueDate,
  overdue,
}: {
  task: TeamTask;
  canUpdate: boolean;
  formattedDueDate: string | null;
  overdue: boolean;
}) {
  const [state, action, pending] = useActionState(updateTaskStatus, initialState);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold text-slate-950">{task.title}</h3>
        {overdue && <span className="shrink-0 rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-800">เลยกำหนด</span>}
      </div>
      {task.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{task.description}</p>}
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex gap-2"><dt className="text-slate-500">ผู้รับ:</dt><dd>{task.assignee_name}</dd></div>
        <div className="flex gap-2"><dt className="text-slate-500">กำหนดส่ง:</dt><dd>{formattedDueDate ?? "ไม่มีกำหนด"}</dd></div>
      </dl>
      {canUpdate ? (
        <form action={action} className="mt-4">
          <input type="hidden" name="taskId" value={task.id} />
          <label htmlFor={`status-${task.id}`} className="text-sm font-semibold">เปลี่ยนสถานะ</label>
          <div className="mt-1 flex gap-2">
            <select id={`status-${task.id}`} name="status" defaultValue={task.status} disabled={pending} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {(Object.keys(labels) as TaskStatus[]).map((status) => (
                <option key={status} value={status}>{labels[status]}</option>
              ))}
            </select>
            <button disabled={pending} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white disabled:bg-slate-400">
              {pending ? "บันทึก…" : "บันทึก"}
            </button>
          </div>
          {state.message && <p role="status" className={`mt-2 text-xs ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
        </form>
      ) : (
        <p className="mt-4 text-xs text-slate-500">สถานะ: {labels[task.status]}</p>
      )}
    </article>
  );
}
