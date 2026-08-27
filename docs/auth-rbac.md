# Supabase Auth and RBAC setup

This application uses Supabase Auth sessions stored in cookies. Authentication,
role lookup, and row-level access are not based on browser localStorage.

## Environment

Copy `.env.example` to `.env.local` and set these values from Supabase Dashboard
**Connect**:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_` variable or client
component. It is not needed for ordinary application reads and writes because RLS
is authoritative.

## Apply database migrations

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

`0001_initial_schema.sql` creates the application schema, profile trigger, and
RLS policies. `0002_auth_rbac.sql` permits an inactive account to read only its
own profile so the app can give a clear denial message; it grants no other data.

## Create the first ADMIN account

1. In Supabase Dashboard, open **Authentication → Users** and create the user.
2. Copy the new user's UUID.
3. The `on_auth_user_created` trigger creates an inactive `INTERN` profile.
4. In SQL Editor, update that profile to `ADMIN` and activate it:

```sql
update public.profiles
set role = 'ADMIN', is_active = true
where auth_user_id = 'AUTH_USER_UUID';
```

Create MENTOR and INTERN Auth users in the same way, then let an ADMIN assign
their final role, active state, cohort, and mentor assignments. All accounts
must be created by an ADMIN; there is no public signup flow.

After the first ADMIN account is available, the **관리자 설정** screen can create
subsequent Auth accounts and their profiles together. This uses the server-only
`SUPABASE_SERVICE_ROLE_KEY` through `/api/admin/users`; keep that variable out
of client code and restrict access to the ADMIN role. The API uses
`auth.admin.createUser({ email_confirm: true })`, so it does not send an email
confirmation message. Give the user the initial password securely; they can
change it from **내 프로필** after signing in.

## Disable public signup in Supabase

Removing the application signup page does not disable Supabase Auth's public
signup endpoint by itself. In the Supabase Dashboard, open **Authentication →
General Configuration** and turn off **Allow new users to sign up**. Also turn
off anonymous sign-ins and any unused OAuth providers. This keeps login limited
to accounts that an ADMIN created through the administrator settings screen.

## Access model

- `ADMIN` can manage all records.
- `MENTOR` is restricted by `mentor_assignments` to their assigned interns.
- `INTERN` is restricted to their own profile, tasks, reports, and submissions.

`src/proxy.ts` refreshes the Supabase cookie session and redirects unauthenticated
protected requests to `/login`. Server layouts call `requireUser` / `requireRole`
for the final authorization decision; the proxy is not the sole authorization
mechanism. Database RLS remains the protection for direct Supabase requests.
