"use client";

import { useState } from "react";
import { CalendarRange, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { uid, type AssignedTask, type Role } from "./app-data";
import { useAppStore } from "./app-store";
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, PageHeader, SectionTitle } from "./ui";
import { exportExcelFile } from "@/lib/export-excel";

const blankTask = { title: "", summary: "", startWeek: 1, endWeek: 2, primaryCategory: "자율 학습", secondaryCategory: "문제 해결", difficulty: "기본" as AssignedTask["difficulty"], expectedOutput: "" };

export function TasksPage({ mode }: { mode: Role }) {
  const { currentUser, data, setData, notify } = useAppStore();
  const [selectedInternId, setSelectedInternId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AssignedTask | null>(null);
  const [form, setForm] = useState(blankTask);
  const [error, setError] = useState("");
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
  const tasks = data.tasks.filter((task) => task.internId === activeInternId).sort((a, b) => a.startWeek - b.startWeek);
  const totalWeeks = data.cohorts.find((cohort) => cohort.id === activeIntern?.cohortId)?.totalWeeks ?? 8;
  const weekCells = Array.from({ length: totalWeeks }, (_, index) => index + 1);

  function openCreate() { setEditing(null); setForm(blankTask); setError(""); setModalOpen(true); }
  function openEdit(task: AssignedTask) { setEditing(task); setForm({ title: task.title, summary: task.summary, startWeek: task.startWeek, endWeek: task.endWeek, primaryCategory: task.primaryCategory, secondaryCategory: task.secondaryCategory, difficulty: task.difficulty, expectedOutput: task.expectedOutput }); setError(""); setModalOpen(true); }
  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.summary.trim() || !form.expectedOutput.trim()) { setError("과제명, 요약, 기대 산출물을 입력해 주세요."); return; }
    if (form.endWeek < form.startWeek || form.endWeek > totalWeeks) { setError(`종료 주차는 시작 주차 이후이며 ${totalWeeks}주 이내여야 합니다.`); return; }
    if (editing) setData((previous) => ({ ...previous, tasks: previous.tasks.map((task) => task.id === editing.id ? { ...task, ...form } : task) }));
    else setData((previous) => ({ ...previous, tasks: [...previous.tasks, { id: uid("task"), internId: activeInternId, assignedBy: user.id, createdAt: "2026-08-13", ...form }] }));
    setModalOpen(false); notify(editing ? "과제를 수정했습니다." : "과제를 배정했습니다.");
  }
  function remove(task: AssignedTask) { if (!window.confirm(`‘${task.title}’ 과제를 삭제할까요?`)) return; setData((previous) => ({ ...previous, tasks: previous.tasks.filter((item) => item.id !== task.id) })); notify("과제를 삭제했습니다.", "info"); }
  async function exportExcel() {
    const rows = tasks.map((task) => [task.title, task.summary, task.startWeek, task.endWeek, task.primaryCategory, task.secondaryCategory, task.difficulty, task.expectedOutput, task.createdAt]);
    await exportExcelFile({ fileName: `${activeIntern?.name ?? "인턴"}_과제계획_2026-08-13.xlsx`, sheetName: "과제 계획", headers: ["과제명", "과제 요약", "시작 주차", "종료 주차", "1차 분류", "2차 분류", "난이도", "기대 산출물", "배정일"], rows, widths: [28, 48, 12, 12, 18, 18, 10, 30, 14] });
    notify("과제 계획 Excel을 생성했습니다.");
  }

  return <>
    <PageHeader eyebrow="TASK ASSIGNMENT" title={mode === "INTERN" ? "나의 과제" : "과제 관리"} description={mode === "INTERN" ? "배정된 과제의 목표와 주차별 계획을 확인합니다." : mode === "MENTOR" ? "담당 인턴에게 과제를 배정하고 계획을 관리합니다." : "전체 인턴의 과제를 배정하고 진행 계획을 관리합니다."} actions={<><Button variant="secondary" onClick={exportExcel} disabled={!activeInternId}><Download size={17} /> Excel</Button>{mode !== "INTERN" ? <Button onClick={openCreate} disabled={!activeInternId}><Plus size={17} /> 과제 배정</Button> : null}</>} />
    {mode !== "INTERN" ? <Card className="selector-card"><SectionTitle title="인턴 선택" description={mode === "MENTOR" ? "본인에게 배정된 인턴만 과제를 관리할 수 있습니다." : "과제를 배정할 인턴을 선택하세요."} /><div className="intern-selector">{interns.map((intern) => <button key={intern.id} className={activeInternId === intern.id ? "active" : ""} onClick={() => setSelectedInternId(intern.id)}><Avatar name={intern.name} /><span><strong>{intern.name}</strong><small>{intern.department}</small><em>{intern.projectGroup}</em></span></button>)}</div></Card> : null}
    {activeIntern ? <Card className="task-profile"><div><Avatar name={activeIntern.name} size="large" /><span><small>{mode === "INTERN" ? "실습 정보" : "선택한 인턴"}</small><h2>{activeIntern.name}</h2><p>{activeIntern.email} · {activeIntern.department}</p></span></div><dl><dt>기수</dt><dd>{data.cohorts.find((cohort) => cohort.id === activeIntern.cohortId)?.name}</dd><dt>프로젝트 조</dt><dd>{activeIntern.projectGroup}</dd><dt>배정 과제</dt><dd>{tasks.length}개</dd></dl></Card> : null}
    <Card><SectionTitle title="과제 타임라인" description={`${totalWeeks}주 실습 기간의 과제 일정을 확인합니다.`} />
      {tasks.length ? <div className="task-timeline"><div className="timeline-header"><span>과제</span>{weekCells.map((week) => <span key={week}>{week}주</span>)}</div>{tasks.map((task) => <div className="timeline-row" key={task.id}><div><strong>{task.title}</strong><small>{task.primaryCategory} · {task.difficulty}</small></div>{weekCells.map((week) => <span key={week} className={week >= task.startWeek && week <= task.endWeek ? "filled" : ""}>{week === task.startWeek ? <i>{task.startWeek}–{task.endWeek}주</i> : null}</span>)}</div>)}</div> : <EmptyState title="배정된 과제가 없습니다." description={mode === "INTERN" ? "새 과제가 배정되면 여기에 표시됩니다." : "첫 과제를 배정해 보세요."} />}
    </Card>
    <div className="task-list">{tasks.map((task) => <Card className="task-card" key={task.id}><div className="task-card-header"><span className="task-number"><CalendarRange size={19} /></span><div><span><Badge tone={task.difficulty === "고급" ? "red" : task.difficulty === "중급" ? "amber" : "green"}>{task.difficulty}</Badge><Badge tone="blue">{task.startWeek}–{task.endWeek}주</Badge></span><h2>{task.title}</h2></div>{mode !== "INTERN" ? <div><button className="icon-button" onClick={() => openEdit(task)} aria-label="과제 수정"><Pencil size={17} /></button><button className="icon-button danger-icon" onClick={() => remove(task)} aria-label="과제 삭제"><Trash2 size={17} /></button></div> : null}</div><p>{task.summary}</p><dl><dt>1차 분류</dt><dd>{task.primaryCategory}</dd><dt>2차 분류</dt><dd>{task.secondaryCategory}</dd><dt>기대 산출물</dt><dd>{task.expectedOutput}</dd></dl><footer>배정자 {data.profiles.find((profile) => profile.id === task.assignedBy)?.name ?? "운영자"} · {task.createdAt}</footer></Card>)}</div>
    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "과제 수정" : "새 과제 배정"} description={`${activeIntern?.name ?? "선택한 인턴"}에게 배정할 과제 정보를 입력하세요.`} width="wide"><form className="form-stack" onSubmit={save}><Field label="과제명"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field><Field label="과제 요약"><textarea rows={4} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></Field><div className="form-grid"><Field label="시작 주차"><input type="number" min={1} max={totalWeeks} value={form.startWeek} onChange={(event) => setForm({ ...form, startWeek: Number(event.target.value) })} /></Field><Field label="종료 주차"><input type="number" min={1} max={totalWeeks} value={form.endWeek} onChange={(event) => setForm({ ...form, endWeek: Number(event.target.value) })} /></Field></div><div className="form-grid"><Field label="1차 분류"><select value={form.primaryCategory} onChange={(event) => setForm({ ...form, primaryCategory: event.target.value })}><option>자율 학습</option><option>멘토 과제</option><option>프로젝트 수행</option><option>직접 입력</option></select></Field><Field label="2차 분류"><select value={form.secondaryCategory} onChange={(event) => setForm({ ...form, secondaryCategory: event.target.value })}><option>문제 해결</option><option>업무 참여</option><option>혁신/제안</option><option>직접 입력</option></select></Field></div><div className="form-grid"><Field label="난이도"><select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value as AssignedTask["difficulty"] })}><option>기본</option><option>중급</option><option>고급</option></select></Field><Field label="기대 산출물"><input value={form.expectedOutput} onChange={(event) => setForm({ ...form, expectedOutput: event.target.value })} /></Field></div>{error ? <p className="form-error">{error}</p> : null}<div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>취소</Button><Button type="submit">{editing ? "변경 저장" : "과제 배정"}</Button></div></form></Modal>
  </>;
}
