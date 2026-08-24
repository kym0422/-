"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { DEMO_PASSWORD, getDemoLoginAccounts, roleLabels, type Role } from "@/components/app-data";
import { useAppStore } from "@/components/app-store";
import { Avatar } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const { currentUser, data, login, ready } = useAppStore();
  const [role, setRole] = useState<Role>("ADMIN");
  const accounts = getDemoLoginAccounts(data.profiles);
  const account = accounts.find((candidate) => candidate.role === role) ?? accounts[0];
  const [emailInput, setEmailInput] = useState<string | null>(null);
  const email = emailInput ?? account.email;
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && currentUser) router.replace("/dashboard");
  }, [currentUser, ready, router]);

  if (!ready) {
    return <div className="loading-screen"><span className="spinner" /><p>저장된 계정 정보를 불러오고 있습니다.</p></div>;
  }

  function chooseRole(nextRole: Role) {
    setRole(nextRole);
    setEmailInput(null);
    setPassword(DEMO_PASSWORD);
    setError("");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }
    if (!login(email, password)) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand">
          <span className="brand-mark brand-mark-light">G</span>
          <div><strong>GENORAY</strong><small>현장실습 프로그램</small></div>
        </div>
        <div className="login-copy">
          <span className="login-kicker"><ShieldCheck size={17} /> 안전한 현장실습 운영</span>
          <h1>성장하는 시간에<br />관리의 빈틈이 없도록.</h1>
          <p>업무 기록부터 과제, 평가, 일정까지. 운영자·멘토·인턴이 하나의 공간에서 함께합니다.</p>
          <div className="login-features">
            <span><CheckCircle2 size={17} /> 역할에 맞춘 안전한 권한</span>
            <span><CheckCircle2 size={17} /> 업무 현황을 한눈에</span>
            <span><CheckCircle2 size={17} /> 기록과 피드백을 체계적으로</span>
          </div>
        </div>
        <p className="login-copyright">© 2026 Genoray. Internship Operations.</p>
      </section>

      <section className="login-form-panel">
        <div className="login-form-card">
          <div className="login-mobile-brand"><span className="brand-mark">G</span><strong>GENORAY</strong></div>
          <p className="eyebrow">WELCOME BACK</p>
          <h2>로그인</h2>
          <p className="login-description">현장실습 통합 관리 시스템에 접속합니다.</p>

          <div className="demo-role-tabs" role="tablist" aria-label="데모 계정 선택">
            {accounts.map((item) => (
              <button key={item.role} className={role === item.role ? "active" : ""} onClick={() => chooseRole(item.role)} role="tab" aria-selected={role === item.role}>
                <Avatar name={item.name} size="small" />
                <span><strong>{roleLabels[item.role]}</strong><small>{item.name}</small></span>
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="login-form">
            <label>
              <span>이메일</span>
              <input type="email" value={email} onChange={(event) => setEmailInput(event.target.value)} autoComplete="email" />
            </label>
            <label>
              <span>비밀번호</span>
              <div className="password-input">
                <LockKeyhole size={18} />
                <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </label>
            {error ? <p className="login-error">{error}</p> : null}
            <button className="login-submit" type="submit">로그인 <ArrowRight size={18} /></button>
          </form>

          <div className="demo-note">
            <strong>체험용 데모 계정</strong>
            <p>위 역할을 선택하면 계정이 자동 입력됩니다. 공통 비밀번호는 <code>{DEMO_PASSWORD}</code>입니다.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
