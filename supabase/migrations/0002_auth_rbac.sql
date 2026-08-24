-- Auth/RBAC hardening for the Supabase Auth integration.
-- The initial schema already owns the application tables and their RLS rules.

-- An inactive user can only read their own profile. This lets the app show an
-- accurate access-denied message; no other data is exposed before sign-out.
drop policy if exists profiles_select on public.profiles;

create policy profiles_select
on public.profiles for select to authenticated
using (
  id = public.current_profile_id()
  or (
    public.is_active_user()
    and (
      public.is_admin()
      or public.is_mentor_of(id, cohort_id)
      or public.is_current_intern_mentor(id)
    )
  )
);
