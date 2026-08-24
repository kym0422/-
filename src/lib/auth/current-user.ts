import "server-only";

import { redirect } from "next/navigation";
import type { Role } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type CurrentUser = {
  authUserId: string;
  profileId: string;
  email: string;
  name: string;
  displayName: string;
  role: Role;
  department: string | null;
  cohortId: string | null;
  projectGroup: string | null;
  startDate: string | null;
  endDate: string | null;
};

type ProfileRow = {
  id: string;
  auth_user_id: string;
  email: string;
  name: string;
  display_name: string;
  role: Role;
  department: string | null;
  cohort_id: string | null;
  project_group: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
};

export type CurrentUserResult =
  | { status: "authenticated"; user: CurrentUser }
  | { status: "unauthenticated" | "missing-profile" | "inactive" | "misconfigured" };

function toCurrentUser(profile: ProfileRow): CurrentUser {
  return {
    authUserId: profile.auth_user_id,
    profileId: profile.id,
    email: profile.email,
    name: profile.name,
    displayName: profile.display_name,
    role: profile.role,
    department: profile.department,
    cohortId: profile.cohort_id,
    projectGroup: profile.project_group,
    startDate: profile.start_date,
    endDate: profile.end_date,
  };
}

export async function getCurrentUser(): Promise<CurrentUserResult> {
  if (!isSupabaseConfigured()) return { status: "misconfigured" };

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { status: "unauthenticated" };

  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("id, auth_user_id, email, name, display_name, role, department, cohort_id, project_group, start_date, end_date, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const profile = data as ProfileRow | null;

  if (profileError || !profile) return { status: "missing-profile" };
  if (!profile.is_active) return { status: "inactive" };

  return { status: "authenticated", user: toCurrentUser(profile) };
}

export async function requireUser(): Promise<CurrentUser> {
  const result = await getCurrentUser();
  if (result.status === "authenticated") return result.user;
  redirect(result.status === "inactive" ? "/login?reason=inactive" : result.status === "missing-profile" ? "/login?reason=profile" : "/login");
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/403");
  return user;
}
