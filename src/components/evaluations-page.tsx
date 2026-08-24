"use client";

import { useState } from "react";
import { CheckCheck, Download, Eye, Plus, RotateCcw } from "lucide-react";
import { uid, type Evaluation } from "./app-data";
import { useAppStore } from "./app-store";
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, PageHeader, SectionTitle } from "./ui";
import { exportExcelFile } from "@/lib/export-excel";

export function EvaluationsPage({ admin }: { admin: boolean }) {
  const { currentUser, data, setData, notify } = useAppStore();
  const [selectedInternId, setSelectedInternId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<Evaluation | null>(null);
  const [form, setForm] = useState({ title: "", content: "" });
  const [error, setError] = useState("");
  if (!currentUser) return null;
  const user = currentUser;

  const interns = data.profiles.filter((profile) => profile.role === "INTERN" && profile.isActive && (admin || data.mentorAssignments.some((assignment) => assignment.internId === profile.id && (assignment.primaryMentorId === user.id || assignment.secondaryMentorId === user.id))));
  const activeInternId = selectedInternId || interns[0]?.id || "";
  const evaluations = data.evaluations.filter((evaluation) => admin ? (!activeInternId || evaluation.internId === activeInternId) : evaluation.mentorId === user.id && evaluation.internId === activeInternId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const activeIntern = interns.find((profile) => profile.id === activeInternId);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || form.content.trim().length < 10) { setError("제목과 10자 이상의 평가 내용을 입력해 주세요."); return; }
    setData((previous) => ({ ...previous, evaluations: [{ id: uid("evaluation"), internId: activeInternId, mentorId: user.id, title: form.title.trim(), content: form.content.trim(), status: "ACTIVE", submittedAt: "2026-08-13 15:20" }, ...previous.evaluations] })); setFormOpen(false); setForm({ title: "", content: "" }); notify("중간 평가를 제출했습니다.");
  }
  function cancelEvaluation(evaluation: Evaluation) {
    if (evaluation.mentorId !== user.id || evaluation.status === "CANCELED") return;
    if (!window.confirm("제출한 평가를 취소할까요? 취소 기록은 보존됩니다.")) return;
    setData((previous) => ({ ...previous, evaluations: previous.evaluations.map((item) => item.id === evaluation.id ? { ...item, status: "CANCELED" } : item) })); setDetail(null); notify("평가 제출을 취소했습니다.", "info");
  }
  function markRead(evaluation: Evaluation) {
    if (!admin || evaluation.readAt) return;
    const readAt = "2026-08-13 15:30"; setData((previous) => ({ ...previous, evaluations: previous.evaluations.map((item) => item.id === evaluation.id ? { ...item, readAt } : item) })); setDetail({ ...evaluation, readAt }); notify("평가를 읽음 처리했습니다.");
  }
  async function exportExcel() {
    const rows = data.evaluations.filter((evaluation) => admin || evaluation.mentorId === user.id).map((evaluation) => [data.profiles.find((profile) => profile.id === evaluation.internId)?.name ?? "", data.profiles.find((profile) => profile.id === evaluation.mentorId)?.name ?? "", evaluation.title, evaluation.content, evaluation.status === "ACTIVE" ? "유효" : "취소", evaluation.submittedAt, evaluation.readAt ?? "미확인"]);
    await exportExcelFile({ fileName: "중간평가_2026-08-13.xlsx", sheetName: "중간 평가", headers: ["인턴", "멘토", "평가 제목", "평가 내용", "상태", "제출일", "읽은 일시"], rows, widths: [12, 12, 30, 70, 10, 20, 20] });
    notify("평가 Excel을 생성했습니다.");
  }

  return <>
    <PageHeader eyebrow="MIDTERM EVALUATION" title={admin ? "평가 관리" : "중간 평가"} description={admin ? "멘토가 제출한 전체 평가를 확인하고 열람 상태를 관리합니다." : "담당 인턴에게 피드백을 작성하고 제출 이력을 확인합니다."} actions={<><Button variant="secondary" onClick={exportExcel}><Download size={17} /> Excel</Button>{!admin ? <Button onClick={() => { setError(""); setFormOpen(true); }}><Plus size={17} /> 평가 작성</Button> : null}</>} />
    <Card className="selector-card"><SectionTitle title="인턴 선택" description={admin ? "전체 평가를 확인할 인턴을 선택하세요." : "본인에게 배정된 인턴만 표시됩니다."} /><div className="intern-selector">{interns.map((intern) => <button key={intern.id} className={activeInternId === intern.id ? "active" : ""} onClick={() => setSelectedInternId(intern.id)}><Avatar name={intern.name} /><span><strong>{intern.name}</strong><small>{intern.department}</small><em>{intern.projectGroup}</em></span></button>)}</div></Card>
    <Card><SectionTitle title={`${activeIntern?.name ?? "인턴"} 평가 기록`} description={admin ? "평가 내용은 관리자만 전체 조회할 수 있습니다." : "다른 멘토가 작성한 평가는 표시되지 않습니다."} />{evaluations.length ? <div className="evaluation-list">{evaluations.map((evaluation) => <article key={evaluation.id} className={evaluation.status === "CANCELED" ? "canceled" : ""}><div className="evaluation-status"><Badge tone={evaluation.status === "ACTIVE" ? "green" : "gray"}>{evaluation.status === "ACTIVE" ? "제출 완료" : "취소됨"}</Badge>{evaluation.readAt ? <Badge tone="blue"><CheckCheck size={13} /> 읽음</Badge> : <Badge tone="amber">읽지 않음</Badge>}</div><div><h2>{evaluation.title}</h2><p>{evaluation.content}</p><small>{data.profiles.find((profile) => profile.id === evaluation.mentorId)?.name} 멘토 · {evaluation.submittedAt}</small></div><Button variant="secondary" onClick={() => setDetail(evaluation)}><Eye size={16} /> 상세 보기</Button></article>)}</div> : <EmptyState title="작성된 평가가 없습니다." description={admin ? "선택한 인턴의 평가가 아직 제출되지 않았습니다." : "첫 중간 평가를 작성해 보세요."} />}</Card>
    <Modal open={formOpen} onClose={() => setFormOpen(false)} title="중간 평가 작성" description={`${activeIntern?.name ?? "선택한 인턴"}의 업무 수행에 대한 피드백을 기록합니다.`}><form className="form-stack" onSubmit={submit}><Field label="평가 제목"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="예: 2주차 업무 수행 평가" /></Field><Field label="평가 내용" hint="구체적인 강점과 개선점을 포함해 주세요."><textarea rows={9} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></Field>{error ? <p className="form-error">{error}</p> : null}<div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>취소</Button><Button type="submit">평가 제출</Button></div></form></Modal>
    <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.title ?? "평가 상세"}>{detail ? <div className="evaluation-detail"><div className="detail-badges"><Badge tone={detail.status === "ACTIVE" ? "green" : "gray"}>{detail.status === "ACTIVE" ? "제출 완료" : "취소됨"}</Badge><span>{detail.submittedAt}</span></div><dl><dt>인턴</dt><dd>{data.profiles.find((profile) => profile.id === detail.internId)?.name}</dd><dt>작성 멘토</dt><dd>{data.profiles.find((profile) => profile.id === detail.mentorId)?.name}</dd><dt>운영자 열람</dt><dd>{detail.readAt ?? "아직 읽지 않음"}</dd></dl><p>{detail.content}</p><div className="modal-actions">{admin && !detail.readAt && detail.status === "ACTIVE" ? <Button onClick={() => markRead(detail)}><CheckCheck size={16} /> 읽음 처리</Button> : null}{!admin && detail.mentorId === user.id && detail.status === "ACTIVE" ? <Button variant="danger" onClick={() => cancelEvaluation(detail)}><RotateCcw size={16} /> 제출 취소</Button> : null}</div></div> : null}</Modal>
  </>;
}
