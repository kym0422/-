"use client";

import { useRef, useState } from "react";
import { Download, FileText, Plus, Save, Trash2, UploadCloud } from "lucide-react";
import { uid, type Role, type WeeklyReportItem } from "./app-data";
import { useAppStore } from "./app-store";
import { Avatar, Badge, Button, Card, EmptyState, Field, PageHeader, ProgressBar, SectionTitle } from "./ui";
import { exportExcelFile } from "@/lib/export-excel";

export function WeeklyReportsPage({ mode }: { mode: Role }) {
  const { currentUser, data, setData, notify } = useAppStore();
  const [selectedInternId, setSelectedInternId] = useState("");
  const [week, setWeek] = useState(1);
  const [projectType, setProjectType] = useState<"개인 프로젝트" | "팀 프로젝트">("개인 프로젝트");
  const [draftItems, setDraftItems] = useState<WeeklyReportItem[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
  const report = data.weeklyReports.find((item) => item.internId === activeInternId && item.weekNumber === week && item.projectType === projectType);
  const items = mode === "INTERN" ? (draftItems ?? report?.items ?? []) : report?.items ?? [];

  const allReports = data.weeklyReports.filter((item) => item.internId === activeInternId);
  const totals = { weeks: new Set(allReports.map((item) => item.weekNumber)).size, items: allReports.reduce((sum, item) => sum + item.items.length, 0) };

  function chooseContext(nextInternId: string, nextWeek = week, nextType = projectType) {
    setSelectedInternId(nextInternId); setWeek(nextWeek); setProjectType(nextType); setDraftItems(null);
  }
  function updateItem(id: string, patch: Partial<WeeklyReportItem>) {
    const base = draftItems ?? report?.items ?? [];
    setDraftItems(base.map((item) => item.id === id ? { ...item, ...patch } : item));
  }
  function addItem() {
    const base = draftItems ?? report?.items ?? [];
    setDraftItems([...base, { id: uid("report-item"), description: "", progress: 0, weeklyFeedback: "" }]);
  }
  function removeItem(id: string) {
    if (!window.confirm("이 업무 항목을 삭제할까요?")) return;
    const base = draftItems ?? report?.items ?? [];
    setDraftItems(base.filter((item) => item.id !== id));
  }
  function saveReport() {
    if (!items.length) { notify("저장할 업무 항목을 먼저 추가해 주세요.", "error"); return; }
    if (items.some((item) => !item.description.trim() || item.progress < 0 || item.progress > 100)) { notify("업무 내용과 0~100 범위의 진행률을 확인해 주세요.", "error"); return; }
    const nextReport = { id: report?.id ?? uid("report"), internId: user.id, cohortId: user.cohortId ?? "cohort-2", projectType, weekNumber: week, items, updatedAt: "2026-08-13 15:00" };
    setData((previous) => ({ ...previous, weeklyReports: report ? previous.weeklyReports.map((item) => item.id === report.id ? nextReport : item) : [...previous.weeklyReports, nextReport] }));
    setDraftItems(null); notify(`${week}주차 업무 기록을 저장했습니다.`);
  }
  async function exportExcel() {
    const rows = data.weeklyReports.filter((item) => item.internId === activeInternId).flatMap((item) => item.items.map((entry, index) => [item.weekNumber, item.projectType, index + 1, entry.description, entry.progress, entry.attachmentName ?? "", entry.weeklyFeedback, item.updatedAt]));
    await exportExcelFile({ fileName: `${activeIntern?.name ?? "인턴"}_주간업무보고_2026-08-13.xlsx`, sheetName: "주간 업무보고", headers: ["주차", "과제 유형", "번호", "주간 작업 항목", "진행률(%)", "첨부 파일", "주간 피드백", "수정일"], rows, widths: [8, 16, 8, 42, 12, 24, 42, 20] });
    notify("Excel 파일을 생성했습니다.");
  }
  function attachFile(id: string, file: File | undefined) {
    if (!file) return; if (file.size > 25 * 1024 * 1024) { notify("첨부파일은 25MB를 넘을 수 없습니다.", "error"); return; } updateItem(id, { attachmentName: file.name });
  }

  return <>
    <PageHeader eyebrow="WEEKLY REPORT" title="주간 업무보고" description={mode === "INTERN" ? "이번 주 업무와 진행률을 기록하고 꾸준히 저장하세요." : mode === "MENTOR" ? "담당 인턴의 주간 업무 기록을 읽기 전용으로 확인합니다." : "기수별 인턴의 주간 업무 기록을 읽기 전용으로 확인합니다."} actions={<Button variant="secondary" onClick={exportExcel} disabled={!activeInternId}><Download size={17} /> 전체 주차 Excel</Button>} />
    {mode !== "INTERN" ? <Card className="selector-card"><SectionTitle title="인턴 선택" description={mode === "MENTOR" ? "본인에게 배정된 인턴만 표시됩니다." : "현재 기수의 전체 인턴입니다."} /><div className="intern-selector">{interns.map((intern) => <button key={intern.id} className={activeInternId === intern.id ? "active" : ""} onClick={() => chooseContext(intern.id)}><Avatar name={intern.name} /><span><strong>{intern.name}</strong><small>{intern.department}</small><em>{intern.projectGroup}</em></span></button>)}</div></Card> : null}
    <Card>
      <div className="report-context"><div>{activeIntern ? <><Avatar name={activeIntern.name} size="large" /><span><small>{mode === "INTERN" ? "작성자" : "선택한 인턴"}</small><strong>{activeIntern.name}</strong><em>{activeIntern.department} · {activeIntern.projectGroup}</em></span></> : null}</div><div className="context-stats"><span><small>저장 주차</small><strong>{totals.weeks}</strong></span><span><small>전체 항목</small><strong>{totals.items}</strong></span></div></div>
      <div className="report-filters"><Field label="과제 유형"><select value={projectType} onChange={(event) => chooseContext(activeInternId, week, event.target.value as typeof projectType)}><option>개인 프로젝트</option><option>팀 프로젝트</option></select></Field><Field label="주차"><select value={week} onChange={(event) => chooseContext(activeInternId, Number(event.target.value), projectType)}>{Array.from({ length: 8 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}주차</option>)}</select></Field><div className="read-mode-badge">{mode === "INTERN" ? <Badge tone="green">작성 가능</Badge> : <Badge tone="gray">읽기 전용</Badge>}</div></div>
      {items.length ? <div className="report-table-wrap"><table className="data-table report-table"><thead><tr><th>#</th><th>주간 작업 항목</th><th>진행률</th><th>첨부 파일</th><th>주간 피드백</th>{mode === "INTERN" ? <th>삭제</th> : null}</tr></thead><tbody>{items.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td>{mode === "INTERN" ? <textarea value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} aria-label={`${index + 1}번 작업 항목`} rows={3} /> : <strong>{item.description}</strong>}</td><td>{mode === "INTERN" ? <div className="progress-editor"><input type="number" min={0} max={100} value={item.progress} onChange={(event) => updateItem(item.id, { progress: Number(event.target.value) })} /><span>%</span></div> : <div className="table-progress"><strong>{item.progress}%</strong><ProgressBar value={item.progress} /></div>}</td><td>{mode === "INTERN" ? <button className="file-button" onClick={() => { fileRef.current?.click(); fileRef.current?.setAttribute("data-item", item.id); }}><UploadCloud size={16} /> {item.attachmentName ?? "파일 선택"}</button> : item.attachmentName ? <span className="file-name"><FileText size={15} />{item.attachmentName}</span> : "-"}</td><td>{mode === "INTERN" ? <textarea value={item.weeklyFeedback} onChange={(event) => updateItem(item.id, { weeklyFeedback: event.target.value })} aria-label={`${index + 1}번 주간 피드백`} rows={3} /> : item.weeklyFeedback || "-"}</td>{mode === "INTERN" ? <td><button className="icon-button danger-icon" onClick={() => removeItem(item.id)} aria-label={`${index + 1}번 항목 삭제`}><Trash2 size={17} /></button></td> : null}</tr>)}</tbody></table></div> : <EmptyState title="아직 등록된 주간 업무 기록이 없습니다." description={mode === "INTERN" ? "작업 추가 버튼을 눌러 이번 주 기록을 시작하세요." : "선택한 조건에 저장된 기록이 없습니다."} action={mode === "INTERN" ? <Button onClick={addItem}><Plus size={17} /> 작업 추가</Button> : undefined} />}
      {mode === "INTERN" ? <div className="report-bottom-actions"><Button variant="secondary" onClick={addItem}><Plus size={17} /> 작업 추가</Button><Button onClick={saveReport}><Save size={17} /> 주간 기록 저장</Button></div> : null}
      <input ref={fileRef} className="sr-only" type="file" onChange={(event) => { const id = event.currentTarget.getAttribute("data-item"); if (id) attachFile(id, event.target.files?.[0]); event.target.value = ""; }} />
    </Card>
  </>;
}
