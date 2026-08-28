-- Keep notice creation restricted to active administrators, while avoiding
-- current_profile_id/current_role evaluation differences across sessions.
drop policy if exists notices_insert_admin on public.notices;
create policy notices_insert_admin
on public.notices for insert to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = created_by
      and p.auth_user_id = auth.uid()
      and p.role = 'ADMIN'
      and p.is_active
  )
);

create or replace function public.create_notice(
  target_title text,
  target_content text,
  target_type public.notice_target_type,
  target_starts_on date,
  target_ends_on date,
  target_is_important boolean
)
returns table (id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  creator_id uuid;
  creator_name text;
begin
  select p.id, coalesce(p.display_name, p.name)
    into creator_id, creator_name
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.role = 'ADMIN'
    and p.is_active;

  if creator_id is null then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  return query
  insert into public.notices (
    title, content, target_type, target_cohort_id, starts_on, ends_on,
    created_by, author_display_name, is_important
  )
  values (
    btrim(target_title), btrim(target_content), target_type, null,
    target_starts_on, target_ends_on, creator_id, creator_name, target_is_important
  )
  returning public.notices.id;
end;
$$;

revoke execute on function public.create_notice(text, text, public.notice_target_type, date, date, boolean) from public, anon;
grant execute on function public.create_notice(text, text, public.notice_target_type, date, date, boolean) to authenticated;
