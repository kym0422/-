"use client";

import { useState } from "react";
import { CheckCheck, Eye, LockKeyhole, Plus, RotateCcw, ShieldCheck } from "lucide-react";
import { uid, type Suggestion } from "./app-data";
import { useAppStore } from "./app-store";
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, SectionTitle } from "./ui";

export function SuggestionsPage({ admin }: { admin: boolean }) {
  const { currentUser, data, setData, notify } = useAppStore();
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<Suggestion | null>(null);
  const [form, setForm] = useState({ title: "", content: "" });
  const [error, setError] = useState("");
  if (!currentUser) return null;
  const user = currentUser;
  const suggestions = data.suggestions.filter((suggestion) => admin || suggestion.ownerToken === user.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || form.content.trim().length < 10) { setError("제목과 10자 이상의 건의 내용을 입력해 주세요."); return; }
    setData((previous) => ({ ...previous, suggestions: [{ id: uid("suggestion"), ownerToken: user.id, title: form.title.trim(), content: form.content.trim(), status: "ACTIVE", submittedAt: "2026-08-13 15:45" }, ...previous.suggestions] })); setFormOpen(false); setForm({ title: "", content: "" }); notify("건의를 익명으로 제출했습니다.");
  }
  function cancel(suggestion: Suggestion) {
    if (admin || suggestion.ownerToken !== user.id || suggestion.status === "CANCELED") return;
    if (!window.confirm("이 건의를 취소할까요? 취소된 기록은 보존됩니다.")) return;
    setData((previous) => ({ ...previous, suggestions: previous.suggestions.map((item) => item.id === suggestion.id ? { ...item, status: "CANCELED" } : item) })); setDetail(null); notify("건의를 취소했습니다.", "info");
  }
  function markRead(suggestion: Suggestion) {
    if (!admin || suggestion.readAt) return;
    const readAt = "2026-08-13 15:50"; setData((previous) => ({ ...previous, suggestions: previous.suggestions.map((item) => item.id === suggestion.id ? { ...item, readAt } : item) })); setDetail({ ...suggestion, readAt }); notify("건의를 읽음 처리했습니다.");
  }

  return <>
    <PageHeader eyebrow="ANONYMOUS VOICE" title="익명 건의" description={admin ? "작성자 식별정보 없이 제목과 내용만 확인합니다." : "더 나은 현장실습을 위한 의견을 안전하게 전달하세요."} actions={!admin ? <Button onClick={() => { setError(""); setFormOpen(true); }}><Plus size={17} /> 건의 작성</Button> : undefined} />
    <div className="privacy-banner"><span><ShieldCheck size={23} /></span><div><strong>{admin ? "데모 운영자 화면에는 작성자 정보를 표시하지 않습니다." : "익명 건의 화면 흐름을 안전하게 검토하세요."}</strong><p>{admin ? "현재 브라우저 데모 저장소는 보안 경계가 아닙니다. 실제 익명성은 Supabase RPC와 분리 매핑 연동 후 보장됩니다." : "현재 데모에서는 화면상 익명으로 처리됩니다. 운영 환경에서는 준비된 Supabase 분리 스키마와 RLS를 연결해야 합니다."}</p></div><LockKeyhole size={22} /></div>
    <Card><SectionTitle title={admin ? "접수된 건의" : "내가 제출한 건의"} description={admin ? `총 ${suggestions.length}건 · 읽지 않음 ${suggestions.filter((item) => !item.readAt && item.status === "ACTIVE").length}건` : "본인이 제출한 내역과 운영자 열람 상태입니다."} />{suggestions.length ? <div className="suggestion-list">{suggestions.map((suggestion) => <article key={suggestion.id} className={suggestion.status === "CANCELED" ? "canceled" : ""}><div className="anonymous-avatar"><LockKeyhole size={20} /></div><div><span className="suggestion-badges"><Badge tone={suggestion.status === "ACTIVE" ? "green" : "gray"}>{suggestion.status === "ACTIVE" ? "접수" : "취소"}</Badge>{suggestion.readAt ? <Badge tone="blue"><CheckCheck size={13} /> 읽음</Badge> : <Badge tone="amber">읽지 않음</Badge>}</span><h2>{suggestion.title}</h2><p>{suggestion.content}</p><small>{suggestion.submittedAt} · 익명 제출</small></div><Button variant="secondary" onClick={() => setDetail(suggestion)}><Eye size={16} /> 상세</Button></article>)}</div> : <EmptyState title="등록된 건의가 없습니다." description={admin ? "새로운 건의가 접수되면 이곳에 표시됩니다." : "불편한 점이나 개선 아이디어를 자유롭게 남겨 주세요."} />}</Card>
    <Modal open={formOpen} onClose={() => setFormOpen(false)} title="익명 건의 작성" description="데모에서는 운영자 화면에 작성자를 표시하지 않습니다."><form className="form-stack" onSubmit={submit}><Field label="제목"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="건의 내용을 잘 나타내는 제목" /></Field><Field label="내용" hint="개인을 식별할 수 있는 정보를 직접 작성하지 마세요."><textarea rows={9} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="개선이 필요한 점과 제안을 구체적으로 작성해 주세요." /></Field>{error ? <p className="form-error">{error}</p> : null}<div className="anonymous-confirm"><LockKeyhole size={18} /><span><strong>익명 제출 데모</strong><small>운영 연동 시 Supabase RPC가 계정 식별정보를 별도 스키마로 분리합니다.</small></span></div><div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>취소</Button><Button type="submit">익명으로 제출</Button></div></form></Modal>
    <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.title ?? "건의 상세"}>{detail ? <div className="suggestion-detail"><div className="anonymous-detail-head"><span><LockKeyhole size={21} /></span><div><strong>익명 제출자</strong><small>데모 화면에서 신원 미표시</small></div></div><div className="detail-badges"><Badge tone={detail.status === "ACTIVE" ? "green" : "gray"}>{detail.status === "ACTIVE" ? "접수" : "취소"}</Badge><span>{detail.submittedAt}</span></div><p>{detail.content}</p><dl><dt>운영자 열람</dt><dd>{detail.readAt ? `읽음 · ${detail.readAt}` : "읽지 않음"}</dd></dl><div className="modal-actions">{admin && !detail.readAt && detail.status === "ACTIVE" ? <Button onClick={() => markRead(detail)}><CheckCheck size={16} /> 읽음 처리</Button> : null}{!admin && detail.status === "ACTIVE" ? <Button variant="danger" onClick={() => cancel(detail)}><RotateCcw size={16} /> 건의 취소</Button> : null}</div></div> : null}</Modal>
  </>;
}
