-- US-2 ถึง US-4: ทีม สมาชิก งาน การมอบหมาย และการเปลี่ยนสถานะ

create type public.task_status as enum ('todo', 'doing', 'done');

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  owner_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.team_members (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  due_date date,
  assignee_id uuid not null references public.profiles (id),
  status public.task_status not null default 'todo',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (team_id, assignee_id)
    references public.team_members (team_id, user_id)
);

create index team_members_team_id_idx on public.team_members (team_id);
create index tasks_team_status_created_idx
  on public.tasks (team_id, status, created_at);
create index tasks_assignee_due_date_idx
  on public.tasks (assignee_id, due_date);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.tasks enable row level security;

create or replace function public.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.team_id
  from public.team_members as m
  where m.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members as m
    where m.team_id = p_team_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_team_owner(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teams as t
    where t.id = p_team_id
      and t.owner_id = (select auth.uid())
  );
$$;

create or replace function public.shares_team_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members as me
    join public.team_members as them on them.team_id = me.team_id
    where me.user_id = (select auth.uid())
      and them.user_id = p_user_id
  );
$$;

create or replace function public.is_member_of(p_team_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members as m
    where m.team_id = p_team_id
      and m.user_id = p_user_id
  );
$$;

revoke all on function public.current_team_id() from public, anon;
revoke all on function public.is_team_member(uuid) from public, anon;
revoke all on function public.is_team_owner(uuid) from public, anon;
revoke all on function public.shares_team_with(uuid) from public, anon;
revoke all on function public.is_member_of(uuid, uuid) from public, anon;
grant execute on function public.current_team_id() to authenticated;
grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.is_team_owner(uuid) to authenticated;
grant execute on function public.shares_team_with(uuid) to authenticated;
grant execute on function public.is_member_of(uuid, uuid) to authenticated;

create policy "teams: members can read own team"
on public.teams
for select
to authenticated
using (id = public.current_team_id());

create policy "team_members: teammates can read"
on public.team_members
for select
to authenticated
using (team_id = public.current_team_id());

create policy "profiles: teammates can read"
on public.profiles
for select
to authenticated
using (public.shares_team_with(id));

create policy "tasks: team members can read"
on public.tasks
for select
to authenticated
using (team_id = public.current_team_id());

create policy "tasks: owner can create"
on public.tasks
for insert
to authenticated
with check (
  public.is_team_owner(team_id)
  and created_by = (select auth.uid())
  and public.is_member_of(team_id, assignee_id)
);

create policy "tasks: owner or assignee can update"
on public.tasks
for update
to authenticated
using (
  public.is_team_owner(team_id)
  or assignee_id = (select auth.uid())
)
with check (
  (public.is_team_owner(team_id) or assignee_id = (select auth.uid()))
  and public.is_member_of(team_id, assignee_id)
);

revoke all on table public.teams from anon, authenticated;
revoke all on table public.team_members from anon, authenticated;
revoke all on table public.tasks from anon, authenticated;
grant select on table public.teams to authenticated;
grant select on table public.team_members to authenticated;
grant select, insert, update on table public.tasks to authenticated;

create or replace function public.create_team(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
  v_code text;
begin
  if v_uid is null then
    raise exception 'NOT_LOGGED_IN';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'TEAM_NAME_REQUIRED';
  end if;
  if exists (
    select 1 from public.team_members where user_id = v_uid
  ) then
    raise exception 'ALREADY_IN_TEAM';
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.teams (name, invite_code, owner_id)
      values (trim(p_name), v_code, v_uid)
      returning id into v_team_id;
      exit;
    exception when unique_violation then
      -- สุ่มใหม่เฉพาะกรณี invite code ชนกัน
    end;
  end loop;

  insert into public.team_members (user_id, team_id)
  values (v_uid, v_team_id);

  return v_team_id;
exception
  when unique_violation then
    raise exception 'ALREADY_IN_TEAM';
end;
$$;

create or replace function public.join_team(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_team_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_LOGGED_IN';
  end if;
  if exists (
    select 1 from public.team_members where user_id = v_uid
  ) then
    raise exception 'ALREADY_IN_TEAM';
  end if;

  select t.id into v_team_id
  from public.teams as t
  where t.invite_code = upper(trim(p_invite_code));

  if v_team_id is null then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  insert into public.team_members (user_id, team_id)
  values (v_uid, v_team_id);

  return v_team_id;
exception
  when unique_violation then
    raise exception 'ALREADY_IN_TEAM';
end;
$$;

revoke all on function public.create_team(text) from public, anon;
revoke all on function public.join_team(text) from public, anon;
grant execute on function public.create_team(text) to authenticated;
grant execute on function public.join_team(text) to authenticated;

create or replace function public.tasks_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.team_id is distinct from old.team_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'IMMUTABLE_TASK_FIELDS';
  end if;

  if not public.is_team_owner(old.team_id) then
    if old.assignee_id is distinct from (select auth.uid()) then
      raise exception 'NOT_ALLOWED';
    end if;

    if new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.due_date is distinct from old.due_date
      or new.assignee_id is distinct from old.assignee_id then
      raise exception 'ONLY_STATUS_ALLOWED';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.tasks_guard_update() from public, anon, authenticated;

create trigger tasks_guard_update
before update on public.tasks
for each row execute function public.tasks_guard_update();
