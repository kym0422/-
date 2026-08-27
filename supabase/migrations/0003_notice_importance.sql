-- Persist the priority flag that the notice UI already exposes. Linked calendar
-- events remain the source of the calendar relation; this column keeps priority
-- even when a notice is not shown on the calendar.

alter table public.notices
  add column if not exists is_important boolean not null default false;

-- Preserve the priority currently shown by any already-linked event.
update public.notices n
set is_important = ce.is_important
from public.calendar_events ce
where ce.notice_id = n.id;

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
    raise exception '연결된 공지를 찾을 수 없습니다.' using errcode = '23503';
  end if;

  new.title := linked_notice.title;
  new.description := linked_notice.content;
  new.start_at := linked_notice.starts_on::timestamp at time zone 'Asia/Seoul';
  new.end_at := (coalesce(linked_notice.ends_on, linked_notice.starts_on) + 1)::timestamp
                at time zone 'Asia/Seoul';
  new.is_important := linked_notice.is_important;
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
      is_important = new.is_important,
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

drop trigger if exists sync_notices_calendar on public.notices;
create trigger sync_notices_calendar
  after update of title, content, target_type, target_cohort_id, starts_on, ends_on, is_important on public.notices
  for each row execute function public.sync_linked_notice_event();
