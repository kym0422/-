"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileArchive, FileSpreadsheet, FileText, Plus, Search, Trash2, UploadCloud } from "lucide-react";
import { formatBytes, type Resource } from "./app-data";
import { useAppStore } from "./app-store";
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader } from "./ui";
import { createClient } from "@/lib/supabase/client";

type ResourceRow = {
  id: string;
  resource_type: Resource["category"];
  title: string;
  description: string | null;
  original_file_name: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  uploaded_by: string;
  uploader_display_name: string;
  created_at: string;
};

const bucket = "board-resources";
const fileTypes: Record<string, string> = {
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", zip: "application/zip",
};

function extension(fileName: string) { return fileName.split(".").pop()?.toLowerCase() ?? ""; }
function safeFileName(fileName: string) { return fileName.replace(/[^a-zA-Z0-9._-]/g, "_"); }
function displayDate(value: string) { return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }

export function BoardPage({ category }: { category: Resource["category"] }) {
  const { currentUser, notify } = useAppStore();
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", file: null as File | null });
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const isTemplates = category === "TEMPLATE";

  const loadResources = useCallback(async () => {
    const { data, error: queryError } = await createClient()
      .from("board_resources")
      .select("id,resource_type,title,description,original_file_name,storage_path,mime_type,file_size_bytes,uploaded_by,uploader_display_name,created_at")
      .eq("resource_type", category)
      .order("created_at", { ascending: false });
    if (queryError) notify("자료 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
    else setResources((data ?? []) as ResourceRow[]);
    setLoading(false);
  }, [category, notify]);

  useEffect(() => {
    if (!currentUser) return;
    const timer = window.setTimeout(() => void loadResources(), 0);
    return () => window.clearTimeout(timer);
  }, [currentUser, loadResources]);

  if (!currentUser) return null;
  const user = currentUser;
  const items = resources.filter((resource) => `${resource.title} ${resource.description ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    const file = form.file;
    if (!form.title.trim() || !file) { setError("자료 제목과 파일을 선택해 주세요."); return; }
    if (file.size > 25 * 1024 * 1024) { setError("파일 크기는 25MB를 넘을 수 없습니다."); return; }
    const mimeType = fileTypes[extension(file.name)];
    if (!mimeType) { setError("지원하지 않는 파일 형식입니다."); return; }

    setUploading(true); setError("");
    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) { setUploading(false); setError("로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요."); return; }

    const id = crypto.randomUUID();
    const path = `${authData.user.id}/${id}/${safeFileName(file.name)}`;
    const { error: recordError } = await supabase.from("board_resources").insert({
      id, resource_type: category, title: form.title.trim(), description: form.description.trim() || null,
      original_file_name: file.name, storage_bucket: bucket, storage_path: path, mime_type: mimeType,
      file_size_bytes: file.size, uploaded_by: user.id, uploader_display_name: user.name,
    });
    if (recordError) { setUploading(false); setError("자료 정보를 저장하지 못했습니다. 작성 권한을 확인해 주세요."); return; }

    const { error: storageError } = await supabase.storage.from(bucket).upload(path, file, { contentType: mimeType, upsert: false });
    if (storageError) {
      await supabase.from("board_resources").delete().eq("id", id);
      setUploading(false); setError("파일을 업로드하지 못했습니다. 잠시 후 다시 시도해 주세요."); return;
    }

    setUploading(false); setUploadOpen(false); setForm({ title: "", description: "", file: null });
    notify("자료와 파일을 업로드했습니다.", "success");
    await loadResources();
  }

  async function download(resource: ResourceRow) {
    const { data, error: downloadError } = await createClient().storage.from(bucket).download(resource.storage_path);
    if (downloadError || !data) { notify("파일을 다운로드하지 못했습니다.", "error"); return; }
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = resource.original_file_name; anchor.click();
    URL.revokeObjectURL(url);
  }

  async function remove(resource: ResourceRow) {
    const mayDelete = user.role === "ADMIN" || resource.uploaded_by === user.id;
    if (!mayDelete || !window.confirm(`‘${resource.title}’ 자료를 삭제할까요?`)) return;
    const supabase = createClient();
    const { error: storageError } = await supabase.storage.from(bucket).remove([resource.storage_path]);
    if (storageError) { notify("파일을 삭제하지 못했습니다.", "error"); return; }
    const { error: recordError } = await supabase.from("board_resources").delete().eq("id", resource.id);
    if (recordError) { notify("자료 정보를 삭제하지 못했습니다. 관리자에게 문의해 주세요.", "error"); return; }
    notify("자료가 삭제되었습니다.", "success"); await loadResources();
  }

  return <>
    <PageHeader eyebrow="RESOURCE BOARD" title={isTemplates ? "양식 및 템플릿" : "자료 라이브러리"} description={isTemplates ? "실습에 필요한 양식을 내려받습니다." : "이전 기수와 프로젝트 참고 자료를 공유합니다."} actions={<Button onClick={() => setUploadOpen(true)}><Plus size={17} /> 자료 업로드</Button>} />
    <div className="board-tabs"><Link className={isTemplates ? "active" : ""} href="/board/templates">양식 및 템플릿</Link><Link className={!isTemplates ? "active" : ""} href="/board/library">자료 라이브러리</Link></div>
    <Card><div className="toolbar"><div className="search-field"><Search size={18} /><input aria-label="자료 검색" placeholder="자료명이나 설명 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></div><span className="result-count">총 {items.length}개 자료</span></div>
      {loading ? <p className="p-5 text-sm text-slate-500">자료를 불러오는 중입니다.</p> : items.length ? <div className="resource-grid">{items.map((resource) => {
        const FileIcon = ["xlsx", "xls"].includes(extension(resource.original_file_name)) ? FileSpreadsheet : extension(resource.original_file_name) === "zip" ? FileArchive : FileText;
        return <article className="resource-card" key={resource.id}><div className="resource-icon"><FileIcon size={25} /></div><div className="resource-copy"><Badge tone={isTemplates ? "blue" : "purple"}>{isTemplates ? "양식" : "참고 자료"}</Badge><h2>{resource.title}</h2><p>{resource.description}</p><div><span>{resource.original_file_name}</span><span>{formatBytes(resource.file_size_bytes)} · {displayDate(resource.created_at)} · {resource.uploader_display_name}</span></div></div><div className="resource-actions"><Button variant="secondary" onClick={() => void download(resource)}><Download size={16} /> 다운로드</Button>{user.role === "ADMIN" || resource.uploaded_by === user.id ? <button className="icon-button danger-icon" onClick={() => void remove(resource)} aria-label={`${resource.title} 삭제`}><Trash2 size={17} /></button> : null}</div></article>;
      })}</div> : <EmptyState title="등록된 자료가 없습니다." description="모두와 공유할 첫 자료를 업로드해 보세요." action={<Button onClick={() => setUploadOpen(true)}><UploadCloud size={17} /> 업로드</Button>} />}
    </Card>
    <Modal open={uploadOpen} onClose={() => !uploading && setUploadOpen(false)} title="자료 업로드" description="파일과 자료 정보가 함께 저장됩니다."><form className="form-stack" onSubmit={(event) => void upload(event)}><Field label="자료 제목"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="자료 제목" /></Field><Field label="설명"><textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field><Field label="파일" hint="문서, PDF, 이미지, 압축 파일 · 최대 25MB"><div className="file-drop" onClick={() => fileRef.current?.click()}><UploadCloud size={26} /><strong>{form.file?.name ?? "파일을 선택하세요"}</strong><span>{form.file ? formatBytes(form.file.size) : "클릭하여 파일 찾아보기"}</span></div><input className="sr-only" ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.zip" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] ?? null })} /></Field>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><Button type="button" variant="secondary" disabled={uploading} onClick={() => setUploadOpen(false)}>취소</Button><Button type="submit" disabled={uploading}>{uploading ? "업로드 중..." : "업로드"}</Button></div></form></Modal>
  </>;
}
