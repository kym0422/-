alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists phone text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_avatar_storage_select on storage.objects;
create policy profile_avatar_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and public.is_active_user()
);

drop policy if exists profile_avatar_storage_insert on storage.objects;
create policy profile_avatar_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and public.is_active_user()
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists profile_avatar_storage_delete on storage.objects;
create policy profile_avatar_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and public.is_active_user()
  and split_part(name, '/', 1) = auth.uid()::text
);

drop function if exists public.list_members_directory(uuid);

create function public.list_members_directory(target_cohort_id uuid default null)
returns table (
  id uuid,
  name text,
  display_name text,
  email text,
  phone text,
  role public.user_role,
  department text,
  avatar_url text,
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
    p.email,
    p.phone,
    p.role,
    p.department,
    p.avatar_url,
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

grant execute on function public.list_members_directory(uuid) to authenticated;
