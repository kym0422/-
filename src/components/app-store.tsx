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
import { AppData, DEMO_PASSWORD, initialData, Profile } from "./app-data";

type Toast = { message: string; tone: "success" | "error" | "info" } | null;

type AppStoreValue = {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  currentUser: Profile | null;
  ready: boolean;
  toast: Toast;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  notify: (message: string, tone?: NonNullable<Toast>["tone"]) => void;
  resetDemo: () => void;
};

const DATA_KEY = "genoray-intern-app-data-v1";
const SESSION_KEY = "genoray-intern-app-session-v1";
const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(initialData);
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  useEffect(() => {
    let storedData: AppData | null = null;
    let storedUserId: string | null = null;
    try {
      const serializedData = window.localStorage.getItem(DATA_KEY);
      storedUserId = window.localStorage.getItem(SESSION_KEY);
      if (serializedData) storedData = JSON.parse(serializedData) as AppData;
    } catch {
      window.localStorage.removeItem(DATA_KEY);
      window.localStorage.removeItem(SESSION_KEY);
    }
    queueMicrotask(() => {
      if (storedData) setData(storedData);
      if (storedUserId) setUserId(storedUserId);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(DATA_KEY, JSON.stringify(data));
    } catch {
      queueMicrotask(() => setToast({ message: "브라우저 저장 공간이 부족해 변경 내용을 저장하지 못했습니다.", tone: "error" }));
    }
  }, [data, ready]);

  const currentUser = useMemo(
    () => data.profiles.find((profile) => profile.id === userId && profile.isActive) ?? null,
    [data.profiles, userId],
  );

  const notify = useCallback((message: string, tone: NonNullable<Toast>["tone"] = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const login = useCallback(
    (email: string, password: string) => {
      const profile = data.profiles.find(
        (candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase() && candidate.isActive,
      );
      if (!profile || password !== DEMO_PASSWORD) return false;
      setUserId(profile.id);
      window.localStorage.setItem(SESSION_KEY, profile.id);
      return true;
    },
    [data.profiles],
  );

  const logout = useCallback(() => {
    setUserId(null);
    window.localStorage.removeItem(SESSION_KEY);
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
