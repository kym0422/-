"use client";

import { useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, CircleHelp, Plus, Trash2 } from "lucide-react";
import { uid, type CalendarEvent } from "@/components/app-data";
import { useAppStore } from "@/components/app-store";
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, SectionTitle } from "@/components/ui";

const visibilityLabels: Record<CalendarEvent["visibility"], string> = { ALL: "전체 공개", PRIVATE: "나만 보기", ADMIN: "관리자 전용", MENTOR: "멘토 전용", INTERN: "인턴 전용" };
const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

export default function CalendarPage() {
  const { currentUser, data, setData, notify } = useAppStore();
  const [monthOffset, setMonthOffset] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState({ title: "", description: "", startDate: "2026-08-13", endDate: "2026-08-13", eventType: "SCHEDULE" as CalendarEvent["eventType"], visibility: "ALL" as CalendarEvent["visibility"], isImportant: false });
  const [error, setError] = useState("");
  if (!currentUser) return null;
  const user = currentUser;

  const year = 2026 + Math.floor((7 + monthOffset) / 12);
  const month = ((7 + monthOffset) % 12 + 12) % 12;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => index - firstDay + 1);

  const visibleEvents = data.events.filter((event) => {
    if (event.visibility === "PRIVATE") return event.createdBy === user.id;
    return event.visibility === "ALL" || event.visibility === user.role || event.createdBy === user.id;
  });
  const upcoming = visibleEvents.filter((event) => event.eventType === "SCHEDULE" && event.startDate >= "2026-08-13").sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 5);
  const todos = visibleEvents.filter((event) => event.eventType === "TODO" && !event.isCompleted).sort((a, b) => a.startDate.localeCompare(b.startDate));

  function openCreate(date = "2026-08-13") {
    setForm({ title: "", description: "", startDate: date, endDate: date, eventType: "SCHEDULE", visibility: "ALL", isImportant: false }); setError(""); setFormOpen(true);
  }
  function saveEvent(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.startDate || !form.endDate) { setError("일정명과 날짜를 모두 입력해 주세요."); return; }
    if (form.endDate < form.startDate) { setError("종료일은 시작일보다 빠를 수 없습니다."); return; }
    const normalized = form.eventType === "TODO" ? { ...form, visibility: "PRIVATE" as const } : form;
    setData((previous) => ({ ...previous, events: [...previous.events, { id: uid("event"), ...normalized, isCompleted: false, createdBy: user.id }] }));
    setFormOpen(false); notify(form.eventType === "TODO" ? "비공개 To-do를 등록했습니다." : "일정을 등록했습니다.");
  }
  function deleteEvent(item: CalendarEvent) {
    if (item.createdBy !== user.id) return;
    if (!window.confirm(`‘${item.title}’ 일정을 삭제할까요?`)) return;
    setData((previous) => ({ ...previous, events: previous.events.filter((event) => event.id !== item.id) })); setSelected(null); notify("일정을 삭제했습니다.", "info");
  }
  function toggleTodo(item: CalendarEvent) {
    setData((previous) => ({ ...previous, events: previous.events.map((event) => event.id === item.id ? { ...event, isCompleted: !event.isCompleted } : event) }));
  }

  return (
    <>
      <PageHeader eyebrow="SCHEDULE" title="공유 캘린더" description="공개 일정과 개인 To-do를 한눈에 확인합니다." actions={<><Button variant="secondary" onClick={() => setHelpOpen(true)}><CircleHelp size={17} /> 사용 방법</Button><Button onClick={() => openCreate()}><Plus size={17} /> 일정 추가</Button></>} />
      <Card className="calendar-card">
        <div className="calendar-toolbar"><button className="icon-button" onClick={() => setMonthOffset((value) => value - 1)} aria-label="이전 달"><ChevronLeft /></button><h2>{year}년 {month + 1}월</h2><button className="icon-button" onClick={() => setMonthOffset((value) => value + 1)} aria-label="다음 달"><ChevronRight /></button><button className="today-button" onClick={() => setMonthOffset(0)}>오늘</button><div className="calendar-legend"><span><i className="dot important" /> 중요</span><span><i className="dot schedule" /> 일정</span><span><i className="dot todo" /> To-do</span></div></div>
        <div className="calendar-grid">{weekDays.map((day) => <div key={day} className="calendar-weekday">{day}</div>)}{cells.map((day, index) => {
          const date = day > 0 && day <= daysInMonth ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
          const events = date ? visibleEvents.filter((event) => event.startDate <= date && event.endDate >= date) : [];
          return <div key={index} className={`calendar-cell ${!date ? "muted" : ""} ${date === "2026-08-13" ? "today" : ""}`} onDoubleClick={() => date && openCreate(date)}>{date ? <><button className="day-number" onClick={() => openCreate(date)}>{day}</button><div className="day-events">{events.slice(0, 3).map((item) => <button key={item.id} className={`event-chip ${item.eventType.toLowerCase()} ${item.isImportant ? "important" : ""}`} onClick={() => setSelected(item)}>{item.title}</button>)}{events.length > 3 ? <span className="more-events">+{events.length - 3}개 더보기</span> : null}</div></> : null}</div>;
        })}</div>
      </Card>

      <div className="dashboard-columns calendar-summary">
        <Card><SectionTitle title="다가오는 일정" description="내게 공개된 가까운 일정입니다." />{upcoming.length ? <div className="timeline-list">{upcoming.map((item) => <button key={item.id} onClick={() => setSelected(item)}><time>{item.startDate.slice(5).replace("-", ".")}</time><span><strong>{item.title}</strong><small>{item.description}</small></span>{item.isImportant ? <Badge tone="red">중요</Badge> : null}</button>)}</div> : <EmptyState title="다가오는 일정이 없습니다." description="새 일정을 등록해 보세요." />}</Card>
        <Card><SectionTitle title="다가오는 To-do" description="본인만 볼 수 있는 개인 할 일입니다." />{todos.length ? <div className="todo-list">{todos.map((item) => <button key={item.id} onClick={() => toggleTodo(item)} className={item.isCompleted ? "completed" : ""}><span className="todo-check">✓</span><span><strong>{item.title}</strong><small>{item.startDate}</small></span></button>)}</div> : <EmptyState title="남은 To-do가 없습니다." description="개인 할 일을 추가해 보세요." />}</Card>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="새 일정 추가" description="To-do는 자동으로 나만 보기로 저장됩니다."><form className="form-stack" onSubmit={saveEvent}><div className="segmented"><button type="button" className={form.eventType === "SCHEDULE" ? "active" : ""} onClick={() => setForm({ ...form, eventType: "SCHEDULE" })}>일정</button><button type="button" className={form.eventType === "TODO" ? "active" : ""} onClick={() => setForm({ ...form, eventType: "TODO", visibility: "PRIVATE" })}>To-do</button></div><Field label="일정명"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="일정명을 입력하세요." /></Field><Field label="설명"><textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field><div className="form-grid"><Field label="시작일"><input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></Field><Field label="종료일"><input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></Field></div><Field label="공개 범위"><select disabled={form.eventType === "TODO"} value={form.eventType === "TODO" ? "PRIVATE" : form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value as CalendarEvent["visibility"] })}>{Object.entries(visibilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><label className="check-row"><input type="checkbox" checked={form.isImportant} onChange={(event) => setForm({ ...form, isImportant: event.target.checked })} /><span><strong>중요 일정으로 표시</strong><small>캘린더에서 붉은 색으로 강조됩니다.</small></span></label>{error ? <p className="form-error">{error}</p> : null}<div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>취소</Button><Button type="submit">저장</Button></div></form></Modal>
      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title ?? "일정 상세"}>{selected ? <div className="event-detail"><div className="detail-badges"><Badge tone={selected.eventType === "TODO" ? "amber" : "blue"}>{selected.eventType === "TODO" ? "To-do" : "일정"}</Badge>{selected.isImportant ? <Badge tone="red">중요</Badge> : null}</div><dl><dt>기간</dt><dd>{selected.startDate} ~ {selected.endDate}</dd><dt>공개 범위</dt><dd>{visibilityLabels[selected.visibility]}</dd><dt>설명</dt><dd>{selected.description || "등록된 설명이 없습니다."}</dd></dl>{selected.createdBy === user.id ? <div className="modal-actions"><Button variant="danger" onClick={() => deleteEvent(selected)}><Trash2 size={16} /> 삭제</Button></div> : <p className="read-only-note">다른 사용자가 등록한 공개 일정은 조회만 가능합니다.</p>}</div> : null}</Modal>
      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="캘린더 사용 방법"><div className="help-list"><p><CalendarCheck size={20} /><span><strong>공개 일정</strong>역할과 공개 범위가 맞는 구성원에게 표시됩니다.</span></p><p><CalendarCheck size={20} /><span><strong>개인 To-do</strong>작성자 본인에게만 표시되며 완료 처리할 수 있습니다.</span></p><p><CalendarCheck size={20} /><span><strong>수정과 삭제</strong>본인이 등록한 일정에만 허용됩니다.</span></p></div></Modal>
    </>
  );
}
