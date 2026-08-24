"use client";

import { useState } from "react";
import { Archive, CalendarRange, Pencil, Plus, RefreshCcw, RotateCcw, UserCog, UserPlus, UsersRound } from "lucide-react";
import { roleLabels, uid, type Cohort, type Profile, type Role } from "@/components/app-data";
import { useAppStore } from "@/components/app-store";
import { Avatar, Badge, Button, Card, Field, Modal, PageHeader, SectionTitle } from "@/components/ui";

const blankUser = { name: "", email: "", role: "INTERN" as Role, department: "", cohortId: "cohort-2", projectGroup: "", startDate: "2026-08-03", endDate: "2026-09-25" };

export default function SettingsPage() {
  const { currentUser, data, setData, notify, resetDemo } = useAppStore();
  const [tab, setTab] = useState<"users" | "cohorts" | "mentors">("users");
  const [userOpen, setUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [userForm, setUserForm] = useState(blankUser);
  const [cohortOpen, setCohortOpen] = useState(false);
  const [cohortForm, setCohortForm] = useState({ name: "", startDate: "", endDate: "", totalWeeks: 8, status: "UPCOMING" as Cohort["status"] });
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentIntern, setAssignmentIntern] = useState("");
  const [assignmentForm, setAssignmentForm] = useState({ primaryMentorId: "", secondaryMentorId: "" });
  const [error, setError] = useState("");

  function openUser(profile?: Profile) {
    setEditingUser(profile ?? null); setError(""); setUserForm(profile ? { name: profile.name, email: profile.email, role: profile.role, department: profile.department, cohortId: profile.cohortId ?? "cohort-2", projectGroup: profile.projectGroup ?? "", startDate: profile.startDate ?? "2026-08-03", endDate: profile.endDate ?? "2026-09-25" } : blankUser); setUserOpen(true);
  }
  function saveUser(event: React.FormEvent) {
    event.preventDefault();
    if (!userForm.name.trim() || !userForm.email.includes("@") || !userForm.department.trim()) { setError("이름, 올바른 이메일, 소속 부서를 입력해 주세요."); return; }
    if (data.profiles.some((profile) => profile.email.toLowerCase() === userForm.email.toLowerCase() && profile.id !== editingUser?.id)) { setError("이미 사용 중인 이메일입니다."); return; }
    const activeAdminCount = data.profiles.filter((profile) => profile.role === "ADMIN" && profile.isActive).length;
    if (editingUser?.id === currentUser?.id && userForm.role !== "ADMIN") { setError("현재 로그인한 관리자의 역할은 변경할 수 없습니다."); return; }
    if (editingUser?.role === "ADMIN" && userForm.role !== "ADMIN" && activeAdminCount <= 1) { setError("마지막 활성 관리자의 역할은 변경할 수 없습니다."); return; }
    const extras = userForm.role === "INTERN" ? { cohortId: userForm.cohortId, projectGroup: userForm.projectGroup, startDate: userForm.startDate, endDate: userForm.endDate } : { cohortId: undefined, projectGroup: undefined, startDate: undefined, endDate: undefined };
    if (editingUser) setData((previous) => ({ ...previous, profiles: previous.profiles.map((profile) => profile.id === editingUser.id ? { ...profile, ...userForm, ...extras } : profile) }));
    else setData((previous) => ({ ...previous, profiles: [...previous.profiles, { id: uid(userForm.role.toLowerCase()), isActive: true, ...userForm, ...extras }] }));
    setUserOpen(false); notify(editingUser ? "사용자 정보를 수정했습니다." : "데모 사용자를 생성했습니다.");
  }
  function toggleActive(profile: Profile) {
    if (profile.id === currentUser?.id) { notify("현재 로그인한 관리자 본인은 비활성화할 수 없습니다.", "error"); return; }
    if (profile.role === "ADMIN" && profile.isActive && data.profiles.filter((item) => item.role === "ADMIN" && item.isActive).length <= 1) { notify("마지막 활성 관리자는 비활성화할 수 없습니다.", "error"); return; }
    if (!window.confirm(`${profile.name} 사용자를 ${profile.isActive ? "비활성화" : "활성화"}할까요?`)) return;
    setData((previous) => ({ ...previous, profiles: previous.profiles.map((item) => item.id === profile.id ? { ...item, isActive: !item.isActive } : item) })); notify(`사용자를 ${profile.isActive ? "비활성화" : "활성화"}했습니다.`, "info");
  }
  function saveCohort(event: React.FormEvent) {
    event.preventDefault();
    if (!cohortForm.name.trim() || !cohortForm.startDate || !cohortForm.endDate || cohortForm.endDate < cohortForm.startDate) { setError("기수명과 올바른 기간을 입력해 주세요."); return; }
    setData((previous) => ({ ...previous, cohorts: [...previous.cohorts, { id: uid("cohort"), ...cohortForm }] })); setCohortOpen(false); notify("새 기수를 생성했습니다.");
  }
  function openAssignment(internId: string) {
    const existing = data.mentorAssignments.find((item) => item.internId === internId); setAssignmentIntern(internId); setAssignmentForm({ primaryMentorId: existing?.primaryMentorId ?? "", secondaryMentorId: existing?.secondaryMentorId ?? "" }); setError(""); setAssignmentOpen(true);
  }
  function saveAssignment(event: React.FormEvent) {
    event.preventDefault();
    if (!assignmentForm.primaryMentorId) { setError("담당 멘토를 선택해 주세요."); return; }
    if (assignmentForm.primaryMentorId === assignmentForm.secondaryMentorId) { setError("담당 멘토와 서브 멘토는 같을 수 없습니다."); return; }
    const intern = data.profiles.find((profile) => profile.id === assignmentIntern); const existing = data.mentorAssignments.find((item) => item.internId === assignmentIntern);
    const next = { id: existing?.id ?? uid("assignment"), cohortId: intern?.cohortId ?? "cohort-2", internId: assignmentIntern, primaryMentorId: assignmentForm.primaryMentorId, secondaryMentorId: assignmentForm.secondaryMentorId || undefined };
    setData((previous) => ({ ...previous, mentorAssignments: existing ? previous.mentorAssignments.map((item) => item.id === existing.id ? next : item) : [...previous.mentorAssignments, next] })); setAssignmentOpen(false); notify("멘토 배정을 저장했습니다.");
  }

  const activeProfiles = data.profiles.filter((profile) => profile.isActive);
  const mentors = activeProfiles.filter((profile) => profile.role === "MENTOR");
  const interns = activeProfiles.filter((profile) => profile.role === "INTERN");
  return <>
    <PageHeader eyebrow="ADMINISTRATION" title="관리자 설정" description="기수, 사용자, 멘토 배정을 안전하게 관리합니다." actions={<Button variant="secondary" onClick={() => { if (window.confirm("브라우저의 모든 데모 변경 내용을 초기 상태로 되돌릴까요?")) resetDemo(); }}><RefreshCcw size={16} /> 데모 데이터 초기화</Button>} />
    <div className="settings-tabs"><button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}><UsersRound size={18} /> 회원 정보</button><button className={tab === "cohorts" ? "active" : ""} onClick={() => setTab("cohorts")}><CalendarRange size={18} /> 기수 관리</button><button className={tab === "mentors" ? "active" : ""} onClick={() => setTab("mentors")}><UserCog size={18} /> 멘토 배정</button></div>
    {tab === "users" ? <Card><SectionTitle title="회원 정보 관리" description={`활성 ${activeProfiles.length}명 · 비활성 ${data.profiles.length - activeProfiles.length}명`} action={<Button onClick={() => openUser()}><UserPlus size={17} /> 사용자 생성</Button>} /><div className="table-scroll"><table className="data-table"><thead><tr><th>사용자</th><th>역할</th><th>소속 부서</th><th>기수</th><th>프로젝트 조</th><th>상태</th><th>작업</th></tr></thead><tbody>{data.profiles.map((profile) => <tr key={profile.id} className={!profile.isActive ? "inactive-row" : ""}><td><div className="table-user"><Avatar name={profile.name} size="small" /><span><strong>{profile.name}</strong><small>{profile.email}</small></span></div></td><td><Badge tone={profile.role === "ADMIN" ? "purple" : profile.role === "MENTOR" ? "blue" : "green"}>{roleLabels[profile.role]}</Badge></td><td>{profile.department}</td><td>{data.cohorts.find((cohort) => cohort.id === profile.cohortId)?.name ?? "-"}</td><td>{profile.projectGroup ?? "-"}</td><td><Badge tone={profile.isActive ? "green" : "gray"}>{profile.isActive ? "활성" : "비활성"}</Badge></td><td><div className="table-actions"><button className="icon-button" onClick={() => openUser(profile)} aria-label={`${profile.name} 수정`}><Pencil size={16} /></button><button className={`icon-button ${profile.isActive ? "danger-icon" : ""}`} onClick={() => toggleActive(profile)} aria-label={`${profile.name} ${profile.isActive ? "비활성화" : "활성화"}`}>{profile.isActive ? <Archive size={16} /> : <RotateCcw size={16} />}</button></div></td></tr>)}</tbody></table></div></Card> : null}
    {tab === "cohorts" ? <Card><SectionTitle title="기수 관리" description="삭제 대신 상태로 이력을 보존합니다." action={<Button onClick={() => { setError(""); setCohortOpen(true); }}><Plus size={17} /> 신규 기수</Button>} /><div className="cohort-grid">{data.cohorts.map((cohort) => <article key={cohort.id}><div><Badge tone={cohort.status === "ACTIVE" ? "green" : cohort.status === "UPCOMING" ? "blue" : "gray"}>{cohort.status === "ACTIVE" ? "진행 중" : cohort.status === "UPCOMING" ? "예정" : "종료"}</Badge><h2>{cohort.name}</h2><p>{cohort.startDate} ~ {cohort.endDate}</p></div><dl><dt>총 실습 주차</dt><dd>{cohort.totalWeeks}주</dd><dt>소속 인턴</dt><dd>{interns.filter((profile) => profile.cohortId === cohort.id).length}명</dd></dl></article>)}</div></Card> : null}
    {tab === "mentors" ? <Card><SectionTitle title="멘토 배정" description="담당 멘토와 서브 멘토를 다르게 지정합니다." /><div className="assignment-list">{interns.map((intern) => { const assignment = data.mentorAssignments.find((item) => item.internId === intern.id); const primary = data.profiles.find((profile) => profile.id === assignment?.primaryMentorId); const secondary = data.profiles.find((profile) => profile.id === assignment?.secondaryMentorId); return <article key={intern.id}><div className="table-user"><Avatar name={intern.name} /><span><strong>{intern.name}</strong><small>{intern.department} · {intern.projectGroup}</small></span></div><div className="assigned-mentors"><span><small>담당 멘토</small><strong>{primary?.name ?? "미배정"}</strong></span><span><small>서브 멘토</small><strong>{secondary?.name ?? "미배정"}</strong></span></div><Button variant="secondary" onClick={() => openAssignment(intern.id)}>배정 변경</Button></article>; })}</div></Card> : null}
    <Modal open={userOpen} onClose={() => setUserOpen(false)} title={editingUser ? "사용자 정보 수정" : "새 사용자 생성"} description="운영 데이터와 인증 계정이 함께 생성되는 화면을 모사합니다."><form className="form-stack" onSubmit={saveUser}><div className="form-grid"><Field label="이름"><input value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} /></Field><Field label="이메일"><input type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></Field></div><div className="form-grid"><Field label="역할" hint={editingUser?.id === currentUser?.id ? "현재 로그인한 관리자의 역할은 변경할 수 없습니다." : undefined}><select value={userForm.role} disabled={editingUser?.id === currentUser?.id} onChange={(event) => setUserForm({ ...userForm, role: event.target.value as Role })}><option value="ADMIN">관리자</option><option value="MENTOR">멘토</option><option value="INTERN">인턴</option></select></Field><Field label="소속 부서"><input value={userForm.department} onChange={(event) => setUserForm({ ...userForm, department: event.target.value })} /></Field></div>{userForm.role === "INTERN" ? <><div className="form-grid"><Field label="기수"><select value={userForm.cohortId} onChange={(event) => setUserForm({ ...userForm, cohortId: event.target.value })}>{data.cohorts.map((cohort) => <option value={cohort.id} key={cohort.id}>{cohort.name}</option>)}</select></Field><Field label="통합 프로젝트 조"><input value={userForm.projectGroup} onChange={(event) => setUserForm({ ...userForm, projectGroup: event.target.value })} /></Field></div><div className="form-grid"><Field label="실습 시작일"><input type="date" value={userForm.startDate} onChange={(event) => setUserForm({ ...userForm, startDate: event.target.value })} /></Field><Field label="실습 종료일"><input type="date" value={userForm.endDate} onChange={(event) => setUserForm({ ...userForm, endDate: event.target.value })} /></Field></div></> : null}{error ? <p className="form-error">{error}</p> : null}<div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setUserOpen(false)}>취소</Button><Button type="submit">{editingUser ? "저장" : "사용자 생성"}</Button></div></form></Modal>
    <Modal open={cohortOpen} onClose={() => setCohortOpen(false)} title="신규 기수 생성"><form className="form-stack" onSubmit={saveCohort}><Field label="기수명"><input value={cohortForm.name} onChange={(event) => setCohortForm({ ...cohortForm, name: event.target.value })} placeholder="예: 2027년 1기" /></Field><div className="form-grid"><Field label="시작일"><input type="date" value={cohortForm.startDate} onChange={(event) => setCohortForm({ ...cohortForm, startDate: event.target.value })} /></Field><Field label="종료일"><input type="date" value={cohortForm.endDate} onChange={(event) => setCohortForm({ ...cohortForm, endDate: event.target.value })} /></Field></div><div className="form-grid"><Field label="총 실습 주차"><input type="number" min={1} max={52} value={cohortForm.totalWeeks} onChange={(event) => setCohortForm({ ...cohortForm, totalWeeks: Number(event.target.value) })} /></Field><Field label="상태"><select value={cohortForm.status} onChange={(event) => setCohortForm({ ...cohortForm, status: event.target.value as Cohort["status"] })}><option value="UPCOMING">예정</option><option value="ACTIVE">진행 중</option><option value="COMPLETED">종료</option></select></Field></div>{error ? <p className="form-error">{error}</p> : null}<div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setCohortOpen(false)}>취소</Button><Button type="submit">기수 생성</Button></div></form></Modal>
    <Modal open={assignmentOpen} onClose={() => setAssignmentOpen(false)} title="멘토 배정" description={`${data.profiles.find((profile) => profile.id === assignmentIntern)?.name ?? "인턴"}의 담당 멘토를 지정합니다.`}><form className="form-stack" onSubmit={saveAssignment}><Field label="담당 멘토"><select value={assignmentForm.primaryMentorId} onChange={(event) => setAssignmentForm({ ...assignmentForm, primaryMentorId: event.target.value })}><option value="">선택하세요</option>{mentors.map((mentor) => <option value={mentor.id} key={mentor.id}>{mentor.name} · {mentor.department}</option>)}</select></Field><Field label="서브 멘토"><select value={assignmentForm.secondaryMentorId} onChange={(event) => setAssignmentForm({ ...assignmentForm, secondaryMentorId: event.target.value })}><option value="">미배정</option>{mentors.map((mentor) => <option value={mentor.id} key={mentor.id}>{mentor.name} · {mentor.department}</option>)}</select></Field>{error ? <p className="form-error">{error}</p> : null}<div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setAssignmentOpen(false)}>취소</Button><Button type="submit">배정 저장</Button></div></form></Modal>
  </>;
}
