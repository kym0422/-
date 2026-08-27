"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarPlus, MessageCircle, Paperclip, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { formatBytes, type Notice } from "@/components/app-data";
import { useAppStore } from "@/components/app-store";
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type NoticeTarget = Notice["target"] | "COHORT";

type NoticeCommentRow = {
  id: string;
  content: string;
  created_by: string;
  author_display_name: string;
  created_at: string;
  notice_attachments: NoticeAttachmentRow[] | null;
};

type NoticeAttachmentRow = {
  id: string;
  original_file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
};

type CalendarLinkRow = {
  id: string;
  is_important: boolean;
};

type NoticeRow = {
  id: string;
  title: string;
  content: string;
  target_type: NoticeTarget;
  target_cohort_id: string | null;
  starts_on: string;
  ends_on: string | null;
  created_by: string;
  author_display_name: string;
  created_at: string;
  is_important: boolean;
  notice_comments: NoticeCommentRow[] | null;
  calendar_events: CalendarLinkRow[] | null;
};

type NoticeAttachment = {
  id: string;
  originalFileName: string;
  storageBucket: string;
  storagePath: string;
  sizeBytes: number;
};

type NoticeComment = Notice["comments"][number] & { attachments: NoticeAttachment[] };

type NoticeItem = Omit<Notice, "target" | "comments"> & {
  target: NoticeTarget;
  authorName: string;
  calendarEventId?: string;
  targetCohortId?: string;
  comments: NoticeComment[];
};

const targetLabels: Record<NoticeTarget, string> = {
  ALL: "전체 사용자",
  ADMIN: "관리자",
  MENTOR: "멘토",
  INTERN: "인턴",
  COHORT: "기수",
};

const editableTargetLabels: Record<Notice["target"], string> = {
  ALL: targetLabels.ALL,
  ADMIN: targetLabels.ADMIN,
  MENTOR: targetLabels.MENTOR,
  INTERN: targetLabels.INTERN,
};

const emptyForm = {
  title: "",
  content: "",
  target: "ALL" as Notice["target"],
  startDate: "2026-08-13",
  endDate: "",
  important: false,
  calendarLinked: false,
};

const attachmentBucket = "notice-attachments";
const attachmentMimeTypes: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
};

function fileExtension(name: string) { return name.split(".").pop()?.toLowerCase() ?? ""; }
function safeFileName(name: string) { return name.replace(/[^a-zA-Z0-9._-]/g, "_"); }

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Seoul",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Seoul",
});

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function displayDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}

function toNotice(row: NoticeRow): NoticeItem {
  const linkedEvent = row.calendar_events?.[0];

  return {
    id: row.id,
    title: row.title,
    content: row.content,
    target: row.target_type,
    createdBy: row.created_by,
    createdAt: displayDate(row.created_at),
    startDate: row.starts_on,
    endDate: row.ends_on ?? undefined,
    important: row.is_important,
    calendarLinked: Boolean(linkedEvent),
    calendarEventId: linkedEvent?.id,
    targetCohortId: row.target_cohort_id ?? undefined,
    authorName: row.author_display_name,
    comments: [...(row.notice_comments ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((comment) => ({
      id: comment.id,
      authorId: comment.created_by,
      authorName: comment.author_display_name,
      content: comment.content,
      createdAt: displayDateTime(comment.created_at),
      attachments: (comment.notice_attachments ?? []).map((attachment) => ({
        id: attachment.id,
        originalFileName: attachment.original_file_name,
        storageBucket: attachment.storage_bucket,
        storagePath: attachment.storage_path,
        sizeBytes: attachment.file_size_bytes,
      })),
    })),
  };
}

export default function NoticesPage() {
  const { currentUser, notify } = useAppStore();
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<NoticeItem | null>(null);
  const [editing, setEditing] = useState<NoticeItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [comment, setComment] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const loadNotices = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error: queryError } = await createClient()
        .from("notices")
        .select("id,title,content,target_type,target_cohort_id,starts_on,ends_on,created_by,author_display_name,created_at,is_important,notice_comments(id,content,created_by,author_display_name,created_at,notice_attachments(id,original_file_name,storage_bucket,storage_path,mime_type,file_size_bytes)),calendar_events(id,is_important)")
        .order("created_at", { ascending: false });

      if (queryError) {
        notify("공지사항을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
        return;
      }

      const nextNotices = ((data ?? []) as NoticeRow[]).map(toNotice);
      setNotices(nextNotices);
      setSelected((previous) => previous ? nextNotices.find((notice) => notice.id === previous.id) ?? null : null);
    } catch {
      notify("공지사항을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    if (!currentUser) return;
    const timer = window.setTimeout(() => void loadNotices(), 0);
    return () => window.clearTimeout(timer);
  }, [currentUser, loadNotices]);

  if (!currentUser) return null;
  const user = currentUser;

  // Visibility is intentionally enforced by Supabase RLS, not this client filter.
  const visible = notices
    .filter((notice) => (notice.title + " " + notice.content).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => Number(b.important) - Number(a.important) || b.createdAt.localeCompare(a.createdAt));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setFormOpen(true);
  }

  function openEdit(notice: NoticeItem) {
    if (notice.target === "COHORT") {
      notify("기수 대상 공지는 현재 이 화면에서 수정할 수 없습니다.", "info");
      return;
    }

    setEditing(notice);
    setForm({
      title: notice.title,
      content: notice.content,
      target: notice.target,
      startDate: notice.startDate,
      endDate: notice.endDate ?? "",
      important: notice.important,
      calendarLinked: notice.calendarLinked,
    });
    setError("");
    setSelected(null);
    setFormOpen(true);
  }

  async function saveNotice(event: React.FormEvent) {
    event.preventDefault();

    if (!form.title.trim() || !form.content.trim() || !form.startDate) {
      setError("제목, 내용, 적용 시작일을 입력해 주세요.");
      return;
    }

    if (form.endDate && form.endDate < form.startDate) {
      setError("적용 종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const supabase = createClient();

      if (editing) {
        const { error: noticeError } = await supabase
          .from("notices")
          .update({
            title: form.title.trim(),
            content: form.content.trim(),
            target_type: form.target,
            target_cohort_id: null,
            starts_on: form.startDate,
            ends_on: form.endDate || null,
            is_important: form.important,
          })
          .eq("id", editing.id);

        if (noticeError) {
          setError("공지사항을 수정하지 못했습니다. 작성 권한을 확인해 주세요.");
          return;
        }

        setFormOpen(false);
        notify("공지사항을 수정했습니다.");
      } else {
        const { data: createdNotice, error: noticeError } = await supabase
          .from("notices")
          .insert({
            title: form.title.trim(),
            content: form.content.trim(),
            target_type: form.target,
            starts_on: form.startDate,
            ends_on: form.endDate || null,
            created_by: user.id,
            is_important: form.important,
          })
          .select("id")
          .single();

        if (noticeError || !createdNotice) {
          setError("공지사항을 등록하지 못했습니다. 작성 권한을 확인해 주세요.");
          return;
        }

        if (form.calendarLinked) {
          const { error: calendarError } = await supabase.from("calendar_events").insert({
            notice_id: createdNotice.id,
            title: form.title.trim(),
            description: form.content.trim(),
            start_at: form.startDate + "T00:00:00+09:00",
            end_at: (form.endDate || form.startDate) + "T23:59:59.999+09:00",
            event_type: "SCHEDULE",
            visibility: form.target,
            is_important: form.important,
            is_completed: false,
            created_by: user.id,
          });

          if (calendarError) {
            const { error: cleanupError } = await supabase.from("notices").delete().eq("id", createdNotice.id);
            setError(
              cleanupError
                ? "공지 등록 후 연결된 캘린더를 만들지 못했습니다. 생성된 공지를 관리자에게 확인해 주세요."
                : "연결된 캘린더를 만들지 못해 공지 등록을 취소했습니다. 다시 시도해 주세요.",
            );
            return;
          }
        }

        setFormOpen(false);
        notify(form.calendarLinked ? "공지와 연결된 일정을 등록했습니다." : "공지사항을 등록했습니다.");
      }

      await loadNotices();
    } catch {
      setError("공지사항을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNotice(notice: NoticeItem) {
    if (!window.confirm("'" + notice.title + "' 공지와 연결된 일정을 삭제할까요?")) return;

    try {
      const { error: deleteError } = await createClient().from("notices").delete().eq("id", notice.id);
      if (deleteError) {
        notify("공지사항을 삭제하지 못했습니다. 관리자 권한을 확인해 주세요.", "error");
        return;
      }

      setSelected(null);
      notify("공지사항을 삭제했습니다.", "info");
      await loadNotices();
    } catch {
      notify("공지사항을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
    }
  }

  async function downloadAttachment(attachment: NoticeAttachment) {
    const { data: file, error: downloadError } = await createClient().storage
      .from(attachment.storageBucket)
      .download(attachment.storagePath);
    if (downloadError || !file) {
      notify("첨부 파일을 다운로드하지 못했습니다.", "error");
      return;
    }

    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = attachment.originalFileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function addComment(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !comment.trim()) return;

    setCommentSaving(true);

    try {
      const supabase = createClient();
      const { data: createdComment, error: commentError } = await supabase
        .from("notice_comments")
        .insert({
          notice_id: selected.id,
          content: comment.trim(),
          created_by: user.id,
        })
        .select("id")
        .single();

      if (commentError || !createdComment) {
        notify("댓글을 등록하지 못했습니다. 공지 열람 권한을 확인해 주세요.", "error");
        return;
      }

      if (attachmentFile) {
        const mimeType = attachmentMimeTypes[fileExtension(attachmentFile.name)];
        if (!mimeType || attachmentFile.size > 25 * 1024 * 1024) {
          await supabase.from("notice_comments").delete().eq("id", createdComment.id);
          notify("첨부 파일 형식 또는 크기(최대 25MB)를 확인해 주세요.", "error");
          return;
        }

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          await supabase.from("notice_comments").delete().eq("id", createdComment.id);
          notify("로그인 정보를 확인하지 못했습니다.", "error");
          return;
        }

        const attachmentId = crypto.randomUUID();
        const path = `${authData.user.id}/${createdComment.id}/${attachmentId}-${safeFileName(attachmentFile.name)}`;
        const { error: metadataError } = await supabase.from("notice_attachments").insert({
          id: attachmentId,
          notice_id: selected.id,
          comment_id: createdComment.id,
          original_file_name: attachmentFile.name,
          storage_bucket: attachmentBucket,
          storage_path: path,
          mime_type: mimeType,
          file_size_bytes: attachmentFile.size,
          uploaded_by: user.id,
        });
        if (metadataError) {
          await supabase.from("notice_comments").delete().eq("id", createdComment.id);
          notify("첨부 파일 정보를 저장하지 못했습니다.", "error");
          return;
        }

        const { error: storageError } = await supabase.storage.from(attachmentBucket).upload(path, attachmentFile, { contentType: mimeType, upsert: false });
        if (storageError) {
          await supabase.from("notice_attachments").delete().eq("id", attachmentId);
          await supabase.from("notice_comments").delete().eq("id", createdComment.id);
          notify("첨부 파일을 업로드하지 못했습니다.", "error");
          return;
        }
      }

      setComment("");
      setAttachmentFile(null);
      notify("댓글을 등록했습니다.");
      await loadNotices();
    } catch {
      notify("댓글을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
    } finally {
      setCommentSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="COMMUNICATION"
        title="공지사항"
        description="프로그램 운영 소식과 주요 안내를 확인합니다."
        actions={user.role === "ADMIN" ? <Button onClick={openCreate}><Plus size={17} /> 새 공지 작성</Button> : undefined}
      />
      <Card>
        <div className="toolbar">
          <div className="search-field">
            <Search size={18} />
            <input aria-label="공지 검색" placeholder="제목이나 내용 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <span className="result-count">총 {visible.length}건</span>
        </div>
        {loading ? <p className="p-5 text-sm text-slate-500">공지사항을 불러오는 중입니다.</p> : visible.length ? (
          <div className="notice-list">
            {visible.map((notice) => (
              <article key={notice.id} className="notice-card" onClick={() => setSelected(notice)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setSelected(notice)}>
                <div className="notice-card-top">
                  <span>
                    {notice.important ? <Badge tone="red">중요</Badge> : null}
                    <Badge tone="blue">{targetLabels[notice.target]}</Badge>
                    {notice.calendarLinked ? <Badge tone="green"><CalendarPlus size={12} /> 캘린더</Badge> : null}
                  </span>
                  <time>{notice.createdAt}</time>
                </div>
                <h2>{notice.title}</h2>
                <p>{notice.content}</p>
                <footer>
                  <span>작성자 {notice.authorName}</span>
                  <span><MessageCircle size={15} /> 댓글 {notice.comments.length}</span>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="검색 결과가 없습니다." description="검색어를 바꾸거나 새로운 공지를 등록해 주세요." />
        )}
      </Card>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "공지사항 수정" : "새 공지사항"} description="노출 대상과 적용 기간을 정확히 설정해 주세요.">
        <form className="form-stack" onSubmit={(event) => void saveNotice(event)}>
          <Field label="제목"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="공지 제목" /></Field>
          <Field label="내용"><textarea rows={6} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="공지 내용을 입력하세요." /></Field>
          <div className="form-grid">
            <Field label="대상">
              <select value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value as Notice["target"] })}>
                {Object.entries(editableTargetLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="적용 시작일"><input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></Field>
          </div>
          <Field label="적용 종료일" hint="선택 사항"><input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></Field>
          <label className="check-row">
            <input type="checkbox" checked={form.important} onChange={(event) => setForm({ ...form, important: event.target.checked })} />
            <span><strong>중요 공지</strong><small>목록에서 강조 표시합니다.</small></span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={form.calendarLinked} disabled={Boolean(editing)} onChange={(event) => setForm({ ...form, calendarLinked: event.target.checked })} />
            <span><strong>공유 캘린더에 추가</strong><small>공지와 연결된 일정을 함께 생성합니다.</small></span>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="modal-actions">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setFormOpen(false)}>취소</Button>
            <Button type="submit" disabled={saving}>{saving ? "저장 중..." : editing ? "변경 저장" : "공지 등록"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title ?? "공지 상세"} width="wide">
        {selected ? (
          <div className="notice-detail">
            <div className="detail-badges">
              {selected.important ? <Badge tone="red">중요</Badge> : null}
              <Badge tone="blue">{targetLabels[selected.target]}</Badge>
              <time>{selected.createdAt}</time>
            </div>
            <p className="detail-content">{selected.content}</p>
            {user.role === "ADMIN" ? (
              <div className="inline-actions">
                <Button variant="secondary" onClick={() => openEdit(selected)}><Pencil size={16} /> 수정</Button>
                <Button variant="danger" onClick={() => void deleteNotice(selected)}><Trash2 size={16} /> 삭제</Button>
              </div>
            ) : null}
            <hr />
            <h3 className="comment-heading"><MessageCircle size={18} /> 댓글 {selected.comments.length}</h3>
            <div className="comment-list">
              {selected.comments.map((item) => (
                <div key={item.id}>
                  <strong>{item.authorName}</strong>
                  <time>{item.createdAt}</time>
                  <p>{item.content}</p>
                  {item.attachments.length ? <div className="attachment-list">{item.attachments.map((attachment) => <button type="button" className="file-button" key={attachment.id} onClick={() => void downloadAttachment(attachment)}><Paperclip size={15} /> {attachment.originalFileName} ({formatBytes(attachment.sizeBytes)})</button>)}</div> : null}
                </div>
              ))}
            </div>
            <form className="comment-form" onSubmit={(event) => void addComment(event)}>
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="댓글을 입력하세요." rows={3} />
              <input ref={attachmentInputRef} className="sr-only" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.zip" onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)} />
              <div>
                <button type="button" className="file-button" onClick={() => attachmentInputRef.current?.click()}><Paperclip size={16} /> {attachmentFile ? attachmentFile.name : "파일 첨부"}</button>
                <span><Paperclip size={16} /> 첨부 파일은 최대 25MB</span>
                <Button type="submit" disabled={!comment.trim() || commentSaving}>{commentSaving ? "등록 중..." : "댓글 등록"}</Button>
              </div>
            </form>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
