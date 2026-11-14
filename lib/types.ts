export type Team = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
};

export type TeamMember = {
  user_id: string;
  display_name: string;
  is_owner: boolean;
};

export type TaskStatus = "todo" | "doing" | "done";

export type TeamTask = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  assignee_id: string;
  status: TaskStatus;
  created_at: string;
  assignee_name: string;
};
