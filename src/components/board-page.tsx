"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Download, FileArchive, FileSpreadsheet, FileText, Plus, Search, Trash2, UploadCloud } from "lucide-react";
import { formatBytes, uid, type Resource } from "./app-data";
import { useAppStore } from "./app-store";
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader } from "./ui";

export function BoardPage({ category }: { category: Resource["category"] }) {
  const { currentUser, data, setData, notify } = useAppStore();
  const [query, setQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", file: null as File | null });
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  if (!currentUser) return null;
  const user = currentUser;

  const items = data.resources.filter((resource) => resource.category === category && `${resource.title} ${resource.description}`.toLowerCase().includes(query.toLowerCase()));
  const isTemplates = category === "TEMPLATE";

  function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.file) { setError("자료 제목과 파일을 선택해 주세요."); return; }
    if (form.file.size > 25 * 1024 * 1024) { setError("파일 크기는 25MB를 넘을 수 없습니다."); return; }
    setData((previous) => ({ ...previous, resources: [{ id: uid("resource"), category, title: form.title.trim(), description: form.description.trim(), fileName: form.file!.name, fileSize: form.file!.size, uploadedBy: user.id, uploadedAt: "2026-08-13" }, ...previous.resources] }));
    setUploadOpen(false); setForm({ title: "", description: "", file: null }); notify("자료를 업로드했습니다. 데모 모드에서는 메타데이터가 저장됩니다.");
  }
  function download(resource: Resource) {
    const content = `${resource.title}\n\n${resource.description}\n\n데모 모드 파일입니다. Supabase Storage 연결 후 실제 파일이 내려받아집니다.`;
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${resource.fileName}.demo.txt`; anchor.click(); URL.revokeObjectURL(url); notify("데모 파일 다운로드를 시작했습니다.");
  }
  function remove(resource: Resource) {
    const mayDelete = user.role === "ADMIN" || resource.uploadedBy === user.id;
    if (!mayDelete || !window.confirm(`‘${resource.title}’ 자료를 삭제할까요?`)) return;
    setData((previous) => ({ ...previous, resources: previous.resources.filter((item) => item.id !== resource.id) })); notify("자료를 삭제했습니다.", "info");
  }

  return <>
    <PageHeader eyebrow="RESOURCE BOARD" title={isTemplates ? "양식 · 템플릿" : "자료 라이브러리"} description={isTemplates ? "현장실습에 필요한 표준 양식을 내려받습니다." : "이전 기수와 프로젝트 참고 자료를 공유합니다."} actions={<Button onClick={() => setUploadOpen(true)}><Plus size={17} /> 자료 업로드</Button>} />
    <div className="board-tabs"><Link className={isTemplates ? "active" : ""} href="/board/templates">양식 · 템플릿</Link><Link className={!isTemplates ? "active" : ""} href="/board/library">자료 라이브러리</Link></div>
    <Card><div className="toolbar"><div className="search-field"><Search size={18} /><input aria-label="자료 검색" placeholder="자료명이나 설명 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></div><span className="result-count">총 {items.length}개 자료</span></div>
      {items.length ? <div className="resource-grid">{items.map((resource) => {
        const FileIcon = resource.fileName.endsWith(".xlsx") ? FileSpreadsheet : resource.fileName.endsWith(".zip") ? FileArchive : FileText;
        const uploader = data.profiles.find((profile) => profile.id === resource.uploadedBy)?.name ?? "운영자";
        return <article className="resource-card" key={resource.id}><div className="resource-icon"><FileIcon size={25} /></div><div className="resource-copy"><Badge tone={isTemplates ? "blue" : "purple"}>{isTemplates ? "양식" : "참고 자료"}</Badge><h2>{resource.title}</h2><p>{resource.description}</p><div><span>{resource.fileName}</span><span>{formatBytes(resource.fileSize)} · {resource.uploadedAt} · {uploader}</span></div></div><div className="resource-actions"><Button variant="secondary" onClick={() => download(resource)}><Download size={16} /> 다운로드</Button>{user.role === "ADMIN" || resource.uploadedBy === user.id ? <button className="icon-button danger-icon" onClick={() => remove(resource)} aria-label={`${resource.title} 삭제`}><Trash2 size={17} /></button> : null}</div></article>;
      })}</div> : <EmptyState title="등록된 자료가 없습니다." description="팀과 공유할 첫 자료를 업로드해 보세요." action={<Button onClick={() => setUploadOpen(true)}><UploadCloud size={17} /> 업로드</Button>} />}
    </Card>
    <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="자료 업로드" description="모든 역할이 업로드할 수 있으며 업로더 정보가 기록됩니다."><form className="form-stack" onSubmit={upload}><Field label="자료 제목"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="자료 제목" /></Field><Field label="설명"><textarea rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field><Field label="파일" hint="문서, PDF, 이미지, 압축 파일 · 최대 25MB"><div className="file-drop" onClick={() => fileRef.current?.click()}><UploadCloud size={26} /><strong>{form.file?.name ?? "파일을 선택하세요"}</strong><span>{form.file ? formatBytes(form.file.size) : "클릭하여 파일 찾아보기"}</span></div><input className="sr-only" ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.zip" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] ?? null })} /></Field>{error ? <p className="form-error">{error}</p> : null}<div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setUploadOpen(false)}>취소</Button><Button type="submit">업로드</Button></div></form></Modal>
  </>;
}
