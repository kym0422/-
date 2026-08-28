create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  href text not null default '/dashboard',
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_not_blank check (btrim(type) <> ''),
  constraint notifications_title_not_blank check (btrim(title) <> ''),
  constraint notifications_message_not_blank check (btrim(message) <> ''),
  constraint notifications_read_consistency check ((is_read and read_at is not null) or (not is_read and read_at is null))
);

create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated
using (recipient_id = public.current_profile_id());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated
using (recipient_id = public.current_profile_id())
with check (recipient_id = public.current_profile_id());

revoke all on table public.notifications from anon, authenticated;
grant select, update on public.notifications to authenticated;

create or replace function public.create_notification(
  target_recipient uuid,
  target_type text,
  target_title text,
  target_message text,
  target_entity_type text,
  target_entity_id uuid,
  target_href text
)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications (recipient_id, type, title, message, entity_type, entity_id, href)
  select target_recipient, target_type, target_title, target_message, target_entity_type, target_entity_id, target_href
  where exists (select 1 from public.profiles p where p.id = target_recipient and p.is_active);
$$;

create or replace function public.notify_notice_created()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.notifications (recipient_id, type, title, message, entity_type, entity_id, href)
  select p.id, 'NOTICE_CREATED', '새 공지사항', new.title, 'notice', new.id, '/notices'
  from public.profiles p
  where p.is_active and p.id <> new.created_by
    and (new.target_type = 'ALL' or new.target_type::text = p.role::text or (new.target_type = 'COHORT' and p.cohort_id = new.target_cohort_id));
  return new;
end;
$$;

create or replace function public.notify_calendar_event_created()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.event_type = 'TODO' then return new; end if;
  insert into public.notifications (recipient_id, type, title, message, entity_type, entity_id, href)
  select p.id, case when tg_op = 'INSERT' then 'SCHEDULE_CREATED' else 'SCHEDULE_UPDATED' end,
    case when tg_op = 'INSERT' then '새 일정이 등록되었습니다' else '일정이 변경되었습니다' end,
    new.title, 'calendar_event', new.id, '/calendar'
  from public.profiles p
  where p.is_active and p.id <> new.created_by
    and (new.visibility = 'ALL' or new.visibility::text = p.role::text or (new.visibility = 'COHORT' and p.cohort_id = new.target_cohort_id));
  return new;
end;
$$;

create or replace function public.notify_task_created()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.notifications (recipient_id, type, title, message, entity_type, entity_id, href)
  select p.id, case when tg_op = 'INSERT' then 'TASK_CREATED' else 'TASK_UPDATED' end,
    case when tg_op = 'INSERT' then '새 과제가 배정되었습니다' else '과제가 변경되었습니다' end,
    new.title, 'task', new.id,
    case when p.role = 'INTERN' then '/intern/tasks' else '/admin/tasks' end
  from public.profiles p
  where p.is_active and p.id <> new.assigned_by
    and (p.id = new.intern_id or p.role = 'ADMIN' or exists (
      select 1 from public.mentor_assignments ma
      where ma.intern_id = new.intern_id and ma.cohort_id = new.cohort_id
        and p.id in (ma.primary_mentor_id, ma.secondary_mentor_id)
    ));
  return new;
end;
$$;

create or replace function public.notify_weekly_report_created()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.notifications (recipient_id, type, title, message, entity_type, entity_id, href)
  select p.id, 'WEEKLY_REPORT_SUBMITTED', '주간 업무보고가 제출되었습니다', new.week_number || '주차 업무보고', 'weekly_report', new.id,
    case when p.role = 'ADMIN' then '/admin/weekly-reports' else '/mentor/weekly-reports' end
  from public.profiles p
  where p.is_active and p.id <> new.intern_id
    and (p.role = 'ADMIN' or exists (
      select 1 from public.mentor_assignments ma
      where ma.intern_id = new.intern_id and ma.cohort_id = new.cohort_id
        and p.id in (ma.primary_mentor_id, ma.secondary_mentor_id)
    ));
  return new;
end;
$$;

create or replace function public.notify_suggestion_created()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.notifications (recipient_id, type, title, message, entity_type, entity_id, href)
  select p.id, 'SUGGESTION_CREATED', '새 익명 건의가 등록되었습니다', new.title, 'suggestion', new.id, '/admin/suggestions'
  from public.profiles p where p.is_active and p.role = 'ADMIN';
  return new;
end;
$$;

create or replace function public.notify_evaluation_created()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.notifications (recipient_id, type, title, message, entity_type, entity_id, href)
    select p.id, 'EVALUATION_CREATED', '새 평가가 등록되었습니다', new.title, 'evaluation', new.id, '/dashboard'
  from public.profiles p where p.is_active and p.id = new.intern_id;
  return new;
end;
$$;

drop trigger if exists notifications_after_notice on public.notices;
create trigger notifications_after_notice after insert on public.notices for each row execute function public.notify_notice_created();
drop trigger if exists notifications_after_calendar on public.calendar_events;
create trigger notifications_after_calendar after insert or update of title, description, start_at, end_at, visibility, target_cohort_id on public.calendar_events for each row execute function public.notify_calendar_event_created();
drop trigger if exists notifications_after_task on public.tasks;
create trigger notifications_after_task after insert or update of title, summary, start_week, end_week, primary_category, secondary_category, difficulty, expected_output on public.tasks for each row execute function public.notify_task_created();
drop trigger if exists notifications_after_report on public.weekly_reports;
create trigger notifications_after_report after insert on public.weekly_reports for each row execute function public.notify_weekly_report_created();
drop trigger if exists notifications_after_suggestion on public.suggestions;
create trigger notifications_after_suggestion after insert on public.suggestions for each row execute function public.notify_suggestion_created();
drop trigger if exists notifications_after_evaluation on public.evaluations;
create trigger notifications_after_evaluation after insert on public.evaluations for each row execute function public.notify_evaluation_created();

grant execute on function public.create_notification(uuid, text, text, text, text, uuid, text) to authenticated;
