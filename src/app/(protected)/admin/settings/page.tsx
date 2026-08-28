"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, CalendarRange, Pencil, Plus, RefreshCcw, RotateCcw, UserCog, UserPlus, UsersRound } from "lucide-react";
import { roleLabels, type Cohort, type Role } from "@/components/app-data";
import { useAppStore } from "@/components/app-store";
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, PageHeader, SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  role: Role;
  department: string | null;
  cohort_id: string | null;
  project_group: string | null;
  start_date: string | null;
  end_date: string | null;
  avatar_url: string | null;
  is_active: boolean;
};

type CohortRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  total_weeks: number;
  status: Cohort["status"];
};

type AssignmentRow = {
  id: string;
  cohort_id: string;
  intern_id: string;
  primary_mentor_id: string;
  secondary_mentor_id: string | null;
};

type UserForm = {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: Role;
  department: string;
  cohortId: string;
  projectGroup: string;
  startDate: string;
  endDate: string;
};

const emptyUserForm: UserForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "INTERN",
  department: "",
  cohortId: "",
  projectGroup: "",
  startDate: "",
  endDate: "",
};

function errorMessage(value: unknown, fallback: string) {
  return typeof value === "object" && value !== null && "message" in value && typeof value.message === "string"
    ? value.message
    : fallback;
}

export default function SettingsPage() {
  const { currentUser, notify, refresh } = useAppStore();
  const [tab, setTab] = useState<"users" | "cohorts" | "mentors">("users");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userOpen, setUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ProfileRow | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);
  const [cohortOpen, setCohortOpen] = useState(false);
  const [editingCohort, setEditingCohort] = useState<CohortRow | null>(null);
  const [cohortForm, setCohortForm] = useState({ name: "", startDate: "", endDate: "", totalWeeks: 8, status: "UPCOMING" as Cohort["status"] });
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentIntern, setAssignmentIntern] = useState("");
  const [assignmentForm, setAssignmentForm] = useState({ primaryMentorId: "", secondaryMentorId: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: profileData, error: profileError }, { data: cohortData, error: cohortError }, { data: assignmentData, error: assignmentError }] = await Promise.all([
      supabase.from("profiles").select("id,email,name,role,department,cohort_id,project_group,start_date,end_date,is_active").order("name"),
      supabase.from("cohorts").select("id,name,start_date,end_date,total_weeks,status").order("start_date", { ascending: false }),
      supabase.from("mentor_assignments").select("id,cohort_id,intern_id,primary_mentor_id,secondary_mentor_id"),
    ]);
    const { data: extendedProfileData } = await supabase.from("profiles").select("id,email,phone,name,role,department,cohort_id,project_group,start_date,end_date,avatar_url,is_active").order("name");

    if (profileError || cohortError || assignmentError) {
      notify("관리자 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
    } else {
      setProfiles(((extendedProfileData ?? profileData) ?? []) as ProfileRow[]);
      setCohorts((cohortData ?? []) as CohortRow[]);
      setAssignments((assignmentData ?? []) as AssignmentRow[]);
    }
    setLoading(false);
  }, [notify]);

  useEffect(() => {
    if (!currentUser) return;
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [currentUser, loadData]);

  const activeProfiles = useMemo(() => profiles.filter((profile) => profile.is_active), [profiles]);
  const mentors = useMemo(() => activeProfiles.filter((profile) => profile.role === "MENTOR"), [activeProfiles]);
  const interns = useMemo(() => activeProfiles.filter((profile) => profile.role === "INTERN"), [activeProfiles]);

  function openUser(profile?: ProfileRow) {
    setEditingUser(profile ?? null);
    setError("");
    setUserForm(profile ? {
      name: profile.name,
      email: profile.email,
      phone: profile.phone ?? "",
      password: "",
      role: profile.role,
      department: profile.department ?? "",
      cohortId: profile.cohort_id ?? "",
      projectGroup: profile.project_group ?? "",
      startDate: profile.start_date ?? "",
      endDate: profile.end_date ?? "",
    } : { ...emptyUserForm, cohortId: cohorts[0]?.id ?? "" });
    setUserOpen(true);
  }

  function userPayload(profileId?: string, isActive = true) {
    return {
      ...(profileId ? { profileId } : {}),
      name: userForm.name.trim(),
      email: userForm.email.trim(),
      phone: userForm.phone.trim() || null,
      ...(profileId ? {} : { password: userForm.password }),
      role: userForm.role,
      department: userForm.department.trim(),
      cohortId: userForm.role === "INTERN" || userForm.role === "MENTOR" ? userForm.cohortId || null : null,
      projectGroup: userForm.role === "INTERN" ? userForm.projectGroup.trim() || null : null,
      startDate: userForm.role === "INTERN" ? userForm.startDate : null,
      endDate: userForm.role === "INTERN" ? userForm.endDate : null,
      isActive,
    };
  }

  async function persistUser(payload: Record<string, unknown>, method: "POST" | "PATCH") {
    const response = await fetch("/api/admin/users", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null) as unknown;
    if (!response.ok) throw new Error(errorMessage(result, "사용자 정보를 저장하지 못했습니다."));
  }

  async function saveUser(event: React.FormEvent) {
    event.preventDefault();
    if (!userForm.name.trim() || !userForm.email.includes("@") || !userForm.department.trim()) {
      setError("이름, 올바른 이메일, 소속 부서를 입력해 주세요.");
      return;
    }
    if (!editingUser && userForm.password.length < 8) {
      setError("새 계정의 초기 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (userForm.role === "INTERN" && (!userForm.cohortId || !userForm.startDate || !userForm.endDate)) {
      setError("인턴의 기수와 실습 기간을 입력해 주세요.");
      return;
    }
    if (userForm.role === "MENTOR" && !userForm.cohortId) {
      setError("멘토의 담당 기수를 선택해 주세요.");
      return;
    }
    if (userForm.endDate && userForm.startDate && userForm.endDate < userForm.startDate) {
      setError("실습 종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }
    if (profiles.some((profile) => profile.email.toLowerCase() === userForm.email.trim().toLowerCase() && profile.id !== editingUser?.id)) {
      setError("이미 사용 중인 이메일입니다.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await persistUser(userPayload(editingUser?.id, editingUser?.is_active ?? true), editingUser ? "PATCH" : "POST");
      setUserOpen(false);
      await Promise.all([loadData(), refresh()]);
      notify(editingUser ? "사용자 정보를 저장했습니다." : "인증 계정과 프로필을 생성했습니다.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "사용자 정보를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(profile: ProfileRow) {
    if (!currentUser || profile.id === currentUser.id) {
      notify("현재 로그인한 관리자는 비활성화할 수 없습니다.", "error");
      return;
    }
    if (!window.confirm(`${profile.name} 사용자를 ${profile.is_active ? "비활성화" : "활성화"}할까요?`)) return;

    const payload = {
      profileId: profile.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      department: profile.department ?? "",
      cohortId: profile.cohort_id,
      projectGroup: profile.project_group,
      startDate: profile.start_date,
      endDate: profile.end_date,
      isActive: !profile.is_active,
    };
    try {
      await persistUser(payload, "PATCH");
      await Promise.all([loadData(), refresh()]);
      notify(profile.is_active ? "사용자를 비활성화했습니다." : "사용자를 활성화했습니다.", "info");
      /* Legacy malformed localized string from the previous demo implementation:
      notify(`사용자를 ${profile.is_active ? "비활성화" : "활성화"했습니다.`, "info");
      */
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "사용자 상태를 변경하지 못했습니다.", "error");
    }
  }

  function openCohort(cohort?: CohortRow) {
    setEditingCohort(cohort ?? null);
    setCohortForm(cohort ? {
      name: cohort.name,
      startDate: cohort.start_date,
      endDate: cohort.end_date,
      totalWeeks: cohort.total_weeks,
      status: cohort.status,
    } : { name: "", startDate: "", endDate: "", totalWeeks: 8, status: "UPCOMING" });
    setError("");
    setCohortOpen(true);
  }

  async function saveCohort(event: React.FormEvent) {
    event.preventDefault();
    if (!currentUser || !cohortForm.name.trim() || !cohortForm.startDate || !cohortForm.endDate || cohortForm.endDate < cohortForm.startDate) {
      setError("기수명과 올바른 기간을 입력해 주세요.");
      return;
    }

    setSaving(true);
    setError("");
    const cohortPayload = {
      name: cohortForm.name.trim(),
      start_date: cohortForm.startDate,
      end_date: cohortForm.endDate,
      total_weeks: cohortForm.totalWeeks,
      status: cohortForm.status,
    };
    const { error: insertError } = editingCohort
      ? await createClient().from("cohorts").update(cohortPayload).eq("id", editingCohort.id)
      : await createClient().from("cohorts").insert({ ...cohortPayload, created_by: currentUser.id });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setCohortOpen(false);
    await Promise.all([loadData(), refresh()]);
    notify("새 기수를 생성했습니다.");
  }

  function openAssignment(internId: string) {
    const existing = assignments.find((item) => item.intern_id === internId);
    setAssignmentIntern(internId);
    setAssignmentForm({ primaryMentorId: existing?.primary_mentor_id ?? "", secondaryMentorId: existing?.secondary_mentor_id ?? "" });
    setError("");
    setAssignmentOpen(true);
  }

  async function saveAssignment(event: React.FormEvent) {
    event.preventDefault();
    if (!currentUser || !assignmentForm.primaryMentorId) {
      setError("담당 멘토를 선택해 주세요.");
      return;
    }
    if (assignmentForm.primaryMentorId === assignmentForm.secondaryMentorId) {
      setError("담당 멘토와 서브 멘토는 같을 수 없습니다.");
      return;
    }

    const intern = profiles.find((profile) => profile.id === assignmentIntern);
    const existing = assignments.find((item) => item.intern_id === assignmentIntern);
    if (!intern?.cohort_id) {
      setError("기수가 배정된 인턴만 멘토를 배정할 수 있습니다.");
      return;
    }

    setSaving(true);
    setError("");
    const supabase = createClient();
    const result = existing
      ? await supabase.from("mentor_assignments").update({ primary_mentor_id: assignmentForm.primaryMentorId, secondary_mentor_id: assignmentForm.secondaryMentorId || null }).eq("id", existing.id)
      : await supabase.from("mentor_assignments").insert({ cohort_id: intern.cohort_id, intern_id: intern.id, primary_mentor_id: assignmentForm.primaryMentorId, secondary_mentor_id: assignmentForm.secondaryMentorId || null, created_by: currentUser.id });
    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setAssignmentOpen(false);
    await Promise.all([loadData(), refresh()]);
    notify("멘토 배정을 저장했습니다.");
  }

  if (!currentUser) return null;

  return <>
    <PageHeader
      eyebrow="ADMINISTRATION"
      title="관리자 설정"
      description="사용자, 기수, 멘토 배정을 관리합니다."
      actions={<Button variant="secondary" onClick={() => void loadData()}><RefreshCcw size={16} /> 데이터 새로고침</Button>}
    />
    <div className="settings-tabs">
      <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}><UsersRound size={18} /> 회원 정보</button>
      <button className={tab === "cohorts" ? "active" : ""} onClick={() => setTab("cohorts")}><CalendarRange size={18} /> 기수 관리</button>
      <button className={tab === "mentors" ? "active" : ""} onClick={() => setTab("mentors")}><UserCog size={18} /> 멘토 배정</button>
    </div>

    {tab === "users" ? <Card>
      <SectionTitle title="회원 정보 관리" description={`활성 ${activeProfiles.length}명 · 비활성 ${profiles.length - activeProfiles.length}명`} action={<Button onClick={() => openUser()}><UserPlus size={17} /> 사용자 생성</Button>} />
      {loading ? <p className="p-5 text-sm text-slate-500">사용자 정보를 불러오는 중입니다.</p> : profiles.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>사용자</th><th>연락처</th><th>역할</th><th>소속 부서</th><th>기수</th><th>프로젝트 조</th><th>상태</th><th>작업</th></tr></thead><tbody>
        {profiles.map((profile) => <tr key={profile.id} className={!profile.is_active ? "inactive-row" : ""}><td><div className="table-user"><Avatar imageUrl={profile.avatar_url ?? undefined} name={profile.name} role={profile.role} size="small" /><span><strong>{profile.name}</strong><small>{profile.email}</small></span></div></td><td>{profile.phone || "-"}</td><td><Badge tone={profile.role === "ADMIN" ? "purple" : profile.role === "MENTOR" ? "blue" : "green"}>{roleLabels[profile.role]}</Badge></td><td>{profile.department ?? "-"}</td><td>{cohorts.find((cohort) => cohort.id === profile.cohort_id)?.name ?? "-"}</td><td>{profile.project_group ?? "-"}</td><td><Badge tone={profile.is_active ? "green" : "gray"}>{profile.is_active ? "활성" : "비활성"}</Badge></td><td><div className="table-actions"><button className="icon-button" onClick={() => openUser(profile)} aria-label={`${profile.name} 수정`}><Pencil size={16} /></button><button className={`icon-button ${profile.is_active ? "danger-icon" : ""}`} onClick={() => void toggleActive(profile)} aria-label={`${profile.name} ${profile.is_active ? "비활성화" : "활성화"}`}>{profile.is_active ? <Archive size={16} /> : <RotateCcw size={16} />}</button></div></td></tr>)}
      </tbody></table></div> : <EmptyState title="등록된 사용자가 없습니다." description="사용자 데이터를 확인해 주세요." />}
    </Card> : null}

    {tab === "cohorts" ? <Card>
      <SectionTitle title="기수 관리" description="기수 변경 사항은 안전하게 보존됩니다." action={<Button onClick={() => openCohort()}><Plus size={17} /> 신규 기수</Button>} />
      {loading ? <p className="p-5 text-sm text-slate-500">기수 정보를 불러오는 중입니다.</p> : <div className="cohort-grid">{cohorts.map((cohort) => <article key={cohort.id}><div><Badge tone={cohort.status === "ACTIVE" ? "green" : cohort.status === "UPCOMING" ? "blue" : "gray"}>{cohort.status === "ACTIVE" ? "진행 중" : cohort.status === "UPCOMING" ? "예정" : "종료"}</Badge><h2>{cohort.name}</h2><p>{cohort.start_date} ~ {cohort.end_date}</p></div><dl><dt>총 실습 주차</dt><dd>{cohort.total_weeks}주</dd><dt>소속 인턴</dt><dd>{interns.filter((profile) => profile.cohort_id === cohort.id).length}명</dd></dl><Button variant="secondary" onClick={() => openCohort(cohort)}><Pencil size={16} /> 정보 수정</Button></article>)}</div>}
    </Card> : null}

    {tab === "mentors" ? <Card>
      <SectionTitle title="멘토 배정" description="인턴별 담당 멘토와 서브 멘토를 저장합니다." />
      {loading ? <p className="p-5 text-sm text-slate-500">멘토 배정 정보를 불러오는 중입니다.</p> : interns.length ? <div className="assignment-list">{interns.map((intern) => {
        const assignment = assignments.find((item) => item.intern_id === intern.id);
        const primary = profiles.find((profile) => profile.id === assignment?.primary_mentor_id);
        const secondary = profiles.find((profile) => profile.id === assignment?.secondary_mentor_id);
        return <article key={intern.id}><div className="table-user"><Avatar imageUrl={intern.avatar_url ?? undefined} name={intern.name} role={intern.role} /><span><strong>{intern.name}</strong><small>{intern.department ?? ""} · {intern.project_group ?? ""}</small></span></div><div className="assigned-mentors"><span><small>담당 멘토</small><strong>{primary?.name ?? "미배정"}</strong></span><span><small>서브 멘토</small><strong>{secondary?.name ?? "미배정"}</strong></span></div><Button variant="secondary" onClick={() => openAssignment(intern.id)}>배정 변경</Button></article>;
      })}</div> : <EmptyState title="배정 가능한 인턴이 없습니다." description="활성 인턴과 기수 정보를 확인해 주세요." />}
    </Card> : null}

    <Modal open={userOpen} onClose={() => !saving && setUserOpen(false)} title={editingUser ? "사용자 정보 수정" : "새 사용자 생성"} description={editingUser ? "인증 계정과 프로필 정보를 함께 갱신합니다." : "관리자가 회사 이메일과 초기 비밀번호를 발급합니다. 인증 메일은 보내지 않습니다."}>
      <form className="form-stack" onSubmit={(event) => void saveUser(event)}>
        <div className="form-grid"><Field label="이름"><input value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} /></Field><Field label="이메일"><input type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></Field></div>
        <Field label="전화번호" hint="구성원 페이지에 조회용으로 표시됩니다."><input type="tel" value={userForm.phone} onChange={(event) => setUserForm({ ...userForm, phone: event.target.value })} placeholder="010-0000-0000" /></Field>
        {!editingUser ? <Field label="초기 비밀번호" hint="사용자가 첫 로그인 후 변경할 수 있습니다."><input type="password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} autoComplete="new-password" /></Field> : null}
        <div className="form-grid"><Field label="역할" hint={editingUser?.id === currentUser.id ? "현재 로그인한 관리자의 역할은 변경할 수 없습니다." : undefined}><select value={userForm.role} disabled={editingUser?.id === currentUser.id} onChange={(event) => setUserForm({ ...userForm, role: event.target.value as Role })}><option value="ADMIN">관리자</option><option value="MENTOR">멘토</option><option value="INTERN">인턴</option></select></Field><Field label="소속 부서"><input value={userForm.department} onChange={(event) => setUserForm({ ...userForm, department: event.target.value })} /></Field></div>
        {userForm.role === "MENTOR" ? <Field label="담당 기수" hint="멘토가 담당하는 기수를 지정합니다."><select value={userForm.cohortId} onChange={(event) => setUserForm({ ...userForm, cohortId: event.target.value })}><option value="">선택하세요</option>{cohorts.map((cohort) => <option value={cohort.id} key={cohort.id}>{cohort.name}</option>)}</select></Field> : null}
        {userForm.role === "INTERN" ? <><div className="form-grid"><Field label="기수"><select value={userForm.cohortId} onChange={(event) => setUserForm({ ...userForm, cohortId: event.target.value })}><option value="">선택하세요</option>{cohorts.map((cohort) => <option value={cohort.id} key={cohort.id}>{cohort.name}</option>)}</select></Field><Field label="통합 프로젝트 조"><input value={userForm.projectGroup} onChange={(event) => setUserForm({ ...userForm, projectGroup: event.target.value })} /></Field></div><div className="form-grid"><Field label="실습 시작일"><input type="date" value={userForm.startDate} onChange={(event) => setUserForm({ ...userForm, startDate: event.target.value })} /></Field><Field label="실습 종료일"><input type="date" value={userForm.endDate} onChange={(event) => setUserForm({ ...userForm, endDate: event.target.value })} /></Field></div></> : null}
        {error ? <p className="form-error">{error}</p> : null}<div className="modal-actions"><Button type="button" variant="secondary" disabled={saving} onClick={() => setUserOpen(false)}>취소</Button><Button type="submit" disabled={saving}>{saving ? "저장 중..." : editingUser ? "저장" : "사용자 생성"}</Button></div>
      </form>
    </Modal>

    <Modal open={cohortOpen} onClose={() => !saving && setCohortOpen(false)} title={editingCohort ? "기수 정보 수정" : "신규 기수 생성"}><form className="form-stack" onSubmit={(event) => void saveCohort(event)}><Field label="기수명"><input value={cohortForm.name} onChange={(event) => setCohortForm({ ...cohortForm, name: event.target.value })} placeholder="예: 2027년 1기" /></Field><div className="form-grid"><Field label="시작일"><input type="date" value={cohortForm.startDate} onChange={(event) => setCohortForm({ ...cohortForm, startDate: event.target.value })} /></Field><Field label="종료일"><input type="date" value={cohortForm.endDate} onChange={(event) => setCohortForm({ ...cohortForm, endDate: event.target.value })} /></Field></div><div className="form-grid"><Field label="총 실습 주차"><input type="number" min={1} max={104} value={cohortForm.totalWeeks} onChange={(event) => setCohortForm({ ...cohortForm, totalWeeks: Number(event.target.value) })} /></Field><Field label="상태"><select value={cohortForm.status} onChange={(event) => setCohortForm({ ...cohortForm, status: event.target.value as Cohort["status"] })}><option value="UPCOMING">예정</option><option value="ACTIVE">진행 중</option><option value="COMPLETED">종료</option></select></Field></div>{error ? <p className="form-error">{error}</p> : null}<div className="modal-actions"><Button type="button" variant="secondary" disabled={saving} onClick={() => setCohortOpen(false)}>취소</Button><Button type="submit" disabled={saving}>{saving ? "저장 중..." : editingCohort ? "수정 저장" : "기수 생성"}</Button></div></form></Modal>

    <Modal open={assignmentOpen} onClose={() => !saving && setAssignmentOpen(false)} title="멘토 배정" description={`${profiles.find((profile) => profile.id === assignmentIntern)?.name ?? "인턴"}의 담당 멘토를 지정합니다.`}><form className="form-stack" onSubmit={(event) => void saveAssignment(event)}><Field label="담당 멘토"><select value={assignmentForm.primaryMentorId} onChange={(event) => setAssignmentForm({ ...assignmentForm, primaryMentorId: event.target.value })}><option value="">선택하세요</option>{mentors.map((mentor) => <option value={mentor.id} key={mentor.id}>{mentor.name} · {mentor.department}</option>)}</select></Field><Field label="서브 멘토"><select value={assignmentForm.secondaryMentorId} onChange={(event) => setAssignmentForm({ ...assignmentForm, secondaryMentorId: event.target.value })}><option value="">미배정</option>{mentors.map((mentor) => <option value={mentor.id} key={mentor.id}>{mentor.name} · {mentor.department}</option>)}</select></Field>{error ? <p className="form-error">{error}</p> : null}<div className="modal-actions"><Button type="button" variant="secondary" disabled={saving} onClick={() => setAssignmentOpen(false)}>취소</Button><Button type="submit" disabled={saving}>{saving ? "저장 중..." : "배정 저장"}</Button></div></form></Modal>
  </>;
}
