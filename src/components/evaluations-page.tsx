"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCheck, Download, Eye, Plus, RotateCcw } from "lucide-react";
import { type Evaluation } from "./app-data";
import { useAppStore } from "./app-store";
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, PageHeader, SectionTitle } from "./ui";
import { exportExcelFile } from "@/lib/export-excel";
import { createClient } from "@/lib/supabase/client";

type EvaluationRow = {
  id: string;
  intern_id: string;
  mentor_id: string;
  cohort_id: string;
  title: string;
  content: string;
  status: "ACTIVE" | "CANCELED";
  submitted_at: string;
  read_at: string | null;
};

type EvaluationRecord = Evaluation & { cohortId: string };

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

function toEvaluation(row: EvaluationRow): EvaluationRecord {
  return {
    id: row.id,
    internId: row.intern_id,
    mentorId: row.mentor_id,
    cohortId: row.cohort_id,
    title: row.title,
    content: row.content,
    status: row.status === "CANCELED" ? "CANCELED" : "ACTIVE",
    submittedAt: row.submitted_at,
    readAt: row.read_at ?? undefined,
  };
}

function formatDateTime(value?: string) {
  if (!value) return "미확인";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}

export function EvaluationsPage({ admin }: { admin: boolean }) {
  const { currentUser, data, notify } = useAppStore();
  const [selectedInternId, setSelectedInternId] = useState("");
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<EvaluationRecord | null>(null);
  const [form, setForm] = useState({ title: "", content: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  const interns = useMemo(() => {
    if (!currentUser) return [];
    return data.profiles.filter((profile) => (
      profile.role === "INTERN"
      && profile.isActive
      && (admin || data.mentorAssignments.some((assignment) => (
        assignment.internId === profile.id
        && (assignment.primaryMentorId === currentUser.id || assignment.secondaryMentorId === currentUser.id)
      )))
    ));
  }, [admin, currentUser, data.mentorAssignments, data.profiles]);

  const activeInternId = selectedInternId || interns[0]?.id || "";
  const activeIntern = interns.find((profile) => profile.id === activeInternId);

  const loadEvaluations = useCallback(async () => {
    if (!currentUser || !activeInternId) {
      setEvaluations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data: rows, error: queryError } = await createClient()
      .from("evaluations")
      .select("id,intern_id,mentor_id,cohort_id,title,content,status,submitted_at,read_at")
      .eq("intern_id", activeInternId)
      .order("submitted_at", { ascending: false });

    if (queryError) {
      setEvaluations([]);
      notify("평가 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
    } else {
      setEvaluations(((rows ?? []) as EvaluationRow[]).map(toEvaluation));
    }
    setLoading(false);
  }, [activeInternId, currentUser, notify]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEvaluations(), 0);
    return () => window.clearTimeout(timer);
  }, [loadEvaluations]);

  if (!currentUser) return null;
  const user = currentUser;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || form.content.trim().length < 10) {
      setError("제목과 10자 이상의 평가 내용을 입력해 주세요.");
      return;
    }
    if (admin || user.role !== "MENTOR") {
      setError("멘토 계정만 평가를 작성할 수 있습니다.");
      return;
    }
    if (!activeIntern || !activeIntern.cohortId) {
      setError("평가할 인턴과 기수 정보를 확인할 수 없습니다.");
      return;
    }

    setSaving(true);
    setError("");
    const { error: insertError } = await createClient()
      .from("evaluations")
      .insert({
        intern_id: activeIntern.id,
        mentor_id: user.id,
        cohort_id: activeIntern.cohortId,
        title: form.title.trim(),
        content: form.content.trim(),
        status: "ACTIVE",
      });
    setSaving(false);

    if (insertError) {
      setError("평가를 저장하지 못했습니다. 담당 인턴 배정과 작성 권한을 확인해 주세요.");
      return;
    }

    setFormOpen(false);
    setForm({ title: "", content: "" });
    notify("중간 평가를 제출했습니다.");
    await loadEvaluations();
  }

  async function cancelEvaluation(evaluation: EvaluationRecord) {
    if (actionPending || evaluation.mentorId !== user.id || evaluation.status === "CANCELED") return;
    if (!window.confirm("제출한 평가를 취소할까요? 취소 기록은 보존됩니다.")) return;

    setActionPending(true);
    const { error: updateError } = await createClient()
      .from("evaluations")
      .update({ status: "CANCELED" })
      .eq("id", evaluation.id);
    setActionPending(false);

    if (updateError) {
      notify("평가를 취소하지 못했습니다. 권한 또는 연결 상태를 확인해 주세요.", "error");
      return;
    }

    setDetail(null);
    notify("평가 제출을 취소했습니다.", "info");
    await loadEvaluations();
  }

  async function markRead(evaluation: EvaluationRecord) {
    if (actionPending || !admin || evaluation.readAt) return;

    setActionPending(true);
    const { error: updateError } = await createClient()
      .from("evaluations")
      .update({ read_at: new Date().toISOString() })
      .eq("id", evaluation.id);
    setActionPending(false);

    if (updateError) {
      notify("평가를 읽음 처리하지 못했습니다. 관리자 권한을 확인해 주세요.", "error");
      return;
    }

    setDetail(null);
    notify("평가를 읽음 처리했습니다.");
    await loadEvaluations();
  }

  async function exportExcel() {
    const rows = evaluations.map((evaluation) => [
      data.profiles.find((profile) => profile.id === evaluation.internId)?.name ?? "",
      data.profiles.find((profile) => profile.id === evaluation.mentorId)?.name ?? "",
      evaluation.title,
      evaluation.content,
      evaluation.status === "ACTIVE" ? "유효" : "취소",
      formatDateTime(evaluation.submittedAt),
      formatDateTime(evaluation.readAt),
    ]);

    await exportExcelFile({
      fileName: "중간평가_" + new Date().toISOString().slice(0, 10) + ".xlsx",
      sheetName: "중간 평가",
      headers: ["인턴", "멘토", "평가 제목", "평가 내용", "상태", "제출일", "읽음 일시"],
      rows,
      widths: [12, 12, 30, 70, 10, 20, 20],
    });
    notify("현재 조회 중인 평가를 Excel로 생성했습니다.");
  }

  return <>
    <PageHeader
      eyebrow="MIDTERM EVALUATION"
      title={admin ? "평가 관리" : "중간 평가"}
      description={admin ? "멘토가 제출한 전체 평가를 확인하고 열람 상태를 관리합니다." : "담당 인턴에게 피드백을 작성하고 제출 이력을 확인합니다."}
      actions={<>
        <Button variant="secondary" onClick={() => void exportExcel()} disabled={loading || !evaluations.length}><Download size={17} /> Excel</Button>
        {!admin ? <Button onClick={() => { setError(""); setFormOpen(true); }} disabled={!activeIntern}><Plus size={17} /> 평가 작성</Button> : null}
      </>}
    />
    <Card className="selector-card">
      <SectionTitle title="인턴 선택" description={admin ? "평가를 확인할 인턴을 선택해 주세요." : "본인에게 배정된 인턴만 표시됩니다."} />
      {interns.length ? <div className="intern-selector">{interns.map((intern) => (
        <button key={intern.id} className={activeInternId === intern.id ? "active" : ""} onClick={() => setSelectedInternId(intern.id)}>
          <Avatar name={intern.name} />
          <span><strong>{intern.name}</strong><small>{intern.department}</small><em>{intern.projectGroup}</em></span>
        </button>
      ))}</div> : <EmptyState title="선택할 인턴이 없습니다." description={admin ? "활성 인턴을 먼저 등록해 주세요." : "담당 인턴이 배정되면 이곳에 표시됩니다."} />}
    </Card>
    <Card>
      <SectionTitle title={(activeIntern?.name ?? "인턴") + " 평가 기록"} description={admin ? "평가 내용은 관리자만 전체 조회할 수 있습니다." : "다른 멘토가 작성한 평가는 표시되지 않습니다."} />
      {loading ? <p className="p-5 text-sm text-slate-500">평가 기록을 불러오는 중입니다.</p> : evaluations.length ? <div className="evaluation-list">{evaluations.map((evaluation) => (
        <article key={evaluation.id} className={evaluation.status === "CANCELED" ? "canceled" : ""}>
          <div className="evaluation-status">
            <Badge tone={evaluation.status === "ACTIVE" ? "green" : "gray"}>{evaluation.status === "ACTIVE" ? "제출 완료" : "취소됨"}</Badge>
            {evaluation.readAt ? <Badge tone="blue"><CheckCheck size={13} /> 읽음</Badge> : <Badge tone="amber">읽지 않음</Badge>}
          </div>
          <div>
            <h2>{evaluation.title}</h2>
            <p>{evaluation.content}</p>
            <small>{data.profiles.find((profile) => profile.id === evaluation.mentorId)?.name ?? "멘토"} 멘토 · {formatDateTime(evaluation.submittedAt)}</small>
          </div>
          <Button variant="secondary" onClick={() => setDetail(evaluation)}><Eye size={16} /> 상세 보기</Button>
        </article>
      ))}</div> : <EmptyState title="작성된 평가가 없습니다." description={admin ? "선택한 인턴의 평가가 아직 제출되지 않았습니다." : "첫 중간 평가를 작성해 보세요."} />}
    </Card>
    <Modal open={formOpen} onClose={() => !saving && setFormOpen(false)} title="중간 평가 작성" description={(activeIntern?.name ?? "선택한 인턴") + "의 업무 수행에 대한 피드백을 기록합니다."}>
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <Field label="평가 제목"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="예: 2주차 업무 수행 평가" /></Field>
        <Field label="평가 내용" hint="구체적인 강점과 개선점을 포함해 주세요."><textarea rows={9} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></Field>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-actions">
          <Button type="button" variant="secondary" disabled={saving} onClick={() => setFormOpen(false)}>취소</Button>
          <Button type="submit" disabled={saving}>{saving ? "저장 중..." : "평가 제출"}</Button>
        </div>
      </form>
    </Modal>
    <Modal open={Boolean(detail)} onClose={() => !actionPending && setDetail(null)} title={detail?.title ?? "평가 상세"}>
      {detail ? <div className="evaluation-detail">
        <div className="detail-badges">
          <Badge tone={detail.status === "ACTIVE" ? "green" : "gray"}>{detail.status === "ACTIVE" ? "제출 완료" : "취소됨"}</Badge>
          <span>{formatDateTime(detail.submittedAt)}</span>
        </div>
        <dl>
          <dt>인턴</dt><dd>{data.profiles.find((profile) => profile.id === detail.internId)?.name ?? "알 수 없음"}</dd>
          <dt>작성 멘토</dt><dd>{data.profiles.find((profile) => profile.id === detail.mentorId)?.name ?? "알 수 없음"}</dd>
          <dt>운영자 열람</dt><dd>{detail.readAt ? formatDateTime(detail.readAt) : "아직 읽지 않음"}</dd>
        </dl>
        <p>{detail.content}</p>
        <div className="modal-actions">
          {admin && !detail.readAt && detail.status === "ACTIVE" ? <Button disabled={actionPending} onClick={() => void markRead(detail)}><CheckCheck size={16} /> 읽음 처리</Button> : null}
          {!admin && detail.mentorId === user.id && detail.status === "ACTIVE" ? <Button disabled={actionPending} variant="danger" onClick={() => void cancelEvaluation(detail)}><RotateCcw size={16} /> 제출 취소</Button> : null}
        </div>
      </div> : null}
    </Modal>
  </>;
}
