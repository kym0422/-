"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, UserRound, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { icons } from "./icons";
import { roleLabels, type Role } from "./app-data";
import { useAppStore } from "./app-store";
import { Toast } from "./ui";
import { createClient } from "@/lib/supabase/client";

type NavItem = { href: string; label: string; icon: keyof typeof icons; roles?: Role[] };
type NotificationItem = { id: string; title: string; detail: string; href: string; createdAt: string; type: string; isRead: boolean };

const primaryNavigation: NavItem[] = [
  { href: "/dashboard", label: "대시보드", icon: "dashboard" },
  { href: "/notices", label: "공지사항", icon: "notices" },
  { href: "/calendar", label: "공유 캘린더", icon: "calendar" },
  { href: "/board/templates", label: "게시판", icon: "board" },
];

const roleNavigation: Record<Role, NavItem[]> = {
  ADMIN: [
    { href: "/admin/weekly-reports", label: "주간 업무보고", icon: "reports" },
    { href: "/admin/tasks", label: "과제 관리", icon: "tasks" },
    { href: "/admin/evaluations", label: "평가 관리", icon: "evaluations" },
    { href: "/admin/suggestions", label: "익명 건의", icon: "suggestions" },
    { href: "/admin/settings", label: "관리자 설정", icon: "settings" },
    { href: "/members", label: "구성원", icon: "members" },
  ],
  MENTOR: [
    { href: "/mentor/weekly-reports", label: "주간 업무보고", icon: "reports" },
    { href: "/mentor/tasks", label: "과제 관리", icon: "tasks" },
    { href: "/mentor/evaluations", label: "중간 평가", icon: "evaluations" },
    { href: "/members", label: "구성원", icon: "members" },
  ],
  INTERN: [
    { href: "/intern/weekly-reports", label: "주간 업무보고", icon: "reports" },
    { href: "/intern/tasks", label: "나의 과제", icon: "tasks" },
    { href: "/intern/suggestions", label: "익명 건의", icon: "suggestions" },
  ],
};

export const allowedPrefixes: Record<Role, string[]> = {
  ADMIN: ["/dashboard", "/profile", "/notices", "/calendar", "/board", "/admin", "/members"],
  MENTOR: ["/dashboard", "/profile", "/notices", "/calendar", "/board", "/mentor", "/members"],
  INTERN: ["/dashboard", "/profile", "/notices", "/calendar", "/board", "/intern"],
};

function routeAllowed(pathname: string, role: Role) {
  return allowedPrefixes[role].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function ProtectedApp({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, ready, toast } = useAppStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (ready && !currentUser) router.replace("/login");
  }, [currentUser, ready, router]);

  useEffect(() => {
    if (currentUser && !routeAllowed(pathname, currentUser.role)) router.replace("/403");
  }, [currentUser, pathname, router]);

  useEffect(() => {
    if (!currentUser) return;
    let mounted = true;
    const loadNotifications = async () => {
      const { data: rows } = await createClient().from("notifications").select("id,type,title,message,href,is_read,created_at").order("created_at", { ascending: false }).limit(20);
      if (!mounted) return;
      setNotifications(((rows ?? []) as { id: string; type: string; title: string; message: string; href: string; is_read: boolean; created_at: string }[]).map((item) => ({ id: item.id, title: item.title, detail: item.message, href: item.href, createdAt: item.created_at, type: item.type, isRead: item.is_read })));
    };
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 30000);
    return () => { mounted = false; window.clearInterval(interval); };
  }, [currentUser]);

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  async function markNotificationRead(id: string) {
    await createClient().from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, isRead: true } : item));
  }
  async function markAllNotificationsRead() {
    if (!currentUser || !unreadCount) return;
    await createClient().from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("recipient_id", currentUser.id).eq("is_read", false);
    setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
  }

  if (!ready || !currentUser) {
    return <div className="loading-screen"><span className="spinner" /><p>로그인 정보를 확인하고 있습니다.</p></div>;
  }

  return (
    <div className="app-frame">
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} role={currentUser.role} />
      <div className="app-main">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="메뉴 열기"><Menu size={21} /></button>
          <div className="breadcrumb">현장실습 프로그램 <span>/</span> {getCurrentLabel(pathname, currentUser.role)}</div>
          <div className="topbar-actions">
            <div className="notification-wrap">
              <button className="icon-button notification-button" aria-label="알림" aria-expanded={notificationOpen} onClick={() => { setNotificationOpen((value) => !value); setProfileOpen(false); }}><Bell size={19} />{unreadCount ? <i>{unreadCount > 9 ? "9+" : unreadCount}</i> : null}</button>
              {notificationOpen ? <div className="notification-dropdown"><div><strong>알림</strong><button type="button" onClick={() => void markAllNotificationsRead()} disabled={!unreadCount}>모두 읽음</button></div>{notifications.length ? <ul>{notifications.map((item) => <li key={item.id} className={item.isRead ? "is-read" : "is-unread"}><Link href={item.href} onClick={() => { void markNotificationRead(item.id); setNotificationOpen(false); }}><small>{notificationLabel(item.type)} · {new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(new Date(item.createdAt))}</small><strong>{item.title}</strong><span>{item.detail}</span></Link></li>)}</ul> : <p>새로운 알림이 없습니다.</p>}</div> : null}
            </div>
            <div className="profile-menu-wrap">
              <button className="profile-button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
                <span
                  className={`profile-avatar profile-avatar-${currentUser.role.toLowerCase()}`}
                  aria-hidden="true"
                  style={currentUser.avatarUrl ? { backgroundImage: `url(${currentUser.avatarUrl})` } : undefined}
                >
                  {currentUser.avatarUrl ? null : <UserRound size={17} />}
                </span>
                <span><strong>{currentUser.name}</strong><small>{roleLabels[currentUser.role]}</small></span>
                <ChevronDown size={15} />
              </button>
              {profileOpen ? <ProfileMenu onClose={() => setProfileOpen(false)} /> : null}
            </div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
      <Toast toast={toast} />
    </div>
  );
}

function Sidebar({ open, onClose, role }: { open: boolean; onClose: () => void; role: Role }) {
  const pathname = usePathname();
  const navigation = useMemo(() => [...primaryNavigation, ...roleNavigation[role]], [role]);
  return (
    <>
      {open ? <button className="sidebar-overlay" onClick={onClose} aria-label="메뉴 닫기" /> : null}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand">
          <Link className="brand-home" href="/dashboard" onClick={onClose} aria-label="메인 대시보드로 이동">
            <span className="brand-mark brand-logo-mark"><Image src="/genoray-logo.png" alt="" width={34} height={34} priority /></span>
            <div><strong>GENORAY</strong><small>현장실습 프로그램</small></div>
          </Link>
          <button className="icon-button sidebar-close" onClick={onClose} aria-label="메뉴 닫기"><X size={20} /></button>
        </div>
        <nav className="sidebar-nav" aria-label="주요 메뉴">
          <p className="nav-label">WORKSPACE</p>
          {navigation.map((item, index) => {
            const Icon = icons[item.icon];
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            const showDivider = index === primaryNavigation.length;
            return (
              <div key={item.href} className={showDivider ? "nav-divider" : ""}>
                {showDivider ? <p className="nav-label">{roleLabels[role]} 메뉴</p> : null}
                <Link className={`nav-link ${active ? "active" : ""}`} href={item.href} onClick={onClose}>
                  <Icon size={19} /><span>{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

function ProfileMenu({ onClose }: { onClose: () => void }) {
  const { logout } = useAppStore();
  const router = useRouter();
  return (
    <div className="profile-dropdown">
      <Link href="/profile" onClick={onClose}><UserRound size={17} />내 프로필</Link>
      <button onClick={() => { logout(); onClose(); router.push("/login"); }}><LogOut size={17} />로그아웃</button>
    </div>
  );
}

function getCurrentLabel(pathname: string, role: Role) {
  const navigation = [...primaryNavigation, ...roleNavigation[role]];
  return navigation.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "홈";
}

function notificationLabel(type: string) {
  if (type.startsWith("TASK")) return "과제";
  if (type.startsWith("SCHEDULE")) return "일정";
  if (type.startsWith("WEEKLY")) return "업무보고";
  if (type.startsWith("SUGGESTION")) return "건의";
  if (type.startsWith("EVALUATION")) return "평가";
  if (type.startsWith("NOTICE")) return "공지";
  return "알림";
}
