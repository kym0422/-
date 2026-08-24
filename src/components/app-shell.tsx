"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, ShieldCheck, UserRound, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { icons } from "./icons";
import { roleLabels, type Role } from "./app-data";
import { useAppStore } from "./app-store";
import { Avatar, Toast } from "./ui";

type NavItem = { href: string; label: string; icon: keyof typeof icons; roles?: Role[] };

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
  const { currentUser, ready, toast, notify } = useAppStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (ready && !currentUser) router.replace("/login");
  }, [currentUser, ready, router]);

  useEffect(() => {
    if (currentUser && !routeAllowed(pathname, currentUser.role)) router.replace("/403");
  }, [currentUser, pathname, router]);

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
            <button className="language-button" aria-label="언어 선택" onClick={() => notify("현재 버전은 한국어를 기본으로 제공합니다.", "info")}>KO <ChevronDown size={14} /></button>
            <button className="icon-button notification-button" aria-label="알림" onClick={() => notify("알림 센터는 Phase 2에서 제공할 예정입니다.", "info")}><Bell size={19} /><i /></button>
            <div className="profile-menu-wrap">
              <button className="profile-button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
                <Avatar name={currentUser.name} size="small" />
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
            <span className="brand-mark">G</span>
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
        <div className="sidebar-footer">
          <ShieldCheck size={18} />
          <div><strong>데모 보안 모드</strong><small>역할별 접근 제어 적용</small></div>
        </div>
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
