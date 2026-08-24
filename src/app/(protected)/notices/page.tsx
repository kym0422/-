"use client";

import { useState } from "react";
import { CalendarPlus, MessageCircle, Paperclip, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { uid, type Notice } from "@/components/app-data";
import { useAppStore } from "@/components/app-store";
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader } from "@/components/ui";

const targetLabels: Record<Notice["target"], string> = { ALL: "전체 사용자", ADMIN: "관리자", MENTOR: "멘토", INTERN: "인턴" };

const emptyForm = { title: "", content: "", target: "ALL" as Notice["target"], startDate: "2026-08-13", endDate: "", important: false, calendarLinked: false };

export default function NoticesPage() {
  const { currentUser, data, setData, notify } = useAppStore();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Notice | null>(null);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  if (!currentUser) return null;
  const user = currentUser;

  const visible = data.notices
    .filter((notice) => notice.target === "ALL" || notice.target === user.role)
    .filter((notice) => `${notice.title} ${notice.content}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => Number(b.important) - Number(a.important) || b.createdAt.localeCompare(a.createdAt));

  function openCreate() {
    setEditing(null); setForm(emptyForm); setError(""); setFormOpen(true);
  }
  function openEdit(notice: Notice) {
    setEditing(notice); setForm({ title: notice.title, content: notice.content, target: notice.target, startDate: notice.startDate, endDate: notice.endDate ?? "", important: notice.important, calendarLinked: notice.calendarLinked }); setError(""); setSelected(null); setFormOpen(true);
  }
  function saveNotice(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim() || !form.startDate) { setError("제목, 내용, 적용 시작일을 입력해 주세요."); return; }
    if (form.endDate && form.endDate < form.startDate) { setError("적용 종료일은 시작일보다 빠를 수 없습니다."); return; }
    if (editing) {
      setData((previous) => ({ ...previous, notices: previous.notices.map((notice) => notice.id === editing.id ? { ...notice, ...form, endDate: form.endDate || undefined } : notice), events: previous.events.map((calendarEvent) => calendarEvent.noticeId === editing.id ? { ...calendarEvent, title: form.title, description: form.content, startDate: form.startDate, endDate: form.endDate || form.startDate, isImportant: form.important, visibility: form.target === "ALL" ? "ALL" : form.target } : calendarEvent) }));
      notify("공지사항을 수정했습니다.");
    } else {
      const noticeId = uid("notice");
      const notice: Notice = { id: noticeId, ...form, endDate: form.endDate || undefined, createdBy: user.id, createdAt: "2026-08-13", comments: [] };
      setData((previous) => ({ ...previous, notices: [notice, ...previous.notices], events: form.calendarLinked ? [...previous.events, { id: uid("event"), title: form.title, description: form.content, startDate: form.startDate, endDate: form.endDate || form.startDate, eventType: "SCHEDULE", visibility: form.target === "ALL" ? "ALL" : form.target, isImportant: form.important, isCompleted: false, createdBy: user.id, noticeId }] : previous.events }));
      notify(form.calendarLinked ? "공지와 연결된 일정을 등록했습니다." : "공지사항을 등록했습니다.");
    }
    setFormOpen(false);
  }
  function deleteNotice(notice: Notice) {
    if (!window.confirm(`‘${notice.title}’ 공지와 연결된 일정을 삭제할까요?`)) return;
    setData((previous) => ({ ...previous, notices: previous.notices.filter((item) => item.id !== notice.id), events: previous.events.filter((event) => event.noticeId !== notice.id) }));
    setSelected(null); notify("공지사항을 삭제했습니다.", "info");
  }
  function addComment(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !comment.trim()) return;
    const next = { id: uid("comment"), authorId: user.id, authorName: user.name, content: comment.trim(), createdAt: "2026-08-13 14:20" };
    setData((previous) => ({ ...previous, notices: previous.notices.map((notice) => notice.id === selected.id ? { ...notice, comments: [...notice.comments, next] } : notice) }));
    setSelected({ ...selected, comments: [...selected.comments, next] }); setComment(""); notify("댓글을 등록했습니다.");
  }

  return (
    <>
      <PageHeader eyebrow="COMMUNICATION" title="공지사항" description="프로그램 운영 소식과 역할별 안내를 확인합니다." actions={user.role === "ADMIN" ? <Button onClick={openCreate}><Plus size={17} /> 새 공지 작성</Button> : undefined} />
      <Card>
        <div className="toolbar"><div className="search-field"><Search size={18} /><input aria-label="공지 검색" placeholder="제목이나 내용 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></div><span className="result-count">총 {visible.length}건</span></div>
        {visible.length ? <div className="notice-list">{visible.map((notice) => (
          <article key={notice.id} className="notice-card" onClick={() => setSelected(notice)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setSelected(notice)}>
            <div className="notice-card-top"><span>{notice.important ? <Badge tone="red">중요</Badge> : null}<Badge tone="blue">{targetLabels[notice.target]}</Badge>{notice.calendarLinked ? <Badge tone="green"><CalendarPlus size={12} /> 캘린더</Badge> : null}</span><time>{notice.createdAt}</time></div>
            <h2>{notice.title}</h2><p>{notice.content}</p>
            <footer><span>작성자 {data.profiles.find((profile) => profile.id === notice.createdBy)?.name ?? "운영자"}</span><span><MessageCircle size={15} /> 댓글 {notice.comments.length}</span></footer>
          </article>
        ))}</div> : <EmptyState title="검색 결과가 없습니다." description="검색어를 바꾸거나 새로운 공지를 등록해 주세요." />}
      </Card>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "공지사항 수정" : "새 공지사항"} description="노출 대상과 적용 기간을 정확히 설정해 주세요.">
        <form className="form-stack" onSubmit={saveNotice}>
          <Field label="제목"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="공지 제목" /></Field>
          <Field label="내용"><textarea rows={6} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="공지 내용을 입력하세요." /></Field>
          <div className="form-grid"><Field label="대상"><select value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value as Notice["target"] })}>{Object.entries(targetLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field><Field label="적용 시작일"><input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></Field></div>
          <Field label="적용 종료일" hint="선택 사항"><input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></Field>
          <label className="check-row"><input type="checkbox" checked={form.important} onChange={(event) => setForm({ ...form, important: event.target.checked })} /><span><strong>중요 공지</strong><small>목록에서 강조 표시합니다.</small></span></label>
          <label className="check-row"><input type="checkbox" checked={form.calendarLinked} disabled={Boolean(editing)} onChange={(event) => setForm({ ...form, calendarLinked: event.target.checked })} /><span><strong>공유 캘린더에 추가</strong><small>공지와 연결된 일정을 함께 생성합니다.</small></span></label>
          {error ? <p className="form-error">{error}</p> : null}<div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>취소</Button><Button type="submit">{editing ? "변경 저장" : "공지 등록"}</Button></div>
        </form>
      </Modal>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title ?? "공지 상세"} width="wide">
        {selected ? <div className="notice-detail"><div className="detail-badges">{selected.important ? <Badge tone="red">중요</Badge> : null}<Badge tone="blue">{targetLabels[selected.target]}</Badge><time>{selected.createdAt}</time></div><p className="detail-content">{selected.content}</p>
          {user.role === "ADMIN" ? <div className="inline-actions"><Button variant="secondary" onClick={() => openEdit(selected)}><Pencil size={16} /> 수정</Button><Button variant="danger" onClick={() => deleteNotice(selected)}><Trash2 size={16} /> 삭제</Button></div> : null}
          <hr /><h3 className="comment-heading"><MessageCircle size={18} /> 댓글 {selected.comments.length}</h3><div className="comment-list">{selected.comments.map((item) => <div key={item.id}><strong>{item.authorName}</strong><time>{item.createdAt}</time><p>{item.content}</p></div>)}</div>
          <form className="comment-form" onSubmit={addComment}><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="댓글을 입력하세요." rows={3} /><div><span><Paperclip size={16} /> 첨부파일은 최대 25MB</span><Button type="submit" disabled={!comment.trim()}>댓글 등록</Button></div></form>
        </div> : null}
      </Modal>
    </>
  );
}
