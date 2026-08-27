"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, Plus, Save, Trash2, UploadCloud } from "lucide-react";
import { type Role } from "./app-data";
import { useAppStore } from "./app-store";
import { Avatar, Badge, Button, Card, EmptyState, Field, PageHeader, ProgressBar, SectionTitle } from "./ui";
import { exportExcelFile } from "@/lib/export-excel";
import { createClient } from "@/lib/supabase/client";

type ProjectType = "PERSONAL_PROJECT" | "TEAM_PROJECT" | "OTHER";

type ReportRow = {
  id: string;
  intern_id: string;
  cohort_id: string;
  project_type: ProjectType;
  project_type_custom: string | null;
  project_name: string | null;
  week_number: number;
  created_at: string;
  updated_at: string;
};

type ReportItemRow = {
  id: string;
  weekly_report_id: string;
  sort_order: number;
  description: string;
  progress: number;
  weekly_feedback: string | null;
};

type AttachmentRow = {
  id: string;
  weekly_report_item_id: string;
  original_file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  uploaded_by: string;
  created_at: string;
};

type ReportAttachment = {
  id: string;
  itemId: string;
  originalFileName: string;
  storageBucket: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedBy: string;
  createdAt: string;
};

type ReportItem = {
  id: string;
  reportId: string;
  sortOrder: number;
  description: string;
  progress: number;
  weeklyFeedback: string;
  attachments: ReportAttachment[];
  pendingAttachment?: File;
};

type WeeklyReportRecord = {
  id: string;
  internId: string;
  cohortId: string;
  projectType: ProjectType;
  projectTypeCustom: string | null;
  projectName: string | null;
  weekNumber: number;
  createdAt: string;
  updatedAt: string;
  items: ReportItem[];
};

const attachmentBucket = "weekly-report-attachments";
const projectTypeLabels: Record<ProjectType, string> = {
  PERSONAL_PROJECT: "개인 프로젝트",
  TEAM_PROJECT: "팀 프로젝트",
  OTHER: "기타",
};
const fileTypes: Record<string, string> = {
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

function mapAttachment(row: AttachmentRow): ReportAttachment {
  return {
    id: row.id,
    itemId: row.weekly_report_item_id,
    originalFileName: row.original_file_name,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

function extension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function getMimeType(file: File) {
  const mimeType = fileTypes[extension(file.name)] ?? file.type;
  return Object.values(fileTypes).includes(mimeType) ? mimeType : "";
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function displayDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function reportProjectTypeLabel(report: Pick<WeeklyReportRecord, "projectType" | "projectTypeCustom">) {
  return report.projectType === "OTHER" ? report.projectTypeCustom || projectTypeLabels.OTHER : projectTypeLabels[report.projectType];
}

function copyItem(item: ReportItem): ReportItem {
  return { ...item, attachments: [...item.attachments] };
}

export function WeeklyReportsPage({ mode }: { mode: Role }) {
  const { currentUser, data, notify } = useAppStore();
  const [reports, setReports] = useState<WeeklyReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedInternId, setSelectedInternId] = useState("");
  const [week, setWeek] = useState(1);
  const [projectType, setProjectType] = useState<ProjectType>("PERSONAL_PROJECT");
  const [customProjectType, setCustomProjectType] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<ReportItem[] | null>(null);
  const [attachmentTargetId, setAttachmentTargetId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: reportData, error: reportError } = await supabase
      .from("weekly_reports")
      .select("id,intern_id,cohort_id,project_type,project_type_custom,project_name,week_number,created_at,updated_at")
      .order("week_number", { ascending: true })
      .order("updated_at", { ascending: false });
    if (reportError) {
      setReports([]);
      setLoading(false);
      notify("주간 업무보고를 불러오지 못했습니다. Supabase 연결과 권한을 확인해 주세요.", "error");
      return;
    }

    const reportRows = (reportData ?? []) as ReportRow[];
    if (!reportRows.length) {
      setReports([]);
      setLoading(false);
      return;
    }

    const reportIds = reportRows.map((report) => report.id);
    const { data: itemData, error: itemError } = await supabase
      .from("weekly_report_items")
      .select("id,weekly_report_id,sort_order,description,progress,weekly_feedback")
      .in("weekly_report_id", reportIds)
      .order("sort_order", { ascending: true });
    if (itemError) {
      setReports([]);
      setLoading(false);
      notify("주간 업무 항목을 불러오지 못했습니다.", "error");
      return;
    }

    const itemRows = (itemData ?? []) as ReportItemRow[];
    const itemIds = itemRows.map((item) => item.id);
    let attachmentRows: AttachmentRow[] = [];
    if (itemIds.length) {
      const { data: attachmentData, error: attachmentError } = await supabase
        .from("weekly_report_attachments")
        .select("id,weekly_report_item_id,original_file_name,storage_bucket,storage_path,mime_type,file_size_bytes,uploaded_by,created_at")
        .in("weekly_report_item_id", itemIds)
        .order("created_at", { ascending: true });
      if (attachmentError) {
        setReports([]);
        setLoading(false);
        notify("보고서 첨부 파일 목록을 불러오지 못했습니다.", "error");
        return;
      }
      attachmentRows = (attachmentData ?? []) as AttachmentRow[];
    }

    const attachmentsByItem = new Map<string, ReportAttachment[]>();
    for (const attachment of attachmentRows.map(mapAttachment)) {
      const existing = attachmentsByItem.get(attachment.itemId) ?? [];
      existing.push(attachment);
      attachmentsByItem.set(attachment.itemId, existing);
    }
    const itemsByReport = new Map<string, ReportItem[]>();
    for (const item of itemRows) {
      const existing = itemsByReport.get(item.weekly_report_id) ?? [];
      existing.push({
        id: item.id,
        reportId: item.weekly_report_id,
        sortOrder: item.sort_order,
        description: item.description,
        progress: item.progress,
        weeklyFeedback: item.weekly_feedback ?? "",
        attachments: attachmentsByItem.get(item.id) ?? [],
      });
      itemsByReport.set(item.weekly_report_id, existing);
    }

    setReports(reportRows.map((report) => ({
      id: report.id,
      internId: report.intern_id,
      cohortId: report.cohort_id,
      projectType: report.project_type,
      projectTypeCustom: report.project_type_custom,
      projectName: report.project_name,
      weekNumber: report.week_number,
      createdAt: report.created_at,
      updatedAt: report.updated_at,
      items: (itemsByReport.get(report.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    })));
    setLoading(false);
  }, [notify]);

  useEffect(() => {
    if (!currentUser) return;
    const timer = window.setTimeout(() => void loadReports(), 0);
    return () => window.clearTimeout(timer);
  }, [currentUser, loadReports]);

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
  const totalWeeks = data.cohorts.find((cohort) => cohort.id === activeIntern?.cohortId)?.totalWeeks ?? 8;
  const report = reports.find((item) => item.internId === activeInternId && item.weekNumber === week && item.projectType === projectType);
  const items = mode === "INTERN" ? draftItems ?? (report?.items.map(copyItem) ?? []) : report?.items ?? [];
  const allReports = reports.filter((item) => item.internId === activeInternId);
  const totals = { weeks: new Set(allReports.map((item) => item.weekNumber)).size, items: allReports.reduce((sum, item) => sum + item.items.length, 0) };
  const effectiveCustomProjectType = projectType === "OTHER" ? customProjectType ?? report?.projectTypeCustom ?? "" : "";

  function chooseContext(nextInternId: string, nextWeek = week, nextType = projectType) {
    setSelectedInternId(nextInternId);
    setWeek(nextWeek);
    setProjectType(nextType);
    setCustomProjectType(null);
    setDraftItems(null);
  }

  function updateItem(id: string, patch: Partial<ReportItem>) {
    const base = draftItems ?? (report?.items.map(copyItem) ?? []);
    setDraftItems(base.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function addItem() {
    const base = draftItems ?? (report?.items.map(copyItem) ?? []);
    const draftId = crypto.randomUUID();
    setDraftItems([...base, { id: draftId, reportId: report?.id ?? "", sortOrder: base.length, description: "", progress: 0, weeklyFeedback: "", attachments: [] }]);
  }

  function removeItem(id: string) {
    if (!window.confirm("이 업무 항목을 삭제할까요?")) return;
    const base = draftItems ?? (report?.items.map(copyItem) ?? []);
    setDraftItems(base.filter((item) => item.id !== id));
  }

  function attachFile(id: string, file: File | undefined) {
    if (!file) return;
    if (!file.size) {
      notify("빈 파일은 첨부할 수 없습니다.", "error");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      notify("첨부 파일은 25MB를 넘을 수 없습니다.", "error");
      return;
    }
    if (!getMimeType(file)) {
      notify("지원하지 않는 파일 형식입니다.", "error");
      return;
    }
    updateItem(id, { pendingAttachment: file });
  }

  async function deleteAttachments(attachments: ReportAttachment[]) {
    if (!attachments.length) return;
    const supabase = createClient();
    const paths = attachments.map((attachment) => attachment.storagePath);
    const { error: storageError } = await supabase.storage.from(attachmentBucket).remove(paths);
    if (storageError) throw new Error("첨부 파일을 저장소에서 삭제하지 못했습니다.");
    const { error: metadataError } = await supabase.from("weekly_report_attachments").delete().in("id", attachments.map((attachment) => attachment.id));
    if (metadataError) throw new Error("첨부 파일 정보를 삭제하지 못했습니다.");
  }

  async function uploadAttachment(itemId: string, file: File, authUserId: string) {
    const mimeType = getMimeType(file);
    if (!mimeType) throw new Error("지원하지 않는 파일 형식입니다.");
    const attachmentId = crypto.randomUUID();
    const path = authUserId + "/" + itemId + "/" + attachmentId + "-" + safeFileName(file.name);
    const supabase = createClient();
    const { error: metadataError } = await supabase.from("weekly_report_attachments").insert({
      id: attachmentId,
      weekly_report_item_id: itemId,
      original_file_name: file.name,
      storage_bucket: attachmentBucket,
      storage_path: path,
      mime_type: mimeType,
      file_size_bytes: file.size,
      uploaded_by: user.id,
    });
    if (metadataError) throw new Error("첨부 파일 정보를 저장하지 못했습니다.");

    const { error: storageError } = await supabase.storage.from(attachmentBucket).upload(path, file, { contentType: mimeType, upsert: false });
    if (storageError) {
      await supabase.from("weekly_report_attachments").delete().eq("id", attachmentId);
      throw new Error("첨부 파일을 업로드하지 못했습니다.");
    }
  }

  async function saveReport() {
    if (mode !== "INTERN" || saving) return;
    if (!items.length) {
      notify("저장할 업무 항목을 먼저 추가해 주세요.", "error");
      return;
    }
    if (items.some((item) => !item.description.trim() || !Number.isFinite(item.progress) || item.progress < 0 || item.progress > 100)) {
      notify("업무 내용과 0~100 범위의 진행률을 확인해 주세요.", "error");
      return;
    }
    if (!activeIntern?.cohortId) {
      notify("인턴의 기수 정보를 찾지 못했습니다.", "error");
      return;
    }
    if (projectType === "OTHER" && !effectiveCustomProjectType.trim()) {
      notify("기타 과제 유형을 입력해 주세요.", "error");
      return;
    }

    let persistedChanges = false;
    setSaving(true);
    try {
      const supabase = createClient();
      let reportId = report?.id;
      const reportPayload = {
        project_type_custom: projectType === "OTHER" ? effectiveCustomProjectType.trim() : null,
        project_name: null,
      };

      if (reportId) {
        const { error: updateError } = await supabase.from("weekly_reports").update(reportPayload).eq("id", reportId);
        if (updateError) throw new Error("주간 업무보고를 수정하지 못했습니다.");
        persistedChanges = true;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("weekly_reports")
          .insert({ intern_id: user.id, cohort_id: activeIntern.cohortId, project_type: projectType, ...reportPayload, week_number: week })
          .select("id")
          .single();
        const insertedReport = inserted as { id: string } | null;
        if (insertError || !insertedReport) throw new Error("주간 업무보고를 생성하지 못했습니다.");
        reportId = insertedReport.id;
        persistedChanges = true;
      }

      const existingItems = new Map((report?.items ?? []).map((item) => [item.id, item]));
      const draftIds = new Set(items.map((item) => item.id));
      const removedItems = (report?.items ?? []).filter((item) => !draftIds.has(item.id));
      if (removedItems.length) {
        await deleteAttachments(removedItems.flatMap((item) => item.attachments));
        const { error: deleteError } = await supabase.from("weekly_report_items").delete().in("id", removedItems.map((item) => item.id));
        if (deleteError) throw new Error("삭제한 업무 항목을 저장하지 못했습니다.");
        persistedChanges = true;
      }

      const retainedItems = items.filter((item) => existingItems.has(item.id));
      const temporaryBase = Math.max(0, items.length, ...(report?.items.map((item) => item.sortOrder) ?? [])) + items.length + 1;
      for (const [index, item] of retainedItems.entries()) {
        const { error: updateError } = await supabase
          .from("weekly_report_items")
          .update({ description: item.description.trim(), progress: item.progress, weekly_feedback: item.weeklyFeedback.trim() || null, sort_order: temporaryBase + index })
          .eq("id", item.id);
        if (updateError) throw new Error("업무 항목을 수정하지 못했습니다.");
        persistedChanges = true;
      }

      const persistedItemIds = new Map<string, string>();
      for (const [index, item] of items.entries()) {
        if (existingItems.has(item.id)) {
          persistedItemIds.set(item.id, item.id);
          continue;
        }
        const { data: inserted, error: insertError } = await supabase
          .from("weekly_report_items")
          .insert({ weekly_report_id: reportId, sort_order: index, description: item.description.trim(), progress: item.progress, weekly_feedback: item.weeklyFeedback.trim() || null })
          .select("id")
          .single();
        const insertedItem = inserted as { id: string } | null;
        if (insertError || !insertedItem) throw new Error("업무 항목을 추가하지 못했습니다.");
        persistedItemIds.set(item.id, insertedItem.id);
        persistedChanges = true;
      }

      for (const item of retainedItems) {
        const finalSortOrder = items.findIndex((candidate) => candidate.id === item.id);
        const { error: orderError } = await supabase.from("weekly_report_items").update({ sort_order: finalSortOrder }).eq("id", item.id);
        if (orderError) throw new Error("업무 항목 순서를 저장하지 못했습니다.");
        persistedChanges = true;
      }

      const pendingItems = items.filter((item) => item.pendingAttachment);
      if (pendingItems.length) {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) throw new Error("로그인 정보를 확인하지 못했습니다.");
        for (const item of pendingItems) {
          const persistedItemId = persistedItemIds.get(item.id) ?? item.id;
          await uploadAttachment(persistedItemId, item.pendingAttachment as File, authData.user.id);
          persistedChanges = true;
        }
      }

      setDraftItems(null);
      notify(week + "주차 업무 기록을 저장했습니다.");
      await loadReports();
    } catch (saveError) {
      if (persistedChanges) {
        setDraftItems(null);
        await loadReports();
        notify("저장 중 오류가 발생했습니다. 저장된 내용 기준으로 다시 불러왔습니다.", "error");
      } else {
        notify(saveError instanceof Error ? saveError.message : "주간 업무보고를 저장하지 못했습니다.", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function downloadAttachment(attachment: ReportAttachment) {
    const { data: file, error: downloadError } = await createClient().storage.from(attachment.storageBucket).download(attachment.storagePath);
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

  async function exportExcel() {
    const rows = allReports.flatMap((item) => item.items.map((entry, index) => [item.weekNumber, reportProjectTypeLabel(item), index + 1, entry.description, entry.progress, entry.attachments.map((attachment) => attachment.originalFileName).join(", "), entry.weeklyFeedback, displayDateTime(item.updatedAt)]));
    await exportExcelFile({
      fileName: (activeIntern?.name ?? "인턴") + "_주간업무보고.xlsx",
      sheetName: "주간 업무보고",
      headers: ["주차", "과제 유형", "번호", "주간 작업 항목", "진행률(%)", "첨부 파일", "주간 피드백", "수정일"],
      rows,
      widths: [8, 16, 8, 42, 12, 24, 42, 20],
    });
    notify("Excel 파일을 생성했습니다.");
  }

  return <>
    <PageHeader eyebrow="WEEKLY REPORT" title="주간 업무보고" description={mode === "INTERN" ? "이번 주 업무와 진행률을 기록하고 저장하세요." : mode === "MENTOR" ? "담당 인턴의 주간 업무 기록을 읽기 전용으로 확인합니다." : "기수별 인턴의 주간 업무 기록을 읽기 전용으로 확인합니다."} actions={<Button variant="secondary" onClick={exportExcel} disabled={!activeInternId}><Download size={17} /> 전체 주차 Excel</Button>} />
    {mode !== "INTERN" ? <Card className="selector-card"><SectionTitle title="인턴 선택" description={mode === "MENTOR" ? "본인에게 배정된 인턴만 표시합니다." : "현재 기수의 전체 인턴입니다."} /><div className="intern-selector">{interns.map((intern) => <button key={intern.id} className={activeInternId === intern.id ? "active" : ""} onClick={() => chooseContext(intern.id)}><Avatar name={intern.name} /><span><strong>{intern.name}</strong><small>{intern.department}</small><em>{intern.projectGroup}</em></span></button>)}</div></Card> : null}
    <Card>
      <div className="report-context"><div>{activeIntern ? <><Avatar name={activeIntern.name} size="large" /><span><small>{mode === "INTERN" ? "작성자" : "선택한 인턴"}</small><strong>{activeIntern.name}</strong><em>{activeIntern.department} · {activeIntern.projectGroup}</em></span></> : null}</div><div className="context-stats"><span><small>작성 주차</small><strong>{totals.weeks}</strong></span><span><small>전체 항목</small><strong>{totals.items}</strong></span></div></div>
      <div className="report-filters"><Field label="과제 유형"><select value={projectType} onChange={(event) => chooseContext(activeInternId, week, event.target.value as ProjectType)}>{Object.entries(projectTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="주차"><select value={week} onChange={(event) => chooseContext(activeInternId, Number(event.target.value), projectType)}>{Array.from({ length: totalWeeks }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}주차</option>)}</select></Field><div className="read-mode-badge">{mode === "INTERN" ? <Badge tone="green">작성 가능</Badge> : <Badge tone="gray">읽기 전용</Badge>}</div></div>
      {projectType === "OTHER" && mode === "INTERN" ? <Field label="기타 과제 유형"><input value={effectiveCustomProjectType} onChange={(event) => setCustomProjectType(event.target.value)} /></Field> : null}
      {loading ? <p className="p-5 text-sm text-slate-500">주간 업무보고를 불러오는 중입니다.</p> : items.length ? <div className="report-table-wrap"><table className="data-table report-table"><thead><tr><th>#</th><th>주간 작업 항목</th><th>진행률</th><th>첨부 파일</th><th>주간 피드백</th>{mode === "INTERN" ? <th>삭제</th> : null}</tr></thead><tbody>{items.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td>{mode === "INTERN" ? <textarea value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} aria-label={(index + 1) + "번 작업 항목"} rows={3} /> : <strong>{item.description}</strong>}</td><td>{mode === "INTERN" ? <div className="progress-editor"><input type="number" min={0} max={100} value={item.progress} onChange={(event) => updateItem(item.id, { progress: Number(event.target.value) })} /><span>%</span></div> : <div className="table-progress"><strong>{item.progress}%</strong><ProgressBar value={item.progress} /></div>}</td><td>{mode === "INTERN" ? <div><button type="button" className="file-button" onClick={() => { setAttachmentTargetId(item.id); fileRef.current?.click(); }}><UploadCloud size={16} /> {item.pendingAttachment?.name ?? "파일 선택"}</button>{item.attachments.length ? <div>{item.attachments.map((attachment) => <button type="button" className="file-button" key={attachment.id} onClick={() => void downloadAttachment(attachment)}><FileText size={15} /> {attachment.originalFileName}</button>)}</div> : null}</div> : item.attachments.length ? <div>{item.attachments.map((attachment) => <button type="button" className="file-button" key={attachment.id} onClick={() => void downloadAttachment(attachment)}><FileText size={15} /> {attachment.originalFileName}</button>)}</div> : "-"}</td><td>{mode === "INTERN" ? <textarea value={item.weeklyFeedback} onChange={(event) => updateItem(item.id, { weeklyFeedback: event.target.value })} aria-label={(index + 1) + "번 주간 피드백"} rows={3} /> : item.weeklyFeedback || "-"}</td>{mode === "INTERN" ? <td><button type="button" className="icon-button danger-icon" onClick={() => removeItem(item.id)} aria-label={(index + 1) + "번 항목 삭제"}><Trash2 size={17} /></button></td> : null}</tr>)}</tbody></table></div> : <EmptyState title="아직 등록된 주간 업무 기록이 없습니다." description={mode === "INTERN" ? "작업 추가 버튼을 눌러 이번 주 기록을 시작하세요." : "선택한 조건에 해당하는 기록이 없습니다."} action={mode === "INTERN" ? <Button onClick={addItem}><Plus size={17} /> 작업 추가</Button> : undefined} />}
      {mode === "INTERN" ? <div className="report-bottom-actions"><Button variant="secondary" onClick={addItem} disabled={saving}><Plus size={17} /> 작업 추가</Button><Button onClick={() => void saveReport()} disabled={saving}><Save size={17} /> {saving ? "저장 중..." : "주간 기록 저장"}</Button></div> : null}
      <input ref={fileRef} className="sr-only" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.zip" onChange={(event) => { if (attachmentTargetId) attachFile(attachmentTargetId, event.target.files?.[0]); event.target.value = ""; }} />
    </Card>
  </>;
}
