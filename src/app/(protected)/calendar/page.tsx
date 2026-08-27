"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, Check, Plus, Trash2 } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type EventType = "SCHEDULE" | "TODO";
type Visibility = "ALL" | "PRIVATE" | "ADMIN" | "MENTOR" | "INTERN";

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  eventType: EventType;
  visibility: Visibility;
  isImportant: boolean;
  isCompleted: boolean;
  createdBy: string;
};

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  event_type: EventType;
  visibility: Visibility;
  is_important: boolean;
  is_completed: boolean;
  created_by: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function toEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startDate: row.start_at.slice(0, 10),
    endDate: row.end_at.slice(0, 10),
    eventType: row.event_type,
    visibility: row.visibility,
    isImportant: row.is_important,
    isCompleted: row.is_completed,
    createdBy: row.created_by,
  };
}

export default function CalendarPage() {
  const { currentUser, notify } = useAppStore();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: today(),
    eventType: "SCHEDULE" as EventType,
    visibility: "ALL" as Visibility,
    isImportant: false,
  });

  const loadEvents = useCallback(async () => {
    const { data, error } = await createClient()
      .from("calendar_events")
      .select("id,title,description,start_at,end_at,event_type,visibility,is_important,is_completed,created_by")
      .order("start_at", { ascending: true });

    if (error) {
      notify("일정을 불러오지 못했습니다. Supabase 연결과 권한을 확인해 주세요.", "error");
    } else {
      setEvents(((data ?? []) as EventRow[]).map(toEvent));
    }
    setLoading(false);
  }, [notify]);

  useEffect(() => {
    if (!currentUser) return;
    const timer = window.setTimeout(() => void loadEvents(), 0);
    return () => window.clearTimeout(timer);
  }, [currentUser, loadEvents]);

  const resetForm = () => {
    setForm({ title: "", description: "", date: today(), eventType: "SCHEDULE", visibility: "ALL", isImportant: false });
  };

  const saveEvent = async () => {
    if (!currentUser || !form.title.trim()) {
      notify("일정 제목을 입력해 주세요.", "error");
      return;
    }

    setSaving(true);
    const visibility = form.eventType === "TODO" ? "PRIVATE" : form.visibility;
    const { error } = await createClient().from("calendar_events").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      start_at: `${form.date}T00:00:00+09:00`,
      end_at: `${form.date}T23:59:59.999+09:00`,
      event_type: form.eventType,
      visibility,
      is_important: form.isImportant,
      is_completed: false,
      created_by: currentUser.id,
    });
    setSaving(false);

    if (error) {
      notify("일정을 저장하지 못했습니다. 작성 권한을 확인해 주세요.", "error");
      return;
    }

    notify("일정이 저장되었습니다.", "success");
    setIsModalOpen(false);
    resetForm();
    await loadEvents();
  };

  const toggleTodo = async (event: CalendarEvent) => {
    const completed = !event.isCompleted;
    const { error } = await createClient()
      .from("calendar_events")
      .update({ is_completed: completed, completed_at: completed ? new Date().toISOString() : null })
      .eq("id", event.id);

    if (error) {
      notify("할 일을 수정하지 못했습니다.", "error");
      return;
    }
    await loadEvents();
  };

  const deleteEvent = async (event: CalendarEvent) => {
    if (!window.confirm(`'${event.title}' 일정을 삭제할까요?`)) return;
    const { error } = await createClient().from("calendar_events").delete().eq("id", event.id);
    if (error) {
      notify("일정을 삭제하지 못했습니다. 작성자만 삭제할 수 있습니다.", "error");
      return;
    }
    notify("일정이 삭제되었습니다.", "success");
    await loadEvents();
  };

  return (
    <>
      <PageHeader
        eyebrow="CALENDAR"
        title="일정 관리"
        description="Supabase에 저장된 실제 일정과 개인 할 일입니다."
        actions={<Button onClick={() => setIsModalOpen(true)}><Plus size={16} /> 일정 등록</Button>}
      />

      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <Card className="calendar-card p-5">
          <div className="mb-4 flex items-center gap-2"><CalendarCheck className="text-blue-600" size={20} /><h2 className="text-lg font-bold">전체 일정</h2></div>
          {loading ? <p className="text-sm text-slate-500">일정을 불러오는 중입니다.</p> : events.length === 0 ? (
            <EmptyState title="등록된 일정이 없습니다" description="일정 등록 버튼을 눌러 첫 일정을 추가해 주세요." />
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-4">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <strong>{event.title}</strong>
                      <Badge tone={event.eventType === "TODO" ? "gray" : "blue"}>{event.eventType === "TODO" ? "할 일" : "일정"}</Badge>
                      {event.isImportant && <Badge tone="red">중요</Badge>}
                    </div>
                    <p className="text-sm text-slate-500">{event.startDate}{event.endDate !== event.startDate ? ` ~ ${event.endDate}` : ""}</p>
                    {event.description && <p className="mt-2 text-sm text-slate-600">{event.description}</p>}
                  </div>
                  {event.createdBy === currentUser?.id && (
                    <Button variant="ghost" onClick={() => void deleteEvent(event)} aria-label="일정 삭제"><Trash2 size={16} /></Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-lg font-bold">내 할 일</h2>
          {events.filter((event) => event.eventType === "TODO").length === 0 ? <p className="text-sm text-slate-500">등록된 할 일이 없습니다.</p> : (
            <div className="space-y-2">
              {events.filter((event) => event.eventType === "TODO").map((event) => (
                <button key={event.id} type="button" onClick={() => void toggleTodo(event)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-slate-50">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${event.isCompleted ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>{event.isCompleted && <Check size={13} />}</span>
                  <span className={event.isCompleted ? "text-slate-400 line-through" : "text-slate-700"}>{event.title}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="일정 등록">
        <div className="space-y-4">
          <Field label="제목"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="예: 팀 프로젝트 중간 점검" /></Field>
          <Field label="설명"><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} /></Field>
          <Field label="날짜"><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field>
          <Field label="종류"><select value={form.eventType} onChange={(event) => setForm({ ...form, eventType: event.target.value as EventType })}><option value="SCHEDULE">공용 일정</option><option value="TODO">개인 할 일</option></select></Field>
          {form.eventType === "SCHEDULE" && <Field label="공개 범위"><select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value as Visibility })}><option value="ALL">전체</option><option value="ADMIN">관리자</option><option value="MENTOR">멘토</option><option value="INTERN">인턴</option></select></Field>}
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.isImportant} onChange={(event) => setForm({ ...form, isImportant: event.target.checked })} /> 중요 일정</label>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setIsModalOpen(false)}>취소</Button><Button onClick={() => void saveEvent()} disabled={saving}>{saving ? "저장 중..." : "저장"}</Button></div>
        </div>
      </Modal>
    </>
  );
}
