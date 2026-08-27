"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAppStore } from "@/components/app-store";

export default function LoginPage() {
  const router = useRouter();
  const { currentUser, login, ready } = useAppStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && currentUser) router.replace("/dashboard");
  }, [currentUser, ready, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) { setError("이메일과 비밀번호를 모두 입력해 주세요."); return; }
    const result = await login(email, password);
    if (!result.ok) { setError(result.message); return; }
    router.replace("/dashboard");
    router.refresh();
  }

  if (!ready) return <div className="loading-screen"><span className="spinner" /><p>계정 정보를 확인하고 있습니다.</p></div>;

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand"><span className="brand-mark brand-mark-light">G</span><div><strong>GENORAY</strong><small>현장실습 프로그램</small></div></div>
        <div className="login-copy"><span className="login-kicker"><ShieldCheck size={17} /> 안전한 현장실습 운영</span><h1>성장하는 시간을<br />관리의 빈틈 없이</h1><p>업무 기록부터 과제, 평가, 일정까지. 운영에 필요한 일을 하나의 공간에서 관리합니다.</p><div className="login-features"><span><CheckCircle2 size={17} /> 역할에 맞춘 접근 권한</span><span><CheckCircle2 size={17} /> 업무 현황의 빠른 확인</span><span><CheckCircle2 size={17} /> 기록과 피드백의 체계적 관리</span></div></div>
        <p className="login-copyright">© 2026 Genoray. Internship Operations.</p>
      </section>
      <section className="login-form-panel"><div className="login-form-card">
        <div className="login-mobile-brand"><span className="brand-mark">G</span><strong>GENORAY</strong></div><p className="eyebrow">WELCOME BACK</p><h2>로그인</h2><p className="login-description">현장실습 통합 관리 시스템에 접속합니다.</p>
        <form onSubmit={submit} className="login-form">
          <label><span>이메일</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
          <label><span>비밀번호</span><div className="password-input"><LockKeyhole size={18} /><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          {error ? <p className="login-error">{error}</p> : null}
          <button className="login-submit" type="submit">로그인 <ArrowRight size={18} /></button>
        </form>
        <p className="login-account-notice">계정은 관리자에게 발급받아 주세요.</p>
      </div></section>
    </main>
  );
}
