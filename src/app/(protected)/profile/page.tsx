"use client";

import { useState } from "react";
import { KeyRound, Save, ShieldCheck, UserRound } from "lucide-react";
import { roleLabels } from "@/components/app-data";
import { useAppStore } from "@/components/app-store";
import { Avatar, Badge, Button, Card, Field, PageHeader, SectionTitle } from "@/components/ui";

export default function ProfilePage() {
  const { currentUser, data, setData, notify } = useAppStore();
  const [name, setName] = useState(currentUser?.name ?? "");
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  if (!currentUser) return null;
  const user = currentUser;
  const cohort = data.cohorts.find((item) => item.id === user.cohortId);
  function saveProfile(event: React.FormEvent) { event.preventDefault(); if (!name.trim()) { notify("이름을 입력해 주세요.", "error"); return; } setData((previous) => ({ ...previous, profiles: previous.profiles.map((profile) => profile.id === user.id ? { ...profile, name: name.trim() } : profile) })); notify("프로필을 저장했습니다."); }
  function changePassword(event: React.FormEvent) { event.preventDefault(); if (!passwords.current || passwords.next.length < 8 || passwords.next !== passwords.confirm) { notify("현재 비밀번호와 8자 이상의 일치하는 새 비밀번호를 확인해 주세요.", "error"); return; } setPasswords({ current: "", next: "", confirm: "" }); notify("데모 모드에서 비밀번호 변경 흐름을 확인했습니다. 실제 변경은 Supabase Auth 연결 후 적용됩니다.", "info"); }
  return <>
    <PageHeader eyebrow="MY ACCOUNT" title="내 프로필" description="개인 정보와 보안 설정을 확인합니다." />
    <div className="profile-grid"><Card className="profile-summary"><Avatar name={user.name} size="large" /><h2>{user.name}</h2><p>{user.email}</p><Badge tone={user.role === "ADMIN" ? "purple" : user.role === "MENTOR" ? "blue" : "green"}>{roleLabels[user.role]}</Badge><dl><dt>소속</dt><dd>{user.department}</dd><dt>기수</dt><dd>{cohort?.name ?? "해당 없음"}</dd><dt>실습 기간</dt><dd>{user.startDate ? `${user.startDate} ~ ${user.endDate}` : "해당 없음"}</dd><dt>프로젝트 조</dt><dd>{user.projectGroup ?? "해당 없음"}</dd></dl><div className="profile-security"><ShieldCheck size={18} /><span><strong>역할 정보 보호</strong><small>역할·기수·멘토 배정은 관리자만 변경합니다.</small></span></div></Card><div className="profile-forms"><Card><SectionTitle title="기본 정보" description="표시 이름은 직접 변경할 수 있습니다." action={<UserRound size={20} />} /><form className="form-stack" onSubmit={saveProfile}><Field label="이름"><input value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="이메일" hint="이메일 변경은 관리자에게 문의하세요."><input value={user.email} disabled /></Field><Field label="소속 부서"><input value={user.department} disabled /></Field><div className="modal-actions"><Button type="submit"><Save size={16} /> 프로필 저장</Button></div></form></Card><Card><SectionTitle title="비밀번호 변경" description="새 비밀번호는 8자 이상이어야 합니다." action={<KeyRound size={20} />} /><form className="form-stack" onSubmit={changePassword}><Field label="현재 비밀번호"><input type="password" value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} /></Field><div className="form-grid"><Field label="새 비밀번호"><input type="password" value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} /></Field><Field label="새 비밀번호 확인"><input type="password" value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} /></Field></div><div className="modal-actions"><Button type="submit">비밀번호 변경</Button></div></form></Card></div></div>
  </>;
}
