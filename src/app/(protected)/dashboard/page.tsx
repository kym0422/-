"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarClock, CheckCircle2, Circle, UsersRound } from "lucide-react";
import { getWeekNumber, roleLabels } from "@/components/app-data";
import { useAppStore } from "@/components/app-store";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  event_type: "SCHEDULE" | "TODO";
  visibility: "ALL" | "PRIVATE" | "ADMIN" | "MENTOR" | "INTERN" | "COHORT";
  is_important: boolean;
  is_completed: boolean;
  created_by: string;
};
type NoticeRow = { id: string; title: string; created_at: string; is_important: boolean };
type ProfileRow = { id: string; name: string; role: "ADMIN" | "MENTOR" | "INTERN"; department: string | null; cohort_id: string | null; project_group: string | null; start_date: string | null; end_date: string | null; avatar_url?: string | null; is_active: boolean };
type AssignmentRow = { intern_id: string; primary_mentor_id: string; secondary_mentor_id: string | null };
type CohortRow = { id: string; name: string; start_date: string; end_date: string; total_weeks: number; status: "UPCOMING" | "ACTIVE" | "COMPLETED" };

const unassignedCohort: CohortRow = { id: "unassigned", name: "배정된 기수 없음", start_date: "", end_date: "", total_weeks: 0, status: "UPCOMING" };

const koreaFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });

function koreaDate(value: string) {
  const parts = Object.fromEntries(koreaFormatter.formatToParts(new Date(value)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(value));
}

function koreaSaturday(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + (6 - date.getUTCDay()));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addKoreaDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function monthWeekLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const currentDate = new Date(Date.UTC(year, month - 1, day));
  const weekStart = new Date(currentDate);
  weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const startMonth = weekStart.getUTCMonth();
  const endMonth = weekEnd.getUTCMonth();
  if (startMonth !== endMonth) {
    return `${weekEnd.getUTCMonth() + 1}월 1주차`;
  }
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return `${month}월 ${Math.ceil((firstDay + day) / 7)}주차`;
}

export default function DashboardPage() {
  const { currentUser, notify } = useAppStore();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    const supabase = createClient();
    const [eventResult, noticeResult, profileResult, assignmentResult, cohortResult] = await Promise.all([
      supabase.from("calendar_events").select("id,title,description,start_at,end_at,event_type,visibility,is_important,is_completed,created_by").order("start_at", { ascending: true }),
      supabase.from("notices").select("id,title,created_at,is_important").order("created_at", { ascending: false }).limit(3),
      supabase.from("profiles").select("id,name,role,department,cohort_id,project_group,start_date,end_date,is_active"),
      supabase.from("mentor_assignments").select("intern_id,primary_mentor_id,secondary_mentor_id"),
      supabase.from("cohorts").select("id,name,start_date,end_date,total_weeks,status"),
    ]);

    const errors = [eventResult.error, noticeResult.error, profileResult.error, assignmentResult.error, cohortResult.error];
    if (errors.some(Boolean)) {
      notify("대시보드 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
    }
    setEvents((eventResult.data ?? []) as EventRow[]);
    setNotices((noticeResult.data ?? []) as NoticeRow[]);
    setProfiles((profileResult.data ?? []) as ProfileRow[]);
    setAssignments((assignmentResult.data ?? []) as AssignmentRow[]);
    setCohorts((cohortResult.data ?? []) as CohortRow[]);
    setLoading(false);
  }, [notify]);

  useEffect(() => {
    if (!currentUser) return;
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [currentUser, loadDashboard]);

  const cohortById = useMemo(() => new Map(cohorts.map((cohort) => [cohort.id, cohort])), [cohorts]);
  const ownProfile = useMemo(() => profiles.find((profile) => profile.id === currentUser?.id), [currentUser?.id, profiles]);
  const activeCohort = useMemo(() => cohorts.find((cohort) => cohort.status === "ACTIVE"), [cohorts]);
  const currentCohort = useMemo(() => {
    const ownCohortId = ownProfile?.cohort_id ?? currentUser?.cohortId;
    return (currentUser?.role === "INTERN" ? cohortById.get(ownCohortId ?? "") : activeCohort) ?? unassignedCohort;
  }, [activeCohort, cohortById, currentUser?.cohortId, currentUser?.role, ownProfile?.cohort_id]);

  if (!currentUser) return null;
  const today = koreaDate(new Date().toISOString());
  const weekEnd = koreaSaturday(today);
  const todayWeekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const nextWeekStart = addKoreaDays(today, 7 - todayWeekday);
  const nextWeekEnd = addKoreaDays(nextWeekStart, 6);
  const currentStartDate = ownProfile?.start_date ?? currentUser.startDate ?? currentCohort.start_date;
  const currentEndDate = ownProfile?.end_date ?? currentUser.endDate ?? currentCohort.end_date;
  const week = getWeekNumber(currentStartDate, currentEndDate);
  const upcoming = events.filter((event) => event.event_type === "SCHEDULE" && koreaDate(event.start_at) >= today).slice(0, 4);
  const thisWeekScheduleCount = events.filter((event) => {
    const startDate = koreaDate(event.start_at);
    return event.event_type === "SCHEDULE" && startDate >= today && startDate <= weekEnd;
  }).length;
  const nextWeekScheduleCount = events.filter((event) => {
    const startDate = koreaDate(event.start_at);
    return event.event_type === "SCHEDULE" && startDate >= nextWeekStart && startDate <= nextWeekEnd;
  }).length;
  const todos = events.filter((event) => event.event_type === "TODO" && event.created_by === currentUser.id && !event.is_completed);
  const assignedInterns = currentUser.role === "MENTOR"
    ? assignments.filter((item) => item.primary_mentor_id === currentUser.id || item.secondary_mentor_id === currentUser.id).map((item) => profiles.find((profile) => profile.id === item.intern_id)).filter((profile): profile is ProfileRow => Boolean(profile))
    : [];
  const assignment = assignments.find((item) => item.intern_id === currentUser.id);
  const primaryMentor = profiles.find((profile) => profile.id === assignment?.primary_mentor_id);
  const secondaryMentor = profiles.find((profile) => profile.id === assignment?.secondary_mentor_id);
  const assignedMentors = [primaryMentor, secondaryMentor].filter((mentor): mentor is ProfileRow => Boolean(mentor));
  const activeInternCount = profiles.filter((profile) => profile.role === "INTERN" && profile.is_active && (currentCohort.id === "unassigned" || profile.cohort_id === currentCohort.id)).length;

  async function completeTodo(event: EventRow) {
    const completed = !event.is_completed;
    const { error } = await createClient().from("calendar_events").update({ is_completed: completed, completed_at: completed ? new Date().toISOString() : null }).eq("id", event.id);
    if (error) {
      notify("To-do 상태를 저장하지 못했습니다.", "error");
      return;
    }
    await loadDashboard();
  }

  return (
    <div className="dashboard-page">
      <section className="welcome-card">
        <div className="welcome-copy">
          <p>{roleLabels[currentUser.role]} 대시보드</p>
          <h1>{currentUser.name}님, 좋은 하루 되세요.</h1>
          <span>현재 실습 {week ? `${week}주차` : "종료"} 진행 중입니다. 오늘의 일정과 업무를 확인해 보세요.</span>
          <div className="welcome-meta">
            <dl><dt>소속</dt><dd>{currentUser.department}</dd></dl>
            <dl><dt>실습 기간</dt><dd>{currentStartDate} ~ {currentEndDate}</dd></dl>
            <dl><dt>기수</dt><dd>{currentCohort.name}</dd></dl>
            {currentUser.role === "INTERN" ? <dl><dt>프로젝트</dt><dd>{currentUser.projectGroup}</dd></dl> : null}
          </div>
        </div>
        <div className="week-orbit" aria-label={`현재 ${week ?? currentCohort.total_weeks}주차`}><div><strong>{week ?? currentCohort.total_weeks}</strong><span>WEEK</span></div><small>총 {currentCohort.total_weeks}주 과정</small></div>
      </section>

      <div className="stats-grid">
        <Card className="stat-card"><span className="stat-icon blue"><CalendarClock size={21} /></span><div><p>이번 주 일정</p><strong>{thisWeekScheduleCount}</strong><small>{monthWeekLabel(today)}</small></div></Card>
        <Card className="stat-card"><span className="stat-icon purple"><CalendarClock size={21} /></span><div><p>다음 주 일정</p><strong>{nextWeekScheduleCount}</strong><small>{monthWeekLabel(nextWeekStart)}</small></div></Card>
        <Card className="stat-card"><span className="stat-icon amber"><CheckCircle2 size={21} /></span><div><p>남은 To-do</p><strong>{todos.length}</strong></div></Card>
        <Card className="stat-card stat-card-people"><span className="stat-icon green"><UsersRound size={21} /></span><div>
          {currentUser.role === "MENTOR" ? <>
            <p>배정 인턴</p>
            {assignedInterns.length ? assignedInterns.map((intern) => <small key={intern.id}>나의 멘티 - {intern.department ?? "부서 미등록"} - <strong>{intern.name}</strong></small>) : <small>배정된 인턴이 없습니다.</small>}
          </> : currentUser.role === "INTERN" ? <>
            <p>배정 멘토</p>
            {assignedMentors.length ? assignedMentors.map((mentor) => <small key={mentor.id}>나의 멘토 - {mentor.department ?? "부서 미등록"} - <strong>{mentor.name}</strong></small>) : <small>배정된 멘토가 없습니다.</small>}
          </> : <>
            <p>활동 중 인턴</p><strong>{activeInternCount}</strong><small>{currentCohort.name}</small>
          </>}
        </div></Card>
      </div>

      <div className="dashboard-columns">
        <Card><SectionTitle title="오늘의 To-do" action={<Link className="text-link" href="/calendar">전체 보기 <ArrowRight size={15} /></Link>} />{loading ? <p className="p-5 text-sm text-slate-500">데이터를 불러오는 중입니다.</p> : todos.length ? <div className="todo-list">{todos.slice(0, 4).map((todo) => <button key={todo.id} onClick={() => void completeTodo(todo)}><Circle size={18} /><span><strong>{todo.title}</strong><small>{koreaDate(todo.start_at)} · 나만 보기</small></span></button>)}</div> : <EmptyState title="오늘의 To-do가 없습니다." description="캘린더에서 새 할 일을 추가해 보세요." />}</Card>
        <Card><SectionTitle title="다가오는 주요 일정" action={<Link className="text-link" href="/calendar">캘린더 <ArrowRight size={15} /></Link>} />{loading ? <p className="p-5 text-sm text-slate-500">데이터를 불러오는 중입니다.</p> : upcoming.length ? <div className="schedule-list">{upcoming.map((event) => <div key={event.id} className="schedule-row"><time><strong>{koreaDate(event.start_at).slice(8)}</strong><small>{displayDate(event.start_at)}</small></time><span><strong>{event.title}</strong></span>{event.is_important ? <Badge tone="red">중요</Badge> : <Badge tone="blue">일정</Badge>}</div>)}</div> : <EmptyState title="다가오는 일정이 없습니다." description="캘린더에서 일정을 확인해 주세요." />}</Card>
      </div>

      <Card><SectionTitle title="최근 공지" description="권한에 따라 조회되는 공지입니다." action={<Link className="text-link" href="/notices">공지사항 전체 보기 <ArrowRight size={15} /></Link>} />{loading ? <p className="p-5 text-sm text-slate-500">데이터를 불러오는 중입니다.</p> : notices.length ? <div className="notice-compact-list">{notices.map((notice) => <Link href="/notices" key={notice.id}><span>{notice.is_important ? <Badge tone="red">중요</Badge> : <Badge tone="blue">안내</Badge>}<strong>{notice.title}</strong></span><time>{displayDate(notice.created_at)}</time></Link>)}</div> : <EmptyState title="표시할 공지가 없습니다." description="새 공지가 등록되면 이곳에 표시됩니다." />}</Card>
    </div>
  );
}
