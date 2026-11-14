import { formatThaiDate, todayInBangkok } from "@/lib/dates";
import type { TaskStatus, TeamTask } from "@/lib/types";
import { TaskCard } from "@/components/task-card";

const columns: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "ยังไม่เริ่ม" },
  { status: "doing", label: "กำลังทำ" },
  { status: "done", label: "เสร็จแล้ว" },
];

export function TaskBoard({ tasks, userId, isOwner }: { tasks: TeamTask[]; userId: string; isOwner: boolean }) {
  const today = todayInBangkok();
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {columns.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.status);
        return (
          <section key={column.status} className="min-w-0 rounded-3xl bg-slate-100 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold text-slate-900">{column.label}</h2>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-600">{columnTasks.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {columnTasks.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">ไม่มีงานในสถานะนี้</p>
              ) : (
                columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canUpdate={isOwner || task.assignee_id === userId}
                    formattedDueDate={task.due_date ? formatThaiDate(task.due_date) : null}
                    overdue={Boolean(task.due_date && task.due_date < today && task.status !== "done")}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
