"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppData, initialData, Profile, type Role } from "./app-data";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type Toast = { message: string; tone: "success" | "error" | "info" } | null;
type LoginResult = { ok: true } | { ok: false; message: string };

type ProfileRow = {
  id: string;
  auth_user_id: string;
  email: string;
  phone?: string | null;
  name: string;
  role: Role;
  department: string | null;
  cohort_id: string | null;
  project_group: string | null;
  start_date: string | null;
  end_date: string | null;
  avatar_url?: string | null;
  is_active: boolean;
};

type CohortRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  total_weeks: number;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED";
};
type AssignmentRow = {
  id: string;
  cohort_id: string;
  intern_id: string;
  primary_mentor_id: string;
  secondary_mentor_id: string | null;
};

type AppStoreValue = {
  data: AppData;
  currentUser: Profile | null;
  ready: boolean;
  toast: Toast;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  notify: (message: string, tone?: NonNullable<Toast>["tone"]) => void;
};

const AppStoreContext = createContext<AppStoreValue | null>(null);
const baseProfileSelect = "id, auth_user_id, email, name, role, department, cohort_id, project_group, start_date, end_date, is_active";
const extendedProfileSelect = "id, auth_user_id, email, phone, name, role, department, cohort_id, project_group, start_date, end_date, avatar_url, is_active";

function toProfile(profile: ProfileRow): Profile {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone ?? undefined,
    role: profile.role,
    department: profile.department ?? "",
    cohortId: profile.cohort_id ?? undefined,
    projectGroup: profile.project_group ?? undefined,
    startDate: profile.start_date ?? undefined,
    endDate: profile.end_date ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    isActive: profile.is_active,
  };
}

async function getActiveProfile(authUserId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(baseProfileSelect)
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const baseProfile = data as ProfileRow | null;
  if (error || !baseProfile || !baseProfile.is_active) return null;

  const { data: extendedProfile } = await supabase
    .from("profiles")
    .select(extendedProfileSelect)
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  return toProfile((extendedProfile as ProfileRow | null) ?? baseProfile);
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(initialData);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const hydrate = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setCurrentUser(null);
      setData(initialData);
      setReady(true);
      return;
    }

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCurrentUser(null);
        setData(initialData);
        return;
      }

      const profile = await getActiveProfile(user.id);
      setCurrentUser(profile);
      if (!profile) {
        setData(initialData);
        return;
      }

      const [{ data: baseProfiles }, { data: cohorts }, { data: assignments }] = await Promise.all([
        supabase.from("profiles").select(baseProfileSelect),
        supabase.from("cohorts").select("id,name,start_date,end_date,total_weeks,status"),
        supabase.from("mentor_assignments").select("id,cohort_id,intern_id,primary_mentor_id,secondary_mentor_id"),
      ]);
      const { data: extendedProfiles } = await supabase.from("profiles").select(extendedProfileSelect);
      const profiles = extendedProfiles ?? baseProfiles;
      setData({
        ...initialData,
        profiles: ((profiles ?? []) as ProfileRow[]).map(toProfile),
        cohorts: ((cohorts ?? []) as CohortRow[]).map((cohort) => ({
          id: cohort.id,
          name: cohort.name,
          startDate: cohort.start_date,
          endDate: cohort.end_date,
          totalWeeks: cohort.total_weeks,
          status: cohort.status,
        })),
        mentorAssignments: ((assignments ?? []) as AssignmentRow[]).map((assignment) => ({
          id: assignment.id,
          cohortId: assignment.cohort_id,
          internId: assignment.intern_id,
          primaryMentorId: assignment.primary_mentor_id,
          secondaryMentorId: assignment.secondary_mentor_id ?? undefined,
        })),
      });
    } catch {
      setCurrentUser(null);
      setData(initialData);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void hydrate(), 0);
    return () => window.clearTimeout(timer);
  }, [hydrate]);

  const notify = useCallback((message: string, tone: NonNullable<Toast>["tone"] = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    if (!isSupabaseConfigured()) {
      return { ok: false, message: "서비스 설정을 확인해 주세요. 관리자에게 문의해 주세요." };
    }

    const supabase = createClient();
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !authData.user) return { ok: false, message: "이메일 또는 비밀번호를 확인해 주세요." };

    const profile = await getActiveProfile(authData.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      return { ok: false, message: "사용할 수 없는 계정입니다. 관리자에게 문의해 주세요." };
    }

    await hydrate();
    return { ok: true };
  }, [hydrate]);

  const logout = useCallback(async () => {
    setCurrentUser(null);
    setData(initialData);
    if (isSupabaseConfigured()) await createClient().auth.signOut();
  }, []);

  const value = useMemo<AppStoreValue>(
    () => ({ data, currentUser, ready, toast, login, logout, refresh: hydrate, notify }),
    [currentUser, data, hydrate, login, logout, notify, ready, toast],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const value = useContext(AppStoreContext);
  if (!value) throw new Error("useAppStore must be used inside AppStoreProvider");
  return value;
}
