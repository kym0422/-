"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { type Role } from "./app-data";
import { useAppStore } from "./app-store";
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, PageHeader, SectionTitle } from "./ui";
import { exportExcelFile } from "@/lib/export-excel";
import { createClient } from "@/lib/supabase/client";

type TaskPrimaryCategory = "SELF_STUDY" | "MENTOR_TASK" | "PROJECT" | "CUSTOM";
type TaskSecondaryCategory = "PROBLEM_SOLVING" | "WORK_PARTICIPATION" | "INNOVATION" | "CUSTOM";
type TaskDifficulty = "BASIC" | "INTERMEDIATE" | "ADVANCED";
type TaskExpectedOutput = "DOCUMENT" | "ANALYSIS_REPORT" | "PRESENTATION" | "PROTOTYPE" | "IDEA" | "CUSTOM";

type TaskRow = {
  id: string;
  cohort_id: string;
  intern_id: string;
  assigned_by: string;
  title: string;
  summary: string | null;
  start_week: number;
  end_week: number;
  primary_category: TaskPrimaryCategory;
  primary_category_custom: string | null;
  secondary_category: TaskSecondaryCategory;
  secondary_category_custom: string | null;
  difficulty: TaskDifficulty;
  expected_output: TaskExpectedOutput;
  expected_output_custom: string | null;
  created_at: string;
};

type TaskRecord = {
  id: string;
  cohortId: string;
  internId: string;
  assignedBy: string;
  title: string;
  summary: string;
  startWeek: number;
  endWeek: number;
  primaryCategory: TaskPrimaryCategory;
  primaryCategoryCustom: string | null;
  secondaryCategory: TaskSecondaryCategory;
  secondaryCategoryCustom: string | null;
  difficulty: TaskDifficulty;
  expectedOutput: TaskExpectedOutput;
  expectedOutputCustom: string | null;
  createdAt: string;
};

type TaskForm = {
  title: string;
  summary: string;
  startWeek: number;
  endWeek: number;
  primaryCategory: TaskPrimaryCategory;
  primaryCategoryCustom: string;
  secondaryCategory: TaskSecondaryCategory;
  secondaryCategoryCustom: string;
  difficulty: TaskDifficulty;
  expectedOutput: TaskExpectedOutput;
  expectedOutputCustom: string;
};

const primaryCategoryLabels: Record<TaskPrimaryCategory, string> = {
  SELF_STUDY: "자율 학습",
  MENTOR_TASK: "멘토 과제",
  PROJECT: "프로젝트 수행",
  CUSTOM: "직접 입력",
};

const secondaryCategoryLabels: Record<TaskSecondaryCategory, string> = {
  PROBLEM_SOLVING: "문제 해결",
  WORK_PARTICIPATION: "업무 참여",
  INNOVATION: "혁신/제안",
  CUSTOM: "직접 입력",
};

const difficultyLabels: Record<TaskDifficulty, string> = {
  BASIC: "기본",
  INTERMEDIATE: "중급",
  ADVANCED: "고급",
};

const expectedOutputLabels: Record<TaskExpectedOutput, string> = {
  DOCUMENT: "문서",
  ANALYSIS_REPORT: "분석 보고서",
  PRESENTATION: "발표 자료",
  PROTOTYPE: "프로토타입",
  IDEA: "아이디어",
  CUSTOM: "직접 입력",
};

const blankTask: TaskForm = {
  title: "",
  summary: "",
  startWeek: 1,
  endWeek: 2,
  primaryCategory: "SELF_STUDY",
  primaryCategoryCustom: "",
  secondaryCategory: "PROBLEM_SOLVING",
  secondaryCategoryCustom: "",
  difficulty: "BASIC",
  expectedOutput: "CUSTOM",
  expectedOutputCustom: "",
};

function mapTask(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    cohortId: row.cohort_id,
    internId: row.intern_id,
    assignedBy: row.assigned_by,
    title: row.title,
    summary: row.summary ?? "",
    startWeek: row.start_week,
    endWeek: row.end_week,
    primaryCategory: row.primary_category,
    primaryCategoryCustom: row.primary_category_custom,
    secondaryCategory: row.secondary_category,
    secondaryCategoryCustom: row.secondary_category_custom,
    difficulty: row.difficulty,
    expectedOutput: row.expected_output,
    expectedOutputCustom: row.expected_output_custom,
    createdAt: row.created_at,
  };
}

function categoryLabel(category: TaskPrimaryCategory, custom: string | null) {
  return category === "CUSTOM" ? custom || primaryCategoryLabels.CUSTOM : primaryCategoryLabels[category];
}

function secondaryCategoryLabel(category: TaskSecondaryCategory, custom: string | null) {
  return category === "CUSTOM" ? custom || secondaryCategoryLabels.CUSTOM : secondaryCategoryLabels[category];
}

function outputLabel(output: TaskExpectedOutput, custom: string | null) {
  return output === "CUSTOM" ? custom || expectedOutputLabels.CUSTOM : expectedOutputLabels[output];
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

export function TasksPage({ mode }: { mode: Role }) {
  const { currentUser, data, notify } = useAppStore();
  const [remoteTasks, setRemoteTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInternId, setSelectedInternId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRecord | null>(null);
  const [detailTask, setDetailTask] = useState<TaskRecord | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<number[]>([]);
  const [form, setForm] = useState<TaskForm>(blankTask);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadTasks = useCallback(async () => {
    const { data: rows, error: queryError } = await createClient()
      .from("tasks")
      .select("id,cohort_id,intern_id,assigned_by,title,summary,start_week,end_week,primary_category,primary_category_custom,secondary_category,secondary_category_custom,difficulty,expected_output,expected_output_custom,created_at")
      .order("start_week", { ascending: true })
      .order("created_at", { ascending: true });

    if (queryError) {
      notify("과제 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
    } else {
      setRemoteTasks(((rows ?? []) as TaskRow[]).map(mapTask));
    }
    setLoading(false);
  }, [notify]);

  useEffect(() => {
    if (!currentUser) return;
    const timer = window.setTimeout(() => void loadTasks(), 0);
    return () => window.clearTimeout(timer);
  }, [currentUser, loadTasks]);

  if (!currentUser) return null;
  const user = currentUser;
  const interns = data.profiles.filter((profile) => {
    if (profile.role !== "INTERN" || !profile.isActive) return false;
    if (mode === "ADMIN") return true;
    if (mode === "INTERN") return profile.id === user.id;
    return data.mentorAssignments.some((assignment) => assignment.internId === profile.id && (assignment.primaryMentorId === user.id || assignment.secondaryMentorId === user.id));
  });
  const activeInternId = mode === "INTERN" ? user.id : selectedInternId || interns[0]?.id || "";
  const activeIntern = interns.find((profile) => profile.id === activeInternId);
  const tasks = remoteTasks.filter((task) => task.internId === activeInternId).sort((a, b) => a.startWeek - b.startWeek);
  const totalWeeks = data.cohorts.find((cohort) => cohort.id === activeIntern?.cohortId)?.totalWeeks ?? 8;
  const weekCells = Array.from({ length: totalWeeks }, (_, index) => index + 1);
  const tasksByWeek = weekCells.map((week) => ({ week, tasks: tasks.filter((task) => task.startWeek <= week && task.endWeek >= week) }));

  function openCreate() {
    setEditing(null);
    setForm({ ...blankTask, endWeek: Math.min(2, totalWeeks) });
    setError("");
    setModalOpen(true);
  }

  function openEdit(task: TaskRecord) {
    setEditing(task);
    setForm({
      title: task.title,
      summary: task.summary,
      startWeek: task.startWeek,
      endWeek: task.endWeek,
      primaryCategory: task.primaryCategory,
      primaryCategoryCustom: task.primaryCategoryCustom ?? "",
      secondaryCategory: task.secondaryCategory,
      secondaryCategoryCustom: task.secondaryCategoryCustom ?? "",
      difficulty: task.difficulty,
      expectedOutput: task.expectedOutput,
      expectedOutputCustom: task.expectedOutputCustom ?? "",
    });
    setError("");
    setModalOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (mode === "INTERN") return;
    const primaryCustom = form.primaryCategoryCustom.trim();
    const secondaryCustom = form.secondaryCategoryCustom.trim();
    const outputCustom = form.expectedOutputCustom.trim();
    if (!form.title.trim() || !form.summary.trim()) {
      setError("과제명과 과제 요약을 입력해 주세요.");
      return;
    }
    if (form.primaryCategory === "CUSTOM" && !primaryCustom) {
      setError("1차 분류의 직접 입력 값을 작성해 주세요.");
      return;
    }
    if (form.secondaryCategory === "CUSTOM" && !secondaryCustom) {
      setError("2차 분류의 직접 입력 값을 작성해 주세요.");
      return;
    }
    if (form.expectedOutput === "CUSTOM" && !outputCustom) {
      setError("기대 산출물을 입력해 주세요.");
      return;
    }
    if (form.endWeek < form.startWeek || form.endWeek > totalWeeks) {
      setError("종료 주차는 시작 주차 이후이며 실습 기간 안이어야 합니다.");
      return;
    }
    if (!activeIntern?.cohortId) {
      setError("선택한 인턴의 기수 정보를 찾지 못했습니다.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      start_week: form.startWeek,
      end_week: form.endWeek,
      primary_category: form.primaryCategory,
      primary_category_custom: form.primaryCategory === "CUSTOM" ? primaryCustom : null,
      secondary_category: form.secondaryCategory,
      secondary_category_custom: form.secondaryCategory === "CUSTOM" ? secondaryCustom : null,
      difficulty: form.difficulty,
      expected_output: form.expectedOutput,
      expected_output_custom: form.expectedOutput === "CUSTOM" ? outputCustom : null,
    };

    setSaving(true);
    const supabase = createClient();
    const result = editing
      ? await supabase.from("tasks").update(payload).eq("id", editing.id)
      : await supabase.from("tasks").insert({ ...payload, cohort_id: activeIntern.cohortId, intern_id: activeInternId, assigned_by: user.id });
    setSaving(false);

    if (result.error) {
      setError(editing ? "과제를 수정하지 못했습니다. 권한과 입력 값을 확인해 주세요." : "과제를 배정하지 못했습니다. 권한과 입력 값을 확인해 주세요.");
      return;
    }

    setModalOpen(false);
    notify(editing ? "과제를 수정했습니다." : "과제를 배정했습니다.");
    await loadTasks();
  }

  async function remove(task: TaskRecord) {
    if (mode === "INTERN" || !window.confirm("‘" + task.title + "’ 과제를 삭제할까요?")) return;
    const { error: deleteError } = await createClient().from("tasks").delete().eq("id", task.id);
    if (deleteError) {
      notify("과제를 삭제하지 못했습니다. 권한을 확인해 주세요.", "error");
      return;
    }
    notify("과제를 삭제했습니다.", "info");
    await loadTasks();
  }

  async function exportExcel() {
    const rows = tasks.map((task) => [task.title, task.summary, task.startWeek, task.endWeek, categoryLabel(task.primaryCategory, task.primaryCategoryCustom), secondaryCategoryLabel(task.secondaryCategory, task.secondaryCategoryCustom), difficultyLabels[task.difficulty], outputLabel(task.expectedOutput, task.expectedOutputCustom), displayDate(task.createdAt)]);
    await exportExcelFile({
      fileName: (activeIntern?.name ?? "인턴") + "_과제계획.xlsx",
      sheetName: "과제 계획",
      headers: ["과제명", "과제 요약", "시작 주차", "종료 주차", "1차 분류", "2차 분류", "난이도", "기대 산출물", "배정일"],
      rows,
      widths: [28, 48, 12, 12, 18, 18, 10, 30, 14],
    });
    notify("과제 계획 Excel을 생성했습니다.");
  }

  return <>
    <PageHeader eyebrow="TASK ASSIGNMENT" title={mode === "INTERN" ? "나의 과제" : "과제 관리"} description={mode === "INTERN" ? "배정된 과제의 목표와 주차별 계획을 확인합니다." : mode === "MENTOR" ? "담당 인턴에게 과제를 배정하고 계획을 관리합니다." : "전체 인턴의 과제를 배정하고 진행 계획을 관리합니다."} actions={<><Button variant="secondary" onClick={exportExcel} disabled={!activeInternId}><Download size={17} /> Excel</Button>{mode !== "INTERN" ? <Button onClick={openCreate} disabled={!activeInternId}><Plus size={17} /> 과제 배정</Button> : null}</>} />
    {mode !== "INTERN" ? <Card className="selector-card"><SectionTitle title="인턴 선택" description={mode === "MENTOR" ? "본인에게 배정된 인턴만 과제를 관리할 수 있습니다." : "과제를 배정할 인턴을 선택하세요."} /><div className="intern-selector">{interns.map((intern) => <button key={intern.id} className={activeInternId === intern.id ? "active" : ""} onClick={() => setSelectedInternId(intern.id)}><Avatar imageUrl={intern.avatarUrl} name={intern.name} role={intern.role} /><span><strong>{intern.name}</strong><small>{intern.department}</small><em>{intern.projectGroup}</em></span></button>)}</div></Card> : null}
    {activeIntern ? <Card className="task-profile"><div><Avatar imageUrl={activeIntern.avatarUrl} name={activeIntern.name} role={activeIntern.role} size="large" /><span><small>{mode === "INTERN" ? "실습 정보" : "선택한 인턴"}</small><h2>{activeIntern.name}</h2><p>{activeIntern.email} · {activeIntern.department}</p></span></div><dl><dt>기수</dt><dd>{data.cohorts.find((cohort) => cohort.id === activeIntern.cohortId)?.name}</dd><dt>프로젝트 조</dt><dd>{activeIntern.projectGroup}</dd><dt>배정 과제</dt><dd>{tasks.length}개</dd></dl></Card> : null}
    <Card><SectionTitle title="과제 타임라인" description={totalWeeks + "주 실습 기간의 과제 일정을 확인합니다."} />{loading ? <p className="p-5 text-sm text-slate-500">과제를 불러오는 중입니다.</p> : tasks.length ? <div className="task-timeline"><div className="timeline-header" style={{ gridTemplateColumns: `220px repeat(${totalWeeks}, minmax(58px, 1fr))` }}><span>과제</span>{weekCells.map((week) => <span key={week}>{week}주</span>)}</div>{tasks.map((task) => <button type="button" className="timeline-row timeline-row-button" key={task.id} onClick={() => setDetailTask(task)} style={{ gridTemplateColumns: `220px repeat(${totalWeeks}, minmax(58px, 1fr))` }}><div><strong>{task.title}</strong><small>{categoryLabel(task.primaryCategory, task.primaryCategoryCustom)} · {difficultyLabels[task.difficulty]}</small></div>{weekCells.map((week) => <span key={week} className={week >= task.startWeek && week <= task.endWeek ? "filled" : ""}>{week === task.startWeek ? <i>{task.startWeek}–{task.endWeek}주</i> : null}</span>)}</button>)}</div> : <EmptyState title="배정된 과제가 없습니다." description={mode === "INTERN" ? "새 과제가 배정되면 여기에 표시됩니다." : "첫 과제를 배정해 보세요."} />}</Card>
    <Card className="weekly-tasks-card"><SectionTitle title="주간 과제" description="각 주차에 진행되는 과제를 확인합니다." />{loading ? null : tasks.length ? <div className="weekly-task-table"><div className="weekly-task-head"><span>주차</span><span>과제명</span></div>{tasksByWeek.map(({ week, tasks: weekTasks }) => { const expanded = expandedWeeks.includes(week); return <div className="weekly-task-row" key={week}><button type="button" className="weekly-week-toggle" onClick={() => setExpandedWeeks((current) => current.includes(week) ? current.filter((item) => item !== week) : [...current, week])} aria-expanded={expanded}><strong>{week}주차</strong><span>{expanded ? "−" : "+"}</span></button><div className="weekly-task-items">{weekTasks.length ? weekTasks.map((task) => <button type="button" className="weekly-task-link" key={task.id} onClick={() => setDetailTask(task)}>{task.title}</button>) : <span className="weekly-empty">진행 과제 없음</span>}{expanded && weekTasks.length ? <div className="weekly-expanded">{weekTasks.map((task) => <button type="button" key={task.id} onClick={() => setDetailTask(task)}><strong>{task.title}</strong><small>{task.startWeek}–{task.endWeek}주 · {categoryLabel(task.primaryCategory, task.primaryCategoryCustom)}</small></button>)}</div> : null}</div></div>; })}</div> : <EmptyState title="등록된 과제가 없습니다." description="과제가 배정되면 주차별로 표시됩니다." />}</Card>
    <Modal open={Boolean(detailTask)} onClose={() => setDetailTask(null)} title={detailTask?.title ?? "과제 상세"} description={detailTask ? `${detailTask.startWeek}–${detailTask.endWeek}주차 과제` : undefined} width="wide">{detailTask ? <div className="task-detail-modal"><p>{detailTask.summary}</p><div className="task-detail-tags"><Badge tone="blue">{categoryLabel(detailTask.primaryCategory, detailTask.primaryCategoryCustom)}</Badge><Badge tone="gray">{secondaryCategoryLabel(detailTask.secondaryCategory, detailTask.secondaryCategoryCustom)}</Badge><Badge tone={detailTask.difficulty === "ADVANCED" ? "red" : detailTask.difficulty === "INTERMEDIATE" ? "amber" : "green"}>{difficultyLabels[detailTask.difficulty]}</Badge><Badge tone="purple">{outputLabel(detailTask.expectedOutput, detailTask.expectedOutputCustom)}</Badge></div><dl><dt>과제 기간</dt><dd>{detailTask.startWeek}–{detailTask.endWeek}주차</dd><dt>배정자</dt><dd>{data.profiles.find((profile) => profile.id === detailTask.assignedBy)?.name ?? "운영자"}</dd><dt>배정일</dt><dd>{displayDate(detailTask.createdAt)}</dd></dl>{mode !== "INTERN" ? <div className="modal-actions"><Button onClick={() => { setDetailTask(null); openEdit(detailTask); }}><Pencil size={16} /> 수정</Button><Button variant="danger" onClick={() => { setDetailTask(null); void remove(detailTask); }}><Trash2 size={16} /> 삭제</Button></div> : null}</div> : null}</Modal>
    <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editing ? "과제 수정" : "새 과제 배정"} description={(activeIntern?.name ?? "선택한 인턴") + "에게 배정할 과제 정보를 입력하세요."} width="wide"><form className="form-stack" onSubmit={(event) => void save(event)}><Field label="과제명"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field><Field label="과제 요약"><textarea rows={4} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></Field><div className="form-grid"><Field label="시작 주차"><input type="number" min={1} max={totalWeeks} value={form.startWeek} onChange={(event) => setForm({ ...form, startWeek: Number(event.target.value) })} /></Field><Field label="종료 주차"><input type="number" min={1} max={totalWeeks} value={form.endWeek} onChange={(event) => setForm({ ...form, endWeek: Number(event.target.value) })} /></Field></div><div className="form-grid"><Field label="1차 분류"><select value={form.primaryCategory} onChange={(event) => setForm({ ...form, primaryCategory: event.target.value as TaskPrimaryCategory })}>{Object.entries(primaryCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="2차 분류"><select value={form.secondaryCategory} onChange={(event) => setForm({ ...form, secondaryCategory: event.target.value as TaskSecondaryCategory })}>{Object.entries(secondaryCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div>{form.primaryCategory === "CUSTOM" || form.secondaryCategory === "CUSTOM" ? <div className="form-grid">{form.primaryCategory === "CUSTOM" ? <Field label="1차 분류 직접 입력"><input value={form.primaryCategoryCustom} onChange={(event) => setForm({ ...form, primaryCategoryCustom: event.target.value })} /></Field> : <span />}{form.secondaryCategory === "CUSTOM" ? <Field label="2차 분류 직접 입력"><input value={form.secondaryCategoryCustom} onChange={(event) => setForm({ ...form, secondaryCategoryCustom: event.target.value })} /></Field> : <span />}</div> : null}<div className="form-grid"><Field label="난이도"><select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value as TaskDifficulty })}>{Object.entries(difficultyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="기대 산출물 유형"><select value={form.expectedOutput} onChange={(event) => setForm({ ...form, expectedOutput: event.target.value as TaskExpectedOutput })}>{Object.entries(expectedOutputLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div>{form.expectedOutput === "CUSTOM" ? <Field label="기대 산출물 직접 입력"><input value={form.expectedOutputCustom} onChange={(event) => setForm({ ...form, expectedOutputCustom: event.target.value })} /></Field> : null}{error ? <p className="form-error">{error}</p> : null}<div className="modal-actions"><Button type="button" variant="secondary" disabled={saving} onClick={() => setModalOpen(false)}>취소</Button><Button type="submit" disabled={saving}>{saving ? "저장 중..." : editing ? "변경 사항 저장" : "과제 배정"}</Button></div></form></Modal>
  </>;
}
