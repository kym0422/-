"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
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
  name: string;
  role: Role;
  department: string | null;
  cohort_id: string | null;
  project_group: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
};

type AppStoreValue = {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  currentUser: Profile | null;
  ready: boolean;
  toast: Toast;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  notify: (message: string, tone?: NonNullable<Toast>["tone"]) => void;
  resetDemo: () => void;
};

const DATA_KEY = "genoray-intern-app-data-v1";
const AppStoreContext = createContext<AppStoreValue | null>(null);

function toProfile(profile: ProfileRow): Profile {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    department: profile.department ?? "",
    cohortId: profile.cohort_id ?? undefined,
    projectGroup: profile.project_group ?? undefined,
    startDate: profile.start_date ?? undefined,
    endDate: profile.end_date ?? undefined,
    isActive: profile.is_active,
  };
}

async function getActiveProfile(authUserId: string): Promise<Profile | null> {
  const { data, error } = await createClient()
    .from("profiles")
    .select("id, auth_user_id, email, name, role, department, cohort_id, project_group, start_date, end_date, is_active")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const profile = data as ProfileRow | null;
  return error || !profile || !profile.is_active ? null : toProfile(profile);
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(initialData);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    async function hydrate() {
      window.localStorage.removeItem(DATA_KEY);

      if (isSupabaseConfigured()) {
        const { data: { user } } = await createClient().auth.getUser();
        if (user) setCurrentUser(await getActiveProfile(user.id));
      }
      setReady(true);
    }

    void hydrate();
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(DATA_KEY, JSON.stringify(data));
    } catch {
      queueMicrotask(() => setToast({ message: "브라우저 저장 공간이 부족해 변경 내용을 저장하지 못했습니다.", tone: "error" }));
    }
  }, [data, ready]);

  const notify = useCallback((message: string, tone: NonNullable<Toast>["tone"] = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    if (!isSupabaseConfigured()) {
      return { ok: false, message: "Supabase 연결 정보가 설정되지 않았습니다. 관리자에게 문의해 주세요." };
    }

    const supabase = createClient();
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !authData.user) return { ok: false, message: "이메일 또는 비밀번호를 확인해 주세요." };

    const profile = await getActiveProfile(authData.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      return { ok: false, message: "사용할 수 없는 계정입니다. 관리자에게 문의해 주세요." };
    }

    setCurrentUser(profile);
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    setCurrentUser(null);
    if (isSupabaseConfigured()) await createClient().auth.signOut();
  }, []);

  const resetDemo = useCallback(() => {
    setData(initialData);
    window.localStorage.removeItem(DATA_KEY);
    notify("데모 데이터를 초기 상태로 되돌렸습니다.", "info");
  }, [notify]);

  const value = useMemo<AppStoreValue>(
    () => ({ data, setData, currentUser, ready, toast, login, logout, notify, resetDemo }),
    [currentUser, data, login, logout, notify, ready, resetDemo, toast],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const value = useContext(AppStoreContext);
  if (!value) throw new Error("useAppStore must be used inside AppStoreProvider");
  return value;
}
