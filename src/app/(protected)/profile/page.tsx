"use client";

import { useRef, useState } from "react";
import { KeyRound, Save, ShieldCheck, UploadCloud, UserRound } from "lucide-react";
import { roleLabels } from "@/components/app-data";
import { useAppStore } from "@/components/app-store";
import { Badge, Button, Card, Field, PageHeader, SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

const profileAvatarBucket = "profile-avatars";
const maxAvatarSize = 5 * 1024 * 1024;
const allowedAvatarTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export default function ProfilePage() {
  const { currentUser, data, refresh, notify } = useAppStore();
  const [name, setName] = useState(currentUser?.name ?? "");
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  if (!currentUser) return null;
  const user = currentUser;
  const cohort = data.cohorts.find((item) => item.id === user.cohortId);

  async function changeAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!allowedAvatarTypes.includes(file.type)) {
      notify("JPG, PNG, GIF, WebP 이미지만 등록할 수 있습니다.", "error");
      return;
    }
    if (file.size > maxAvatarSize) {
      notify("프로필 사진은 5MB 이하만 등록할 수 있습니다.", "error");
      return;
    }

    setUploadingAvatar(true);
    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setUploadingAvatar(false);
      notify("로그인 정보를 확인하지 못했습니다.", "error");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${authData.user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(profileAvatarBucket).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      setUploadingAvatar(false);
      notify("프로필 사진을 업로드하지 못했습니다.", "error");
      return;
    }

    const { data: publicUrlData } = supabase.storage.from(profileAvatarBucket).getPublicUrl(path);
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrlData.publicUrl })
      .eq("id", user.id);
    setUploadingAvatar(false);
    if (profileError) {
      await supabase.storage.from(profileAvatarBucket).remove([path]);
      notify("프로필 사진을 저장하지 못했습니다.", "error");
      return;
    }

    await refresh();
    notify("프로필 사진을 변경했습니다.");
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) {
      notify("이름을 입력해 주세요.", "error");
      return;
    }

    setSavingProfile(true);
    const { error } = await createClient()
      .from("profiles")
      .update({ name: nextName, display_name: nextName })
      .eq("id", user.id);
    setSavingProfile(false);

    if (error) {
      notify("프로필을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", "error");
      return;
    }

    await refresh();
    notify("프로필을 저장했습니다.");
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (!passwords.current || passwords.next.length < 8 || passwords.next !== passwords.confirm) {
      notify("현재 비밀번호와 8자 이상의 일치하는 새 비밀번호를 확인해 주세요.", "error");
      return;
    }

    setSavingPassword(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: passwords.current,
    });
    if (signInError) {
      setSavingPassword(false);
      notify("현재 비밀번호가 올바르지 않습니다.", "error");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: passwords.next });
    setSavingPassword(false);
    if (error) {
      notify("비밀번호를 변경하지 못했습니다.", "error");
      return;
    }

    setPasswords({ current: "", next: "", confirm: "" });
    notify("비밀번호를 변경했습니다.");
  }

  return <>
    <PageHeader eyebrow="MY ACCOUNT" title="내 프로필" description="개인 정보와 보안 설정을 계정에 저장합니다." />
    <div className="profile-grid">
      <Card className="profile-summary">
        <ProfileAvatar role={user.role} imageUrl={user.avatarUrl} />
        <input ref={avatarInputRef} className="sr-only" type="file" accept={allowedAvatarTypes.join(",")} onChange={(event) => void changeAvatar(event)} />
        <Button className="profile-photo-button" type="button" variant="secondary" disabled={uploadingAvatar} onClick={() => avatarInputRef.current?.click()}>
          <UploadCloud size={16} /> {uploadingAvatar ? "업로드 중..." : "사진 변경"}
        </Button>
        <h2>{user.name}</h2>
        <p>{user.email}</p>
        <Badge tone={user.role === "ADMIN" ? "purple" : user.role === "MENTOR" ? "blue" : "green"}>{roleLabels[user.role]}</Badge>
        <dl>
          <dt>소속</dt><dd>{user.department}</dd>
          {user.role !== "ADMIN" ? <>
            <dt>기수</dt><dd>{cohort?.name ?? "배정 없음"}</dd>
            <dt>실습 기간</dt><dd>{user.startDate ? `${user.startDate} ~ ${user.endDate}` : "배정 없음"}</dd>
            <dt>프로젝트 조</dt><dd>{user.projectGroup ?? "배정 없음"}</dd>
          </> : null}
        </dl>
        <div className="profile-security"><ShieldCheck size={18} /><span><strong>계정 정보 보호</strong><small>역할, 기수, 멘토 배정은 관리자만 변경할 수 있습니다.</small></span></div>
      </Card>
      <div className="profile-forms">
        <Card>
          <SectionTitle title="기본 정보" description="표시 이름은 프로필에 저장됩니다." action={<UserRound size={20} />} />
          <form className="form-stack" onSubmit={(event) => void saveProfile(event)}>
            <Field label="이름"><input value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="이메일" hint="이메일 변경은 관리자에게 문의해 주세요."><input value={user.email} disabled /></Field>
            <Field label="전화번호" hint="전화번호 변경은 관리자에게 문의해 주세요."><input value={user.phone ?? "미등록"} disabled /></Field>
            <Field label="소속 부서"><input value={user.department} disabled /></Field>
            <div className="modal-actions"><Button type="submit" disabled={savingProfile}>{savingProfile ? "저장 중..." : <><Save size={16} /> 프로필 저장</>}</Button></div>
          </form>
        </Card>
        <Card>
          <SectionTitle title="비밀번호 변경" description="현재 비밀번호를 확인한 뒤 계정 보안에 반영합니다." action={<KeyRound size={20} />} />
          <form className="form-stack" onSubmit={(event) => void changePassword(event)}>
            <Field label="현재 비밀번호"><input type="password" value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} autoComplete="current-password" /></Field>
            <div className="form-grid">
              <Field label="새 비밀번호"><input type="password" value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} autoComplete="new-password" /></Field>
              <Field label="새 비밀번호 확인"><input type="password" value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} autoComplete="new-password" /></Field>
            </div>
            <div className="modal-actions"><Button type="submit" disabled={savingPassword}>{savingPassword ? "변경 중..." : "비밀번호 변경"}</Button></div>
          </form>
        </Card>
      </div>
    </div>
  </>;
}

function ProfileAvatar({ role, imageUrl }: { role: "ADMIN" | "MENTOR" | "INTERN"; imageUrl?: string }) {
  return (
    <div
      className={`profile-photo profile-photo-${role.toLowerCase()}`}
      style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
      aria-hidden="true"
    >
      {imageUrl ? null : <UserRound size={34} />}
    </div>
  );
}
