-- Genoray internship management - initial Supabase schema
-- PostgreSQL 15 / Supabase compatible. All application timestamps are UTC timestamptz.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;

create type public.user_role as enum ('ADMIN', 'MENTOR', 'INTERN');
create type public.cohort_status as enum ('UPCOMING', 'ACTIVE', 'COMPLETED');
create type public.notice_target_type as enum ('ALL', 'ADMIN', 'MENTOR', 'INTERN', 'COHORT');
create type public.calendar_event_type as enum ('SCHEDULE', 'TODO');
create type public.calendar_visibility as enum ('ALL', 'PRIVATE', 'ADMIN', 'MENTOR', 'INTERN', 'COHORT');
create type public.board_resource_type as enum ('TEMPLATE', 'LIBRARY');
create type public.task_primary_category as enum ('SELF_STUDY', 'MENTOR_TASK', 'PROJECT', 'CUSTOM');
create type public.task_secondary_category as enum ('PROBLEM_SOLVING', 'WORK_PARTICIPATION', 'INNOVATION', 'CUSTOM');
create type public.task_difficulty as enum ('BASIC', 'INTERMEDIATE', 'ADVANCED');
create type public.task_expected_output as enum ('DOCUMENT', 'ANALYSIS_REPORT', 'PRESENTATION', 'PROTOTYPE', 'IDEA', 'CUSTOM');
create type public.weekly_project_type as enum ('PERSONAL_PROJECT', 'TEAM_PROJECT', 'OTHER');
create type public.record_status as enum ('ACTIVE', 'CANCELED');

create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  total_weeks smallint not null,
  status public.cohort_status not null default 'UPCOMING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cohorts_name_not_blank check (btrim(name) <> ''),
  constraint cohorts_date_order check (end_date >= start_date),
  constraint cohorts_total_weeks_range check (total_weeks between 1 and 104)
);

create unique index cohorts_name_unique_ci on public.cohorts (lower(name));
create unique index cohorts_one_active on public.cohorts (status) where status = 'ACTIVE';

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  name text not null,
  display_name text not null,
  email text not null,
  role public.user_role not null default 'INTERN',
  department text,
  cohort_id uuid references public.cohorts(id) on delete restrict,
  start_date date,
  end_date date,
  project_group text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_name_not_blank check (btrim(name) <> ''),
  constraint profiles_display_name_not_blank check (btrim(display_name) <> ''),
  constraint profiles_email_not_blank check (btrim(email) <> ''),
  constraint profiles_date_order check (end_date is null or start_date is null or end_date >= start_date)
);

create unique index profiles_email_unique_ci on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role) where is_active;
create index profiles_cohort_idx on public.profiles (cohort_id) where is_active;

alter table public.cohorts
  add column created_by uuid references public.profiles(id) on delete set null;

create table public.mentor_assignments (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  intern_id uuid not null references public.profiles(id) on delete restrict,
  primary_mentor_id uuid not null references public.profiles(id) on delete restrict,
  secondary_mentor_id uuid references public.profiles(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mentor_assignments_one_per_intern_cohort unique (cohort_id, intern_id),
  constraint mentor_assignments_distinct_mentors check (
    secondary_mentor_id is null or secondary_mentor_id <> primary_mentor_id
  )
);

create index mentor_assignments_primary_idx on public.mentor_assignments (primary_mentor_id, cohort_id);
create index mentor_assignments_secondary_idx on public.mentor_assignments (secondary_mentor_id, cohort_id)
  where secondary_mentor_id is not null;

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  target_type public.notice_target_type not null default 'ALL',
  target_cohort_id uuid references public.cohorts(id) on delete restrict,
  starts_on date not null default current_date,
  ends_on date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  author_display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notices_title_not_blank check (btrim(title) <> ''),
  constraint notices_content_not_blank check (btrim(content) <> ''),
  constraint notices_date_order check (ends_on is null or ends_on >= starts_on),
  constraint notices_cohort_target_consistency check (
    (target_type = 'COHORT' and target_cohort_id is not null)
    or (target_type <> 'COHORT' and target_cohort_id is null)
  )
);

create index notices_created_at_idx on public.notices (created_at desc);
create index notices_target_idx on public.notices (target_type, target_cohort_id);

create table public.notice_comments (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices(id) on delete cascade,
  content text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  author_display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notice_comments_content_not_blank check (btrim(content) <> '')
);

create index notice_comments_notice_idx on public.notice_comments (notice_id, created_at);

create table public.notice_attachments (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices(id) on delete cascade,
  comment_id uuid references public.notice_comments(id) on delete cascade,
  original_file_name text not null,
  storage_bucket text not null default 'notice-attachments',
  storage_path text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint notice_attachments_bucket check (storage_bucket = 'notice-attachments'),
  constraint notice_attachments_name_not_blank check (btrim(original_file_name) <> ''),
  constraint notice_attachments_path_not_blank check (btrim(storage_path) <> ''),
  constraint notice_attachments_size check (file_size_bytes between 1 and 26214400),
  constraint notice_attachments_storage_unique unique (storage_bucket, storage_path)
);

create index notice_attachments_notice_idx on public.notice_attachments (notice_id);
create index notice_attachments_comment_idx on public.notice_attachments (comment_id)
  where comment_id is not null;

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid unique references public.notices(id) on delete cascade,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  is_important boolean not null default false,
  event_type public.calendar_event_type not null default 'SCHEDULE',
  visibility public.calendar_visibility not null default 'ALL',
  target_cohort_id uuid references public.cohorts(id) on delete restrict,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_title_not_blank check (btrim(title) <> ''),
  constraint calendar_events_date_order check (end_at >= start_at),
  constraint calendar_events_todo_private check (event_type <> 'TODO' or visibility = 'PRIVATE'),
  constraint calendar_events_schedule_not_completed check (
    event_type = 'TODO' or (is_completed = false and completed_at is null)
  ),
  constraint calendar_events_completed_consistency check (
    (is_completed and completed_at is not null) or (not is_completed and completed_at is null)
  ),
  constraint calendar_events_cohort_visibility check (
    (visibility = 'COHORT' and target_cohort_id is not null)
    or (visibility <> 'COHORT' and target_cohort_id is null)
  )
);

create index calendar_events_range_idx on public.calendar_events (start_at, end_at);
create index calendar_events_creator_idx on public.calendar_events (created_by, event_type, start_at);
create index calendar_events_visible_idx on public.calendar_events (visibility, target_cohort_id, start_at);

create table public.board_resources (
  id uuid primary key default gen_random_uuid(),
  resource_type public.board_resource_type not null,
  title text not null,
  description text,
  original_file_name text not null,
  storage_bucket text not null default 'board-resources',
  storage_path text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  uploader_display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint board_resources_title_not_blank check (btrim(title) <> ''),
  constraint board_resources_file_name_not_blank check (btrim(original_file_name) <> ''),
  constraint board_resources_bucket check (storage_bucket = 'board-resources'),
  constraint board_resources_path_not_blank check (btrim(storage_path) <> ''),
  constraint board_resources_size check (file_size_bytes between 1 and 52428800),
  constraint board_resources_storage_unique unique (storage_bucket, storage_path)
);

create index board_resources_type_created_idx on public.board_resources (resource_type, created_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  intern_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  summary text,
  start_week smallint not null,
  end_week smallint not null,
  primary_category public.task_primary_category not null,
  primary_category_custom text,
  secondary_category public.task_secondary_category not null,
  secondary_category_custom text,
  difficulty public.task_difficulty not null,
  expected_output public.task_expected_output not null,
  expected_output_custom text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_not_blank check (btrim(title) <> ''),
  constraint tasks_week_order check (start_week >= 1 and end_week >= start_week),
  constraint tasks_primary_custom_consistency check (
    (primary_category = 'CUSTOM' and nullif(btrim(primary_category_custom), '') is not null)
    or (primary_category <> 'CUSTOM' and primary_category_custom is null)
  ),
  constraint tasks_secondary_custom_consistency check (
    (secondary_category = 'CUSTOM' and nullif(btrim(secondary_category_custom), '') is not null)
    or (secondary_category <> 'CUSTOM' and secondary_category_custom is null)
  ),
  constraint tasks_output_custom_consistency check (
    (expected_output = 'CUSTOM' and nullif(btrim(expected_output_custom), '') is not null)
    or (expected_output <> 'CUSTOM' and expected_output_custom is null)
  )
);

create index tasks_intern_timeline_idx on public.tasks (intern_id, cohort_id, start_week, end_week);
create index tasks_assigner_idx on public.tasks (assigned_by, created_at desc);

create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  intern_id uuid not null references public.profiles(id) on delete restrict,
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  project_type public.weekly_project_type not null,
  project_type_custom text,
  project_name text,
  week_number smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_reports_week_positive check (week_number >= 1),
  constraint weekly_reports_type_custom_consistency check (
    (project_type = 'OTHER' and nullif(btrim(project_type_custom), '') is not null)
    or (project_type <> 'OTHER' and project_type_custom is null)
  ),
  constraint weekly_reports_scope_unique unique (intern_id, cohort_id, project_type, week_number)
);

create index weekly_reports_cohort_week_idx on public.weekly_reports (cohort_id, week_number);

create table public.weekly_report_items (
  id uuid primary key default gen_random_uuid(),
  weekly_report_id uuid not null references public.weekly_reports(id) on delete cascade,
  sort_order integer not null,
  description text not null,
  progress smallint not null default 0,
  weekly_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_report_items_sort_order_nonnegative check (sort_order >= 0),
  constraint weekly_report_items_description_not_blank check (btrim(description) <> ''),
  constraint weekly_report_items_progress_range check (progress between 0 and 100),
  constraint weekly_report_items_sort_unique unique (weekly_report_id, sort_order)
);

create index weekly_report_items_report_idx on public.weekly_report_items (weekly_report_id, sort_order);

create table public.weekly_report_attachments (
  id uuid primary key default gen_random_uuid(),
  weekly_report_item_id uuid not null references public.weekly_report_items(id) on delete cascade,
  original_file_name text not null,
  storage_bucket text not null default 'weekly-report-attachments',
  storage_path text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint weekly_report_attachments_bucket check (storage_bucket = 'weekly-report-attachments'),
  constraint weekly_report_attachments_name_not_blank check (btrim(original_file_name) <> ''),
  constraint weekly_report_attachments_path_not_blank check (btrim(storage_path) <> ''),
  constraint weekly_report_attachments_size check (file_size_bytes between 1 and 26214400),
  constraint weekly_report_attachments_storage_unique unique (storage_bucket, storage_path)
);

create index weekly_report_attachments_item_idx
  on public.weekly_report_attachments (weekly_report_item_id);

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  intern_id uuid not null references public.profiles(id) on delete restrict,
  mentor_id uuid not null references public.profiles(id) on delete restrict,
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  title text not null,
  content text not null,
  status public.record_status not null default 'ACTIVE',
  submitted_at timestamptz not null default now(),
  read_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evaluations_title_not_blank check (btrim(title) <> ''),
  constraint evaluations_content_not_blank check (btrim(content) <> ''),
  constraint evaluations_cancel_consistency check (
    (status = 'ACTIVE' and canceled_at is null)
    or (status = 'CANCELED' and canceled_at is not null)
  )
);

create index evaluations_intern_idx on public.evaluations (intern_id, cohort_id, submitted_at desc);
create index evaluations_mentor_idx on public.evaluations (mentor_id, submitted_at desc);

-- Deliberately contains no owner/user/profile column. Product admins query only this table.
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  status public.record_status not null default 'ACTIVE',
  submitted_at timestamptz not null default now(),
  read_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suggestions_title_not_blank check (btrim(title) <> ''),
  constraint suggestions_content_not_blank check (btrim(content) <> ''),
  constraint suggestions_cancel_consistency check (
    (status = 'ACTIVE' and canceled_at is null)
    or (status = 'CANCELED' and canceled_at is not null)
  )
);

create index suggestions_submitted_idx on public.suggestions (submitted_at desc);
create index suggestions_unread_idx on public.suggestions (submitted_at desc)
  where read_at is null and status = 'ACTIVE';

-- Kept outside the API-exposed public schema; no grants are given to application roles.
create table private.suggestion_owner_mapping (
  suggestion_id uuid primary key references public.suggestions(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index suggestion_owner_mapping_owner_idx
  on private.suggestion_owner_mapping (owner_profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Session helpers. SECURITY DEFINER avoids recursive RLS checks; every object
-- is schema-qualified and the search_path is pinned.
-- ---------------------------------------------------------------------------

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.is_active
  limit 1
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.is_active
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_role() = 'ADMIN', false)
$$;

create or replace function public.is_mentor_of(target_intern_id uuid, target_cohort_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_role() = 'MENTOR', false)
    and exists (
      select 1
      from public.mentor_assignments ma
      where ma.intern_id = target_intern_id
        and (target_cohort_id is null or ma.cohort_id = target_cohort_id)
        and public.current_profile_id() in (ma.primary_mentor_id, ma.secondary_mentor_id)
    )
$$;

create or replace function public.is_current_intern_mentor(candidate_mentor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_role() = 'INTERN', false)
    and exists (
      select 1
      from public.mentor_assignments ma
      where ma.intern_id = public.current_profile_id()
        and candidate_mentor_id in (ma.primary_mentor_id, ma.secondary_mentor_id)
    )
$$;

create or replace function public.can_access_cohort(target_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user()
    and (
      public.is_admin()
      or exists (
        select 1
        from public.profiles p
        where p.id = public.current_profile_id()
          and p.cohort_id = target_cohort_id
      )
      or exists (
        select 1
        from public.mentor_assignments ma
        where ma.cohort_id = target_cohort_id
          and public.current_profile_id() in (ma.primary_mentor_id, ma.secondary_mentor_id)
      )
    )
$$;

create or replace function public.can_view_notice(target_notice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user()
    and exists (
      select 1
      from public.notices n
      where n.id = target_notice_id
        and (
          public.is_admin()
          or n.created_by = public.current_profile_id()
          or n.target_type = 'ALL'
          or n.target_type::text = public.current_role()::text
          or (n.target_type = 'COHORT' and public.can_access_cohort(n.target_cohort_id))
        )
    )
$$;

create or replace function public.can_view_calendar_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user()
    and exists (
      select 1
      from public.calendar_events ce
      where ce.id = target_event_id
        and (
          ce.created_by = public.current_profile_id()
          or ce.visibility = 'ALL'
          or (ce.visibility <> 'PRIVATE' and public.is_admin())
          or ce.visibility::text = public.current_role()::text
          or (ce.visibility = 'COHORT' and public.can_access_cohort(ce.target_cohort_id))
        )
    )
$$;

create or replace function public.can_view_task(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user()
    and exists (
      select 1
      from public.tasks t
      where t.id = target_task_id
        and (
          public.is_admin()
          or t.intern_id = public.current_profile_id()
          or public.is_mentor_of(t.intern_id, t.cohort_id)
        )
    )
$$;

create or replace function public.can_view_weekly_report(target_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user()
    and exists (
      select 1
      from public.weekly_reports wr
      where wr.id = target_report_id
        and (
          public.is_admin()
          or wr.intern_id = public.current_profile_id()
          or public.is_mentor_of(wr.intern_id, wr.cohort_id)
        )
    )
$$;

create or replace function public.can_edit_weekly_report(target_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_role() = 'INTERN', false)
    and exists (
      select 1
      from public.weekly_reports wr
      where wr.id = target_report_id
        and wr.intern_id = public.current_profile_id()
    )
$$;

create or replace function public.can_view_weekly_item(target_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.weekly_report_items wri
    where wri.id = target_item_id
      and public.can_view_weekly_report(wri.weekly_report_id)
  )
$$;

create or replace function public.can_edit_weekly_item(target_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.weekly_report_items wri
    where wri.id = target_item_id
      and public.can_edit_weekly_report(wri.weekly_report_id)
  )
$$;

create or replace function public.is_suggestion_owner(target_suggestion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = private, public, pg_temp
as $$
  select coalesce(public.current_role() = 'INTERN', false)
    and exists (
      select 1
      from private.suggestion_owner_mapping som
      where som.suggestion_id = target_suggestion_id
        and som.owner_profile_id = public.current_profile_id()
    )
$$;

-- Safe members directory for ADMIN/MENTOR. It intentionally omits email,
-- auth_user_id, individual dates and active-state administration fields.
create or replace function public.list_members_directory(target_cohort_id uuid default null)
returns table (
  id uuid,
  name text,
  display_name text,
  role public.user_role,
  department text,
  cohort_id uuid,
  cohort_name text,
  project_group text,
  primary_mentor_id uuid,
  primary_mentor_name text,
  secondary_mentor_id uuid,
  secondary_mentor_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.name,
    p.display_name,
    p.role,
    p.department,
    p.cohort_id,
    c.name,
    p.project_group,
    case when p.role = 'INTERN' then ma.primary_mentor_id end,
    case when p.role = 'INTERN' then coalesce(pm.display_name, pm.name) end,
    case when p.role = 'INTERN' then ma.secondary_mentor_id end,
    case when p.role = 'INTERN' then coalesce(sm.display_name, sm.name) end
  from public.profiles p
  left join public.cohorts c on c.id = p.cohort_id
  left join public.mentor_assignments ma
    on ma.intern_id = p.id and ma.cohort_id = p.cohort_id
  left join public.profiles pm on pm.id = ma.primary_mentor_id
  left join public.profiles sm on sm.id = ma.secondary_mentor_id
  where public.current_role() in ('ADMIN', 'MENTOR')
    and p.is_active
    and (
      target_cohort_id is null
      or p.role <> 'INTERN'
      or p.cohort_id = target_cohort_id
    )
  order by
    case p.role when 'ADMIN' then 1 when 'MENTOR' then 2 else 3 end,
    p.name
$$;

-- ---------------------------------------------------------------------------
-- Validation, audit and normalization triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace function public.protect_created_by()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (to_jsonb(new) -> 'id') is distinct from (to_jsonb(old) -> 'id')
     or (to_jsonb(new) -> 'created_by') is distinct from (to_jsonb(old) -> 'created_by')
     or (to_jsonb(new) -> 'created_at') is distinct from (to_jsonb(old) -> 'created_at')
     or (to_jsonb(new) -> 'author_display_name') is distinct from (to_jsonb(old) -> 'author_display_name') then
    raise exception '생성자와 생성 시각은 변경할 수 없습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  fallback_name text;
begin
  fallback_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    '신규 사용자'
  );

  insert into public.profiles (
    auth_user_id,
    name,
    display_name,
    email,
    role,
    is_active
  ) values (
    new.id,
    fallback_name,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), fallback_name),
    coalesce(new.email, new.id::text || '@pending.invalid'),
    'INTERN',
    false
  )
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.protect_profile_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id <> old.id
     or new.auth_user_id <> old.auth_user_id
     or new.created_at <> old.created_at then
    raise exception '프로필의 식별자와 생성 시각은 변경할 수 없습니다.' using errcode = '42501';
  end if;

  if auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if old.auth_user_id = auth.uid()
     and new.id = old.id
     and new.auth_user_id = old.auth_user_id
     and new.email = old.email
     and new.role = old.role
     and new.department is not distinct from old.department
     and new.cohort_id is not distinct from old.cohort_id
     and new.start_date is not distinct from old.start_date
     and new.end_date is not distinct from old.end_date
     and new.project_group is not distinct from old.project_group
     and new.is_active = old.is_active
     and new.created_at = old.created_at then
    return new;
  end if;

  raise exception '본인은 이름과 표시 이름만 변경할 수 있습니다.' using errcode = '42501';
end;
$$;

create or replace function public.validate_mentor_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  intern_role public.user_role;
  intern_cohort uuid;
  primary_role public.user_role;
  secondary_role public.user_role;
begin
  select role, cohort_id into intern_role, intern_cohort
  from public.profiles where id = new.intern_id;
  select role into primary_role from public.profiles where id = new.primary_mentor_id;

  if intern_role is distinct from 'INTERN' or intern_cohort is distinct from new.cohort_id then
    raise exception '인턴과 기수 정보가 일치하지 않습니다.' using errcode = '23514';
  end if;
  if primary_role is distinct from 'MENTOR' then
    raise exception '담당 멘토는 MENTOR 역할이어야 합니다.' using errcode = '23514';
  end if;
  if new.secondary_mentor_id is not null then
    select role into secondary_role from public.profiles where id = new.secondary_mentor_id;
    if secondary_role is distinct from 'MENTOR' then
      raise exception '서브 멘토는 MENTOR 역할이어야 합니다.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.fill_notice_author()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select coalesce(p.display_name, p.name) into new.author_display_name
  from public.profiles p where p.id = new.created_by;
  if new.author_display_name is null then
    raise exception '공지 작성자 프로필이 없습니다.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create or replace function public.fill_comment_author()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select coalesce(p.display_name, p.name) into new.author_display_name
  from public.profiles p where p.id = new.created_by;
  if new.author_display_name is null then
    raise exception '댓글 작성자 프로필이 없습니다.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create or replace function public.fill_resource_uploader()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select coalesce(p.display_name, p.name) into new.uploader_display_name
  from public.profiles p where p.id = new.uploaded_by;
  if new.uploader_display_name is null then
    raise exception '업로더 프로필이 없습니다.' using errcode = '23503';
  end if;
  return new;
end;
$$;

create or replace function public.protect_board_resource_file()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id <> old.id
     or new.storage_bucket <> old.storage_bucket
     or new.storage_path <> old.storage_path
     or new.original_file_name <> old.original_file_name
     or new.mime_type <> old.mime_type
     or new.file_size_bytes <> old.file_size_bytes
     or new.uploaded_by <> old.uploaded_by
     or new.uploader_display_name <> old.uploader_display_name
     or new.created_at <> old.created_at then
    raise exception '업로드된 파일의 경로와 업로더 정보는 변경할 수 없습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.validate_notice_attachment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  comment_notice_id uuid;
  comment_author_id uuid;
begin
  if new.comment_id is null then
    if auth.uid() is not null and not public.is_admin() then
      raise exception '공지 본문 첨부파일은 관리자만 등록할 수 있습니다.' using errcode = '42501';
    end if;
  else
    select nc.notice_id, nc.created_by into comment_notice_id, comment_author_id
    from public.notice_comments nc where nc.id = new.comment_id;
    if comment_notice_id is distinct from new.notice_id then
      raise exception '첨부파일의 공지와 댓글이 일치하지 않습니다.' using errcode = '23514';
    end if;
    if auth.uid() is not null and not public.is_admin() and comment_author_id <> new.uploaded_by then
      raise exception '본인 댓글에만 첨부파일을 등록할 수 있습니다.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.validate_calendar_event()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.event_type = 'TODO' then
    new.visibility := 'PRIVATE';
    new.target_cohort_id := null;
  end if;

  if not new.is_completed then
    new.completed_at := null;
  elsif new.completed_at is null then
    new.completed_at := clock_timestamp();
  end if;
  return new;
end;
$$;

create or replace function public.normalize_linked_notice_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  linked_notice public.notices%rowtype;
begin
  if new.notice_id is null then
    return new;
  end if;

  select * into linked_notice from public.notices n where n.id = new.notice_id;
  if not found then
    raise exception '연결할 공지가 없습니다.' using errcode = '23503';
  end if;

  new.title := linked_notice.title;
  new.description := linked_notice.content;
  new.start_at := linked_notice.starts_on::timestamp at time zone 'Asia/Seoul';
  new.end_at := (coalesce(linked_notice.ends_on, linked_notice.starts_on) + 1)::timestamp
                at time zone 'Asia/Seoul';
  new.event_type := 'SCHEDULE';
  new.created_by := linked_notice.created_by;
  new.target_cohort_id := linked_notice.target_cohort_id;
  new.visibility := case linked_notice.target_type
    when 'ALL' then 'ALL'::public.calendar_visibility
    when 'ADMIN' then 'ADMIN'::public.calendar_visibility
    when 'MENTOR' then 'MENTOR'::public.calendar_visibility
    when 'INTERN' then 'INTERN'::public.calendar_visibility
    when 'COHORT' then 'COHORT'::public.calendar_visibility
  end;
  return new;
end;
$$;

create or replace function public.sync_linked_notice_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.calendar_events
  set title = new.title,
      description = new.content,
      start_at = new.starts_on::timestamp at time zone 'Asia/Seoul',
      end_at = (coalesce(new.ends_on, new.starts_on) + 1)::timestamp at time zone 'Asia/Seoul',
      visibility = case new.target_type
        when 'ALL' then 'ALL'::public.calendar_visibility
        when 'ADMIN' then 'ADMIN'::public.calendar_visibility
        when 'MENTOR' then 'MENTOR'::public.calendar_visibility
        when 'INTERN' then 'INTERN'::public.calendar_visibility
        when 'COHORT' then 'COHORT'::public.calendar_visibility
      end,
      target_cohort_id = new.target_cohort_id
  where notice_id = new.id;
  return new;
end;
$$;

create or replace function public.validate_task_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  intern_role public.user_role;
  intern_cohort uuid;
  assigner_role public.user_role;
  cohort_weeks smallint;
begin
  select p.role, p.cohort_id into intern_role, intern_cohort
  from public.profiles p where p.id = new.intern_id;
  select c.total_weeks into cohort_weeks from public.cohorts c where c.id = new.cohort_id;

  if intern_role is distinct from 'INTERN' or intern_cohort is distinct from new.cohort_id then
    raise exception '과제 대상 인턴과 기수가 일치하지 않습니다.' using errcode = '23514';
  end if;
  if cohort_weeks is null or new.end_week > cohort_weeks then
    raise exception '과제 종료 주차는 기수 총 주차를 넘을 수 없습니다.' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    select p.role into assigner_role from public.profiles p where p.id = new.assigned_by;
    if assigner_role not in ('ADMIN', 'MENTOR') then
      raise exception '과제 배정자는 관리자 또는 멘토여야 합니다.' using errcode = '23514';
    end if;
    if assigner_role = 'MENTOR' and not exists (
      select 1 from public.mentor_assignments ma
      where ma.intern_id = new.intern_id
        and ma.cohort_id = new.cohort_id
        and new.assigned_by in (ma.primary_mentor_id, ma.secondary_mentor_id)
    ) then
      raise exception '담당 인턴에게만 과제를 배정할 수 있습니다.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.protect_task_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id <> old.id
     or new.cohort_id <> old.cohort_id
     or new.intern_id <> old.intern_id
     or new.assigned_by <> old.assigned_by
     or new.created_at <> old.created_at then
    raise exception '과제의 대상, 기수, 배정자는 변경할 수 없습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.validate_weekly_report_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  intern_role public.user_role;
  intern_cohort uuid;
  cohort_weeks smallint;
begin
  select p.role, p.cohort_id into intern_role, intern_cohort
  from public.profiles p where p.id = new.intern_id;
  select c.total_weeks into cohort_weeks from public.cohorts c where c.id = new.cohort_id;

  if intern_role is distinct from 'INTERN' or intern_cohort is distinct from new.cohort_id then
    raise exception '주간보고 인턴과 기수가 일치하지 않습니다.' using errcode = '23514';
  end if;
  if cohort_weeks is null or new.week_number > cohort_weeks then
    raise exception '주차는 기수 총 주차를 넘을 수 없습니다.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.protect_weekly_report_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id <> old.id
     or new.intern_id <> old.intern_id
     or new.cohort_id <> old.cohort_id
     or new.project_type <> old.project_type
     or new.week_number <> old.week_number
     or new.created_at <> old.created_at then
    raise exception '주간보고의 인턴, 기수, 유형, 주차는 변경할 수 없습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.protect_weekly_item_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id <> old.id
     or new.weekly_report_id <> old.weekly_report_id
     or new.created_at <> old.created_at then
    raise exception '작업 항목의 보고서와 생성 시각은 변경할 수 없습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.validate_evaluation_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  intern_role public.user_role;
  intern_cohort uuid;
  author_role public.user_role;
begin
  select p.role, p.cohort_id into intern_role, intern_cohort
  from public.profiles p where p.id = new.intern_id;
  select p.role into author_role from public.profiles p where p.id = new.mentor_id;

  if intern_role is distinct from 'INTERN' or intern_cohort is distinct from new.cohort_id then
    raise exception '평가 대상 인턴과 기수가 일치하지 않습니다.' using errcode = '23514';
  end if;
  if author_role is distinct from 'MENTOR' then
    raise exception '평가 작성자는 멘토여야 합니다.' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and not exists (
    select 1 from public.mentor_assignments ma
    where ma.intern_id = new.intern_id
      and ma.cohort_id = new.cohort_id
      and new.mentor_id in (ma.primary_mentor_id, ma.secondary_mentor_id)
  ) then
    raise exception '담당 인턴에게만 평가를 작성할 수 있습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.protect_evaluation_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if new.id <> old.id
     or new.intern_id <> old.intern_id
     or new.mentor_id <> old.mentor_id
     or new.cohort_id <> old.cohort_id
     or new.title <> old.title
     or new.content <> old.content
     or new.submitted_at <> old.submitted_at
     or new.created_at <> old.created_at then
    raise exception '제출된 평가는 내용이나 대상을 변경할 수 없습니다.' using errcode = '42501';
  end if;

  if public.is_admin() then
    if new.status <> old.status or new.canceled_at is distinct from old.canceled_at then
      raise exception '관리자는 평가의 읽음 상태만 변경할 수 있습니다.' using errcode = '42501';
    end if;
    new.read_at := coalesce(old.read_at, clock_timestamp());
    return new;
  end if;

  if public.current_role() = 'MENTOR' and old.mentor_id = public.current_profile_id() then
    if new.read_at is distinct from old.read_at
       or old.status <> 'ACTIVE'
       or new.status <> 'CANCELED' then
      raise exception '멘토는 본인의 활성 평가를 취소만 할 수 있습니다.' using errcode = '42501';
    end if;
    new.canceled_at := clock_timestamp();
    return new;
  end if;

  raise exception '평가를 변경할 권한이 없습니다.' using errcode = '42501';
end;
$$;

create or replace function public.protect_suggestion_update()
returns trigger
language plpgsql
set search_path = private, public, pg_temp
as $$
begin
  if auth.role() = 'service_role' or current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if new.id <> old.id
     or new.title <> old.title
     or new.content <> old.content
     or new.submitted_at <> old.submitted_at
     or new.created_at <> old.created_at then
    raise exception '제출된 건의의 내용은 변경할 수 없습니다.' using errcode = '42501';
  end if;

  if public.is_admin() then
    if new.status <> old.status or new.canceled_at is distinct from old.canceled_at then
      raise exception '관리자는 건의의 읽음 상태만 변경할 수 있습니다.' using errcode = '42501';
    end if;
    new.read_at := coalesce(old.read_at, clock_timestamp());
    return new;
  end if;

  if public.is_suggestion_owner(old.id) then
    if new.read_at is distinct from old.read_at
       or old.status <> 'ACTIVE'
       or new.status <> 'CANCELED' then
      raise exception '본인의 활성 건의만 취소할 수 있습니다.' using errcode = '42501';
    end if;
    new.canceled_at := clock_timestamp();
    return new;
  end if;

  raise exception '건의를 변경할 권한이 없습니다.' using errcode = '42501';
end;
$$;

create or replace function public.submit_suggestion(suggestion_title text, suggestion_content text)
returns public.suggestions
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
declare
  owner_id uuid;
  submitted public.suggestions%rowtype;
begin
  if public.current_role() is distinct from 'INTERN' then
    raise exception '활성 인턴만 익명 건의를 제출할 수 있습니다.' using errcode = '42501';
  end if;
  if nullif(btrim(suggestion_title), '') is null or nullif(btrim(suggestion_content), '') is null then
    raise exception '제목과 내용을 입력해 주세요.' using errcode = '22023';
  end if;

  owner_id := public.current_profile_id();
  insert into public.suggestions (title, content)
  values (btrim(suggestion_title), btrim(suggestion_content))
  returning * into submitted;

  insert into private.suggestion_owner_mapping (suggestion_id, owner_profile_id)
  values (submitted.id, owner_id);

  return submitted;
end;
$$;

create or replace function public.cancel_own_suggestion(target_suggestion_id uuid)
returns public.suggestions
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
declare
  canceled public.suggestions%rowtype;
begin
  if not public.is_suggestion_owner(target_suggestion_id) then
    raise exception '본인의 건의만 취소할 수 있습니다.' using errcode = '42501';
  end if;

  update public.suggestions
  set status = 'CANCELED', canceled_at = clock_timestamp()
  where id = target_suggestion_id and status = 'ACTIVE'
  returning * into canceled;

  if canceled.id is null then
    raise exception '이미 취소되었거나 존재하지 않는 건의입니다.' using errcode = 'P0002';
  end if;
  return canceled;
end;
$$;

create or replace function public.mark_suggestion_read(target_suggestion_id uuid)
returns public.suggestions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  marked public.suggestions%rowtype;
begin
  if not public.is_admin() then
    raise exception '관리자만 건의를 읽음 처리할 수 있습니다.' using errcode = '42501';
  end if;

  update public.suggestions
  set read_at = coalesce(read_at, clock_timestamp())
  where id = target_suggestion_id
  returning * into marked;

  if marked.id is null then
    raise exception '건의를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  return marked;
end;
$$;

-- Triggers are alphabetically ordered per table; protection runs before touch.
create trigger a_protect_profile_update
  before update on public.profiles
  for each row execute function public.protect_profile_update();
create trigger z_set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger a_protect_cohorts_creator
  before update on public.cohorts
  for each row execute function public.protect_created_by();
create trigger validate_mentor_assignments
  before insert or update on public.mentor_assignments
  for each row execute function public.validate_mentor_assignment();
create trigger z_set_mentor_assignments_updated_at
  before update on public.mentor_assignments
  for each row execute function public.set_updated_at();

create trigger a_protect_mentor_assignments_creator
  before update on public.mentor_assignments
  for each row execute function public.protect_created_by();
create trigger z_set_cohorts_updated_at
  before update on public.cohorts
  for each row execute function public.set_updated_at();

create trigger a_protect_notices_creator
  before update on public.notices
  for each row execute function public.protect_created_by();
create trigger fill_notices_author
  before insert on public.notices
  for each row execute function public.fill_notice_author();
create trigger sync_notices_calendar
  after update of title, content, target_type, target_cohort_id, starts_on, ends_on on public.notices
  for each row execute function public.sync_linked_notice_event();
create trigger z_set_notices_updated_at
  before update on public.notices
  for each row execute function public.set_updated_at();

create trigger fill_notice_comments_author
  before insert on public.notice_comments
  for each row execute function public.fill_comment_author();
create trigger z_set_notice_comments_updated_at
  before update on public.notice_comments
  for each row execute function public.set_updated_at();

create trigger validate_notice_attachments
  before insert on public.notice_attachments
  for each row execute function public.validate_notice_attachment();

create trigger normalize_calendar_notice
  before insert or update on public.calendar_events
  for each row execute function public.normalize_linked_notice_event();
create trigger validate_calendar_event
  before insert or update on public.calendar_events
  for each row execute function public.validate_calendar_event();
create trigger a_protect_calendar_events_creator
  before update on public.calendar_events
  for each row execute function public.protect_created_by();
create trigger z_set_calendar_events_updated_at
  before update on public.calendar_events
  for each row execute function public.set_updated_at();

create trigger fill_board_resources_uploader
  before insert on public.board_resources
  for each row execute function public.fill_resource_uploader();
create trigger a_protect_board_resources_file
  before update on public.board_resources
  for each row execute function public.protect_board_resource_file();
create trigger z_set_board_resources_updated_at
  before update on public.board_resources
  for each row execute function public.set_updated_at();

create trigger a_protect_tasks_identity
  before update on public.tasks
  for each row execute function public.protect_task_identity();
create trigger validate_tasks_scope
  before insert or update on public.tasks
  for each row execute function public.validate_task_scope();
create trigger z_set_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger a_protect_weekly_reports_scope
  before update on public.weekly_reports
  for each row execute function public.protect_weekly_report_scope();
create trigger validate_weekly_reports_scope
  before insert or update on public.weekly_reports
  for each row execute function public.validate_weekly_report_scope();
create trigger z_set_weekly_reports_updated_at
  before update on public.weekly_reports
  for each row execute function public.set_updated_at();

create trigger a_protect_weekly_report_items_identity
  before update on public.weekly_report_items
  for each row execute function public.protect_weekly_item_identity();
create trigger z_set_weekly_report_items_updated_at
  before update on public.weekly_report_items
  for each row execute function public.set_updated_at();

create trigger a_protect_evaluations_update
  before update on public.evaluations
  for each row execute function public.protect_evaluation_update();
create trigger validate_evaluations_scope
  before insert on public.evaluations
  for each row execute function public.validate_evaluation_scope();
create trigger z_set_evaluations_updated_at
  before update on public.evaluations
  for each row execute function public.set_updated_at();

create trigger a_protect_suggestions_update
  before update on public.suggestions
  for each row execute function public.protect_suggestion_update();
create trigger z_set_suggestions_updated_at
  before update on public.suggestions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.cohorts enable row level security;
alter table public.profiles enable row level security;
alter table public.mentor_assignments enable row level security;
alter table public.notices enable row level security;
alter table public.notice_comments enable row level security;
alter table public.notice_attachments enable row level security;
alter table public.calendar_events enable row level security;
alter table public.board_resources enable row level security;
alter table public.tasks enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.weekly_report_items enable row level security;
alter table public.weekly_report_attachments enable row level security;
alter table public.evaluations enable row level security;
alter table public.suggestions enable row level security;
alter table private.suggestion_owner_mapping enable row level security;
alter table private.suggestion_owner_mapping force row level security;

create policy profiles_select
on public.profiles for select to authenticated
using (
  public.is_active_user()
  and (
    public.is_admin()
    or id = public.current_profile_id()
    or public.is_mentor_of(id, cohort_id)
    or public.is_current_intern_mentor(id)
  )
);

create policy profiles_insert_admin
on public.profiles for insert to authenticated
with check (public.is_admin());

create policy profiles_update_admin_or_self
on public.profiles for update to authenticated
using (public.is_admin() or id = public.current_profile_id())
with check (public.is_admin() or id = public.current_profile_id());

create policy cohorts_select_accessible
on public.cohorts for select to authenticated
using (public.can_access_cohort(id));

create policy cohorts_insert_admin
on public.cohorts for insert to authenticated
with check (public.is_admin() and created_by = public.current_profile_id());

create policy cohorts_update_admin
on public.cohorts for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy cohorts_delete_admin
on public.cohorts for delete to authenticated
using (public.is_admin());

create policy mentor_assignments_select
on public.mentor_assignments for select to authenticated
using (
  public.is_active_user()
  and (
    public.is_admin()
    or intern_id = public.current_profile_id()
    or public.current_profile_id() in (primary_mentor_id, secondary_mentor_id)
  )
);

create policy mentor_assignments_insert_admin
on public.mentor_assignments for insert to authenticated
with check (public.is_admin() and created_by = public.current_profile_id());

create policy mentor_assignments_update_admin
on public.mentor_assignments for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy mentor_assignments_delete_admin
on public.mentor_assignments for delete to authenticated
using (public.is_admin());

create policy notices_select_visible
on public.notices for select to authenticated
using (public.can_view_notice(id));

create policy notices_insert_admin
on public.notices for insert to authenticated
with check (public.is_admin() and created_by = public.current_profile_id());

create policy notices_update_admin
on public.notices for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy notices_delete_admin
on public.notices for delete to authenticated
using (public.is_admin());

create policy notice_comments_select_visible
on public.notice_comments for select to authenticated
using (public.can_view_notice(notice_id));

create policy notice_comments_insert_visible
on public.notice_comments for insert to authenticated
with check (
  public.is_active_user()
  and created_by = public.current_profile_id()
  and public.can_view_notice(notice_id)
);

create policy notice_comments_delete_author_or_admin
on public.notice_comments for delete to authenticated
using (
  public.is_active_user()
  and (created_by = public.current_profile_id() or public.is_admin())
);

create policy notice_attachments_select_visible
on public.notice_attachments for select to authenticated
using (public.can_view_notice(notice_id));

create policy notice_attachments_insert_authorized
on public.notice_attachments for insert to authenticated
with check (
  uploaded_by = public.current_profile_id()
  and public.can_view_notice(notice_id)
  and split_part(storage_path, '/', 1) = auth.uid()::text
  and (
    (comment_id is null and public.is_admin())
    or exists (
      select 1 from public.notice_comments nc
      where nc.id = notice_attachments.comment_id
        and nc.notice_id = notice_attachments.notice_id
        and (nc.created_by = public.current_profile_id() or public.is_admin())
    )
  )
);

create policy notice_attachments_delete_uploader_or_admin
on public.notice_attachments for delete to authenticated
using (
  public.is_active_user()
  and (uploaded_by = public.current_profile_id() or public.is_admin())
);

create policy calendar_events_select_visible
on public.calendar_events for select to authenticated
using (public.can_view_calendar_event(id));

create policy calendar_events_insert_own
on public.calendar_events for insert to authenticated
with check (
  public.is_active_user()
  and created_by = public.current_profile_id()
  and (
    public.is_admin()
    or visibility in ('ALL', 'PRIVATE')
    or visibility::text = public.current_role()::text
    or (visibility = 'COHORT' and public.can_access_cohort(target_cohort_id))
  )
);

create policy calendar_events_update_own
on public.calendar_events for update to authenticated
using (public.is_active_user() and created_by = public.current_profile_id())
with check (
  public.is_active_user()
  and created_by = public.current_profile_id()
  and (
    public.is_admin()
    or visibility in ('ALL', 'PRIVATE')
    or visibility::text = public.current_role()::text
    or (visibility = 'COHORT' and public.can_access_cohort(target_cohort_id))
  )
);

create policy calendar_events_delete_own
on public.calendar_events for delete to authenticated
using (public.is_active_user() and created_by = public.current_profile_id());

create policy board_resources_select
on public.board_resources for select to authenticated
using (public.is_active_user());

create policy board_resources_insert
on public.board_resources for insert to authenticated
with check (
  public.is_active_user()
  and uploaded_by = public.current_profile_id()
  and split_part(storage_path, '/', 1) = auth.uid()::text
);

create policy board_resources_update_owner_or_admin
on public.board_resources for update to authenticated
using (
  public.is_active_user()
  and (uploaded_by = public.current_profile_id() or public.is_admin())
)
with check (
  public.is_active_user()
  and (uploaded_by = public.current_profile_id() or public.is_admin())
);

create policy board_resources_delete_owner_or_admin
on public.board_resources for delete to authenticated
using (
  public.is_active_user()
  and (uploaded_by = public.current_profile_id() or public.is_admin())
);

create policy tasks_select_authorized
on public.tasks for select to authenticated
using (public.can_view_task(id));

create policy tasks_insert_authorized
on public.tasks for insert to authenticated
with check (
  assigned_by = public.current_profile_id()
  and (
    public.is_admin()
    or public.is_mentor_of(intern_id, cohort_id)
  )
);

create policy tasks_update_authorized
on public.tasks for update to authenticated
using (public.is_admin() or public.is_mentor_of(intern_id, cohort_id))
with check (public.is_admin() or public.is_mentor_of(intern_id, cohort_id));

create policy tasks_delete_authorized
on public.tasks for delete to authenticated
using (public.is_admin() or public.is_mentor_of(intern_id, cohort_id));

create policy weekly_reports_select_authorized
on public.weekly_reports for select to authenticated
using (public.can_view_weekly_report(id));

create policy weekly_reports_insert_own
on public.weekly_reports for insert to authenticated
with check (
  public.current_role() = 'INTERN'
  and intern_id = public.current_profile_id()
  and public.can_access_cohort(cohort_id)
);

create policy weekly_reports_update_own
on public.weekly_reports for update to authenticated
using (public.can_edit_weekly_report(id))
with check (intern_id = public.current_profile_id());

create policy weekly_reports_delete_own
on public.weekly_reports for delete to authenticated
using (public.can_edit_weekly_report(id));

create policy weekly_report_items_select_authorized
on public.weekly_report_items for select to authenticated
using (public.can_view_weekly_report(weekly_report_id));

create policy weekly_report_items_insert_own
on public.weekly_report_items for insert to authenticated
with check (public.can_edit_weekly_report(weekly_report_id));

create policy weekly_report_items_update_own
on public.weekly_report_items for update to authenticated
using (public.can_edit_weekly_report(weekly_report_id))
with check (public.can_edit_weekly_report(weekly_report_id));

create policy weekly_report_items_delete_own
on public.weekly_report_items for delete to authenticated
using (public.can_edit_weekly_report(weekly_report_id));

create policy weekly_report_attachments_select_authorized
on public.weekly_report_attachments for select to authenticated
using (public.can_view_weekly_item(weekly_report_item_id));

create policy weekly_report_attachments_insert_own
on public.weekly_report_attachments for insert to authenticated
with check (
  uploaded_by = public.current_profile_id()
  and public.can_edit_weekly_item(weekly_report_item_id)
  and split_part(storage_path, '/', 1) = auth.uid()::text
);

create policy weekly_report_attachments_delete_own
on public.weekly_report_attachments for delete to authenticated
using (
  uploaded_by = public.current_profile_id()
  and public.can_edit_weekly_item(weekly_report_item_id)
);

create policy evaluations_select_admin_or_author
on public.evaluations for select to authenticated
using (
  public.is_active_user()
  and (public.is_admin() or mentor_id = public.current_profile_id())
);

create policy evaluations_insert_mentor
on public.evaluations for insert to authenticated
with check (
  public.current_role() = 'MENTOR'
  and mentor_id = public.current_profile_id()
  and public.is_mentor_of(intern_id, cohort_id)
  and status = 'ACTIVE'
  and read_at is null
  and canceled_at is null
);

create policy evaluations_update_admin_or_author
on public.evaluations for update to authenticated
using (
  public.is_active_user()
  and (public.is_admin() or mentor_id = public.current_profile_id())
)
with check (
  public.is_active_user()
  and (public.is_admin() or mentor_id = public.current_profile_id())
);

create policy suggestions_select_admin_or_owner
on public.suggestions for select to authenticated
using (public.is_admin() or public.is_suggestion_owner(id));

create policy suggestions_update_admin_or_owner
on public.suggestions for update to authenticated
using (public.is_admin() or public.is_suggestion_owner(id))
with check (public.is_admin() or public.is_suggestion_owner(id));

-- ---------------------------------------------------------------------------
-- API grants. RLS remains authoritative; anonymous callers receive no table data.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant usage on type public.user_role, public.cohort_status, public.notice_target_type,
  public.calendar_event_type, public.calendar_visibility, public.board_resource_type,
  public.task_primary_category, public.task_secondary_category, public.task_difficulty,
  public.task_expected_output, public.weekly_project_type, public.record_status
to authenticated;

revoke all on table public.cohorts, public.profiles, public.mentor_assignments,
  public.notices, public.notice_comments, public.notice_attachments,
  public.calendar_events, public.board_resources, public.tasks,
  public.weekly_reports, public.weekly_report_items, public.weekly_report_attachments,
  public.evaluations, public.suggestions
from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.cohorts to authenticated;
grant select, insert, update, delete on public.mentor_assignments to authenticated;
grant select, insert, update, delete on public.notices to authenticated;
grant select, insert, delete on public.notice_comments to authenticated;
grant select, insert, delete on public.notice_attachments to authenticated;
grant select, insert, update, delete on public.calendar_events to authenticated;
grant select, insert, update, delete on public.board_resources to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.weekly_reports to authenticated;
grant select, insert, update, delete on public.weekly_report_items to authenticated;
grant select, insert, delete on public.weekly_report_attachments to authenticated;
grant select, insert, update on public.evaluations to authenticated;
grant select, update on public.suggestions to authenticated;

revoke execute on function public.current_profile_id() from public, anon;
revoke execute on function public.current_role() from public, anon;
revoke execute on function public.is_active_user() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_mentor_of(uuid, uuid) from public, anon;
revoke execute on function public.is_current_intern_mentor(uuid) from public, anon;
revoke execute on function public.can_access_cohort(uuid) from public, anon;
revoke execute on function public.can_view_notice(uuid) from public, anon;
revoke execute on function public.can_view_calendar_event(uuid) from public, anon;
revoke execute on function public.can_view_task(uuid) from public, anon;
revoke execute on function public.can_view_weekly_report(uuid) from public, anon;
revoke execute on function public.can_edit_weekly_report(uuid) from public, anon;
revoke execute on function public.can_view_weekly_item(uuid) from public, anon;
revoke execute on function public.can_edit_weekly_item(uuid) from public, anon;
revoke execute on function public.is_suggestion_owner(uuid) from public, anon;
revoke execute on function public.list_members_directory(uuid) from public, anon;
revoke execute on function public.submit_suggestion(text, text) from public, anon;
revoke execute on function public.cancel_own_suggestion(uuid) from public, anon;
revoke execute on function public.mark_suggestion_read(uuid) from public, anon;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_mentor_of(uuid, uuid) to authenticated;
grant execute on function public.is_current_intern_mentor(uuid) to authenticated;
grant execute on function public.can_access_cohort(uuid) to authenticated;
grant execute on function public.can_view_notice(uuid) to authenticated;
grant execute on function public.can_view_calendar_event(uuid) to authenticated;
grant execute on function public.can_view_task(uuid) to authenticated;
grant execute on function public.can_view_weekly_report(uuid) to authenticated;
grant execute on function public.can_edit_weekly_report(uuid) to authenticated;
grant execute on function public.can_view_weekly_item(uuid) to authenticated;
grant execute on function public.can_edit_weekly_item(uuid) to authenticated;
grant execute on function public.is_suggestion_owner(uuid) to authenticated;
grant execute on function public.list_members_directory(uuid) to authenticated;
grant execute on function public.submit_suggestion(text, text) to authenticated;
grant execute on function public.cancel_own_suggestion(uuid) to authenticated;
grant execute on function public.mark_suggestion_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Private Storage buckets and object policies
-- Metadata must be inserted first, then the object uploaded to the exact path.
-- Path convention: <auth-user-id>/<entity-id>/<uuid>-<safe-file-name>
-- Delete the storage object before deleting its metadata row.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'notice-attachments',
    'notice-attachments',
    false,
    26214400,
    array[
      'application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'text/plain', 'text/csv', 'application/zip',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]::text[]
  ),
  (
    'weekly-report-attachments',
    'weekly-report-attachments',
    false,
    26214400,
    array[
      'application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'text/plain', 'text/csv', 'application/zip',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]::text[]
  ),
  (
    'board-resources',
    'board-resources',
    false,
    52428800,
    array[
      'application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'text/plain', 'text/csv', 'application/zip',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]::text[]
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy notice_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'notice-attachments'
  and exists (
    select 1
    from public.notice_attachments na
    where na.storage_bucket = storage.objects.bucket_id
      and na.storage_path = storage.objects.name
      and public.can_view_notice(na.notice_id)
  )
);

create policy notice_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'notice-attachments'
  and public.is_active_user()
  and split_part(name, '/', 1) = auth.uid()::text
  and exists (
    select 1
    from public.notice_attachments na
    join public.profiles p on p.id = na.uploaded_by
    where na.storage_bucket = storage.objects.bucket_id
      and na.storage_path = storage.objects.name
      and p.auth_user_id = auth.uid()
  )
);

create policy notice_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'notice-attachments'
  and public.is_active_user()
  and exists (
    select 1
    from public.notice_attachments na
    join public.profiles p on p.id = na.uploaded_by
    where na.storage_bucket = storage.objects.bucket_id
      and na.storage_path = storage.objects.name
      and (p.auth_user_id = auth.uid() or public.is_admin())
  )
);

create policy weekly_report_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'weekly-report-attachments'
  and exists (
    select 1
    from public.weekly_report_attachments wra
    where wra.storage_bucket = storage.objects.bucket_id
      and wra.storage_path = storage.objects.name
      and public.can_view_weekly_item(wra.weekly_report_item_id)
  )
);

create policy weekly_report_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'weekly-report-attachments'
  and public.current_role() = 'INTERN'
  and split_part(name, '/', 1) = auth.uid()::text
  and exists (
    select 1
    from public.weekly_report_attachments wra
    join public.profiles p on p.id = wra.uploaded_by
    where wra.storage_bucket = storage.objects.bucket_id
      and wra.storage_path = storage.objects.name
      and p.auth_user_id = auth.uid()
      and public.can_edit_weekly_item(wra.weekly_report_item_id)
  )
);

create policy weekly_report_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'weekly-report-attachments'
  and exists (
    select 1
    from public.weekly_report_attachments wra
    join public.profiles p on p.id = wra.uploaded_by
    where wra.storage_bucket = storage.objects.bucket_id
      and wra.storage_path = storage.objects.name
      and p.auth_user_id = auth.uid()
      and public.can_edit_weekly_item(wra.weekly_report_item_id)
  )
);

create policy board_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'board-resources'
  and public.is_active_user()
  and exists (
    select 1
    from public.board_resources br
    where br.storage_bucket = storage.objects.bucket_id
      and br.storage_path = storage.objects.name
  )
);

create policy board_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'board-resources'
  and public.is_active_user()
  and split_part(name, '/', 1) = auth.uid()::text
  and exists (
    select 1
    from public.board_resources br
    join public.profiles p on p.id = br.uploaded_by
    where br.storage_bucket = storage.objects.bucket_id
      and br.storage_path = storage.objects.name
      and p.auth_user_id = auth.uid()
  )
);

create policy board_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'board-resources'
  and public.is_active_user()
  and exists (
    select 1
    from public.board_resources br
    join public.profiles p on p.id = br.uploaded_by
    where br.storage_bucket = storage.objects.bucket_id
      and br.storage_path = storage.objects.name
      and (p.auth_user_id = auth.uid() or public.is_admin())
  )
);

comment on table public.suggestions is
  'Anonymous product data only. Author identity is isolated in private.suggestion_owner_mapping.';
comment on table private.suggestion_owner_mapping is
  'Confidential ownership map. Never expose or grant this table to authenticated/anon roles.';
comment on function public.submit_suggestion(text, text) is
  'Atomically creates an anonymous suggestion and its inaccessible ownership mapping.';
