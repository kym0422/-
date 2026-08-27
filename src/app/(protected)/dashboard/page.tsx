"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CalendarClock, CheckCircle2, Circle, FileText, MessageSquareText, UsersRound } from "lucide-react";
import { getWeekNumber, roleLabels } from "@/components/app-data";
import { useAppStore } from "@/components/app-store";
import { Avatar, Badge, Card, EmptyState, ProgressBar, SectionTitle } from "@/components/ui";

export default function DashboardPage() {
  const { currentUser, data, setData } = useAppStore();
  if (!currentUser) return null;

  const assignment = data.mentorAssignments.find((item) => item.internId === currentUser.id);
  const currentCohort = data.cohorts.find((cohort) => cohort.id === currentUser.cohortId) ?? {
    id: "unassigned",
    name: "배정된 기수 없음",
    startDate: "",
    endDate: "",
    totalWeeks: 0,
    status: "UPCOMING" as const,
  };
  const week = getWeekNumber(currentUser.startDate ?? currentCohort.startDate, currentUser.endDate ?? currentCohort.endDate);
  const visibleEvents = data.events.filter((event) => {
    if (event.eventType === "TODO") return event.createdBy === currentUser.id;
    return event.visibility === "ALL" || event.visibility === currentUser.role || event.createdBy === currentUser.id;
  });
  const upcoming = visibleEvents.filter((event) => event.startDate >= "2026-08-13").sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 4);
  const todos = data.events.filter((event) => event.eventType === "TODO" && event.createdBy === currentUser.id && !event.isCompleted);
  const notices = data.notices.filter((notice) => notice.target === "ALL" || notice.target === currentUser.role).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  const assignedInterns = currentUser.role === "MENTOR"
    ? data.mentorAssignments.filter((item) => item.primaryMentorId === currentUser.id || item.secondaryMentorId === currentUser.id).map((item) => data.profiles.find((profile) => profile.id === item.internId)).filter(Boolean)
    : [];
  const primaryMentor = data.profiles.find((profile) => profile.id === assignment?.primaryMentorId);
  const secondaryMentor = data.profiles.find((profile) => profile.id === assignment?.secondaryMentorId);

  function completeTodo(eventId: string) {
    setData((previous) => ({ ...previous, events: previous.events.map((event) => event.id === eventId ? { ...event, isCompleted: !event.isCompleted } : event) }));
  }

  return (
    <div className="dashboard-page">
      <section className="welcome-card">
        <div className="welcome-copy">
          <p>{roleLabels[currentUser.role]} 대시보드</p>
          <h1>{currentUser.name}님, 좋은 하루예요.</h1>
          <span>현장실습 {week ? `${week}주차` : "종료"} 진행 중입니다. 오늘의 일정과 업무를 확인해 보세요.</span>
          <div className="welcome-meta">
            <dl><dt>소속</dt><dd>{currentUser.department}</dd></dl>
            <dl><dt>실습 기간</dt><dd>{currentUser.startDate ?? currentCohort.startDate} ~ {currentUser.endDate ?? currentCohort.endDate}</dd></dl>
            {currentUser.role === "INTERN" ? <dl><dt>프로젝트</dt><dd>{currentUser.projectGroup}</dd></dl> : null}
          </div>
        </div>
        <div className="week-orbit" aria-label={`현재 ${week ?? currentCohort.totalWeeks}주차`}>
          <div><strong>{week ?? currentCohort.totalWeeks}</strong><span>WEEK</span></div>
          <small>총 {currentCohort.totalWeeks}주 과정</small>
        </div>
      </section>

      <div className="stats-grid">
        <Card className="stat-card"><span className="stat-icon blue"><CalendarClock size={21} /></span><div><p>다가오는 일정</p><strong>{upcoming.length}</strong><small>7일 이내 주요 일정</small></div></Card>
        <Card className="stat-card"><span className="stat-icon amber"><CheckCircle2 size={21} /></span><div><p>남은 To-do</p><strong>{todos.length}</strong><small>나만 볼 수 있는 할 일</small></div></Card>
        {currentUser.role === "ADMIN" ? <>
          <Card className="stat-card"><span className="stat-icon green"><UsersRound size={21} /></span><div><p>활동 인턴</p><strong>{data.profiles.filter((p) => p.role === "INTERN" && p.isActive).length}</strong><small>{currentCohort.name}</small></div></Card>
          <Card className="stat-card"><span className="stat-icon purple"><MessageSquareText size={21} /></span><div><p>읽지 않은 건의</p><strong>{data.suggestions.filter((s) => !s.readAt && s.status === "ACTIVE").length}</strong><small>익명으로 보호됨</small></div></Card>
        </> : currentUser.role === "MENTOR" ? <>
          <Card className="stat-card"><span className="stat-icon green"><UsersRound size={21} /></span><div><p>담당 인턴</p><strong>{assignedInterns.length}</strong><small>주·서브 멘토 포함</small></div></Card>
          <Card className="stat-card"><span className="stat-icon purple"><FileText size={21} /></span><div><p>제출 평가</p><strong>{data.evaluations.filter((e) => e.mentorId === currentUser.id && e.status === "ACTIVE").length}</strong><small>내가 작성한 기록</small></div></Card>
        </> : <>
          <Card className="stat-card"><span className="stat-icon green"><BriefcaseBusiness size={21} /></span><div><p>배정 과제</p><strong>{data.tasks.filter((t) => t.internId === currentUser.id).length}</strong><small>현재 진행 과제</small></div></Card>
          <Card className="stat-card"><span className="stat-icon purple"><FileText size={21} /></span><div><p>작성 보고서</p><strong>{data.weeklyReports.filter((r) => r.internId === currentUser.id).length}</strong><small>저장된 주차 기록</small></div></Card>
        </>}
      </div>

      {currentUser.role === "MENTOR" ? (
        <Card>
          <SectionTitle title="배정된 인턴" description="담당 인턴의 업무 기록과 평가로 바로 이동하세요." />
          <div className="intern-card-grid">
            {assignedInterns.map((intern) => intern ? (
              <article className="intern-card" key={intern.id}>
                <div className="intern-card-head"><Avatar name={intern.name} /><div><strong>{intern.name}</strong><span>{intern.department} · {intern.projectGroup}</span></div></div>
                <div className="intern-progress"><span>실습 진행</span><strong>{week}주차 / {currentCohort.totalWeeks}주</strong></div><ProgressBar value={((week ?? 1) / currentCohort.totalWeeks) * 100} />
                <div className="card-actions"><Link href="/mentor/evaluations">중간 평가</Link><Link href="/mentor/weekly-reports">주간 업무 기록</Link></div>
              </article>
            ) : null)}
          </div>
        </Card>
      ) : null}

      {currentUser.role === "INTERN" ? (
        <Card className="mentor-strip">
          <SectionTitle title="나의 멘토" description="과제와 피드백을 함께하는 담당 멘토입니다." />
          <div className="mentor-list">
            {primaryMentor ? <div><Avatar name={primaryMentor.name} /><span><small>담당 멘토</small><strong>{primaryMentor.name}</strong><em>{primaryMentor.department}</em></span></div> : null}
            {secondaryMentor ? <div><Avatar name={secondaryMentor.name} /><span><small>서브 멘토</small><strong>{secondaryMentor.name}</strong><em>{secondaryMentor.department}</em></span></div> : null}
          </div>
        </Card>
      ) : null}

      <div className="dashboard-columns">
        <Card>
          <SectionTitle title="오늘의 To-do" description="내가 등록한 비공개 일정입니다." action={<Link className="text-link" href="/calendar">전체 보기 <ArrowRight size={15} /></Link>} />
          {todos.length ? <div className="todo-list">{todos.slice(0, 4).map((todo) => (
            <button key={todo.id} onClick={() => completeTodo(todo.id)}><Circle size={18} /><span><strong>{todo.title}</strong><small>{todo.startDate} · 나만 보기</small></span></button>
          ))}</div> : <EmptyState title="오늘의 To-do가 없습니다." description="캘린더에서 새로운 할 일을 추가해 보세요." />}
        </Card>
        <Card>
          <SectionTitle title="다가오는 주요 일정" description="내가 볼 수 있는 가까운 일정입니다." action={<Link className="text-link" href="/calendar">캘린더 <ArrowRight size={15} /></Link>} />
          <div className="schedule-list">{upcoming.map((event) => (
            <div key={event.id} className="schedule-row"><time><strong>{event.startDate.slice(8)}</strong><small>8월</small></time><span><strong>{event.title}</strong><small>{event.description}</small></span>{event.isImportant ? <Badge tone="red">중요</Badge> : <Badge tone="blue">일정</Badge>}</div>
          ))}</div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="최근 공지" description="놓치면 안 되는 프로그램 안내입니다." action={<Link className="text-link" href="/notices">공지사항 전체 보기 <ArrowRight size={15} /></Link>} />
        <div className="notice-compact-list">{notices.map((notice) => (
          <Link href="/notices" key={notice.id}><span>{notice.important ? <Badge tone="red">중요</Badge> : <Badge tone="blue">안내</Badge>}<strong>{notice.title}</strong></span><time>{notice.createdAt}</time></Link>
        ))}</div>
      </Card>
    </div>
  );
}
