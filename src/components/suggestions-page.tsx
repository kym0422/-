"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCheck, Eye, MessageCircleQuestion, Plus, RotateCcw, ShieldCheck } from "lucide-react";
import { useAppStore } from "./app-store";
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, SectionTitle } from "./ui";
import { createClient } from "@/lib/supabase/client";

type SuggestionRow = {
  id: string;
  title: string;
  content: string;
  status: "ACTIVE" | "CANCELED";
  submitted_at: string;
  read_at: string | null;
};

type SuggestionRecord = {
  id: string;
  title: string;
  content: string;
  status: "ACTIVE" | "CANCELED";
  submittedAt: string;
  readAt?: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

function toSuggestion(row: SuggestionRow): SuggestionRecord {
  return {
    id: row.id,
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

export function SuggestionsPage({ admin }: { admin: boolean }) {
  const { currentUser, notify } = useAppStore();
  const [suggestions, setSuggestions] = useState<SuggestionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<SuggestionRecord | null>(null);
  const [form, setForm] = useState({ title: "", content: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  const loadSuggestions = useCallback(async () => {
    if (!currentUser) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data: rows, error: queryError } = await createClient()
      .from("suggestions")
      .select("id,title,content,status,submitted_at,read_at")
      .order("submitted_at", { ascending: false });

    if (queryError) {
      setSuggestions([]);
      notify("건의 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
    } else {
      setSuggestions(((rows ?? []) as SuggestionRow[]).map(toSuggestion));
    }
    setLoading(false);
  }, [currentUser, notify]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSuggestions(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSuggestions]);

  if (!currentUser) return null;
  const user = currentUser;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || form.content.trim().length < 10) {
      setError("제목과 10자 이상의 건의 내용을 입력해 주세요.");
      return;
    }
    if (admin || user.role !== "INTERN") {
      setError("활성 인턴 계정만 익명 건의를 제출할 수 있습니다.");
      return;
    }

    setSaving(true);
    setError("");
    const { error: submitError } = await createClient().rpc("submit_suggestion", {
      suggestion_title: form.title.trim(),
      suggestion_content: form.content.trim(),
    });
    setSaving(false);

    if (submitError) {
      setError("건의를 제출하지 못했습니다. 로그인 상태와 권한을 확인해 주세요.");
      return;
    }

    setFormOpen(false);
    setForm({ title: "", content: "" });
    notify("건의를 익명으로 제출했습니다.");
    await loadSuggestions();
  }

  async function cancel(suggestion: SuggestionRecord) {
    if (actionPending || admin || suggestion.status === "CANCELED") return;
    if (!window.confirm("이 건의를 취소할까요? 취소 기록은 보존됩니다.")) return;

    setActionPending(true);
    const { error: cancelError } = await createClient().rpc("cancel_own_suggestion", {
      target_suggestion_id: suggestion.id,
    });
    setActionPending(false);

    if (cancelError) {
      notify("건의를 취소하지 못했습니다. 본인이 제출한 건의인지 확인해 주세요.", "error");
      return;
    }

    setDetail(null);
    notify("건의를 취소했습니다.", "info");
    await loadSuggestions();
  }

  async function markRead(suggestion: SuggestionRecord) {
    if (actionPending || !admin || suggestion.readAt) return;

    setActionPending(true);
    const { error: markError } = await createClient().rpc("mark_suggestion_read", {
      target_suggestion_id: suggestion.id,
    });
    setActionPending(false);

    if (markError) {
      notify("건의를 읽음 처리하지 못했습니다. 관리자 권한을 확인해 주세요.", "error");
      return;
    }

    setDetail(null);
    notify("건의를 읽음 처리했습니다.");
    await loadSuggestions();
  }

  return <>
    <PageHeader
      eyebrow="ANONYMOUS VOICE"
      title="익명 건의"
      description={admin ? "작성자 식별정보 없이 건의 내용과 처리 상태만 확인합니다." : "더 나은 현장실습 환경을 위한 의견을 안전하게 전달해 주세요."}
      actions={!admin ? <Button onClick={() => { setError(""); setFormOpen(true); }}><Plus size={17} /> 건의 작성</Button> : undefined}
    />
    <div className="privacy-banner">
      <span><ShieldCheck size={23} /></span>
      <div>
        <strong>{admin ? "운영자 화면에는 작성자 정보가 표시되지 않습니다." : "익명 건의의 작성자 정보는 별도 보안 경계로 보호됩니다."}</strong>
        <p>제출·취소·읽음 처리는 권한 정책으로 검증하며, 공개 건의에는 작성자 식별정보를 저장하지 않습니다.</p>
      </div>
      <MessageCircleQuestion size={22} />
    </div>
    <Card>
      <SectionTitle
        title={admin ? "접수된 건의" : "내가 제출한 건의"}
        description={admin ? "총 " + suggestions.length + "건 · 읽지 않음 " + suggestions.filter((item) => !item.readAt && item.status === "ACTIVE").length + "건" : "본인이 제출한 내역과 운영자 열람 상태입니다."}
      />
      {loading ? <p className="p-5 text-sm text-slate-500">건의 목록을 불러오는 중입니다.</p> : suggestions.length ? <div className="suggestion-list">{suggestions.map((suggestion) => (
        <article key={suggestion.id} className={suggestion.status === "CANCELED" ? "canceled" : ""}>
          <div className="anonymous-avatar"><MessageCircleQuestion size={20} /></div>
          <div>
            <span className="suggestion-badges">
              <Badge tone={suggestion.status === "ACTIVE" ? "green" : "gray"}>{suggestion.status === "ACTIVE" ? "접수" : "취소"}</Badge>
              {suggestion.readAt ? <Badge tone="blue"><CheckCheck size={13} /> 읽음</Badge> : <Badge tone="amber">읽지 않음</Badge>}
            </span>
            <h2>{suggestion.title}</h2>
            <p>{suggestion.content}</p>
            <small>{formatDateTime(suggestion.submittedAt)} · 익명 제출</small>
          </div>
          <Button variant="secondary" onClick={() => setDetail(suggestion)}><Eye size={16} /> 상세</Button>
        </article>
      ))}</div> : <EmptyState title="등록된 건의가 없습니다." description={admin ? "새로운 건의가 접수되면 이곳에 표시됩니다." : "불편한 점이나 개선 아이디어를 자유롭게 남겨 주세요."} />}
    </Card>
    <Modal open={formOpen} onClose={() => !saving && setFormOpen(false)} title="익명 건의 작성" description="운영자 화면에는 작성자를 식별할 수 있는 정보가 표시되지 않습니다.">
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        <Field label="제목"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="건의 내용을 잘 나타내는 제목" /></Field>
        <Field label="내용" hint="개인 식별이 가능한 정보는 직접 작성하지 말아 주세요."><textarea rows={9} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="개선이 필요한 점과 제안을 구체적으로 작성해 주세요." /></Field>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="anonymous-confirm">
          <MessageCircleQuestion size={18} />
          <span><strong>익명 제출 보호</strong><small>계정 식별정보와 공개 건의 데이터를 분리해 보호합니다.</small></span>
        </div>
        <div className="modal-actions">
          <Button type="button" variant="secondary" disabled={saving} onClick={() => setFormOpen(false)}>취소</Button>
          <Button type="submit" disabled={saving}>{saving ? "제출 중..." : "익명으로 제출"}</Button>
        </div>
      </form>
    </Modal>
    <Modal open={Boolean(detail)} onClose={() => !actionPending && setDetail(null)} title={detail?.title ?? "건의 상세"}>
      {detail ? <div className="suggestion-detail">
        <div className="anonymous-detail-head">
          <span><MessageCircleQuestion size={21} /></span>
          <div><strong>익명 제출</strong><small>작성자 정보는 이 화면에 표시되지 않습니다.</small></div>
        </div>
        <div className="detail-badges">
          <Badge tone={detail.status === "ACTIVE" ? "green" : "gray"}>{detail.status === "ACTIVE" ? "접수" : "취소"}</Badge>
          <span>{formatDateTime(detail.submittedAt)}</span>
        </div>
        <p>{detail.content}</p>
        <dl><dt>운영자 열람</dt><dd>{detail.readAt ? "읽음 · " + formatDateTime(detail.readAt) : "읽지 않음"}</dd></dl>
        <div className="modal-actions">
          {admin && !detail.readAt && detail.status === "ACTIVE" ? <Button disabled={actionPending} onClick={() => void markRead(detail)}><CheckCheck size={16} /> 읽음 처리</Button> : null}
          {!admin && detail.status === "ACTIVE" ? <Button disabled={actionPending} variant="danger" onClick={() => void cancel(detail)}><RotateCcw size={16} /> 건의 취소</Button> : null}
        </div>
      </div> : null}
    </Modal>
  </>;
}
