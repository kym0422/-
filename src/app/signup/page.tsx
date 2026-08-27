"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!name.trim() || !email.trim() || !password) {
      setError("이름, 이메일, 비밀번호를 모두 입력해 주세요.");
      return;
    }
    if (password.length < 8) {
      setError("비밀번호는 8자 이상으로 입력해 주세요.");
      return;
    }
    if (!isSupabaseConfigured()) {
      setError("Supabase 연결 정보가 설정되지 않았습니다. 관리자에게 문의해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: signupError } = await createClient().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim(), display_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (signupError) {
        setError("가입 요청을 처리하지 못했습니다. 입력 정보를 확인하거나 잠시 후 다시 시도해 주세요.");
        return;
      }

      setMessage("가입 요청이 완료되었습니다. 이메일 인증 후 관리자의 계정 승인을 기다려 주세요.");
      setPassword("");
    } catch {
      setError("가입 요청 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand"><span className="brand-mark brand-mark-light">G</span><div><strong>GENORAY</strong><small>현장실습 프로그램</small></div></div>
        <div className="login-copy"><span className="login-kicker"><UserPlus size={17} /> 계정 가입 요청</span><h1>현장실습 프로그램에<br />함께해 주세요</h1><p>가입 후 이메일 인증과 관리자 승인이 완료되면 서비스를 이용할 수 있습니다.</p></div>
        <p className="login-copyright">© 2026 Genoray. Internship Operations.</p>
      </section>
      <section className="login-form-panel">
        <div className="login-form-card">
          <div className="login-mobile-brand"><span className="brand-mark">G</span><strong>GENORAY</strong></div>
          <p className="eyebrow">CREATE ACCOUNT</p><h2>회원가입</h2><p className="login-description">가입 후 관리자가 역할과 사용 권한을 승인합니다.</p>
          <form onSubmit={submit} className="login-form">
            <label><span>이름</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label>
            <label><span>이메일</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
            <label><span>비밀번호</span><div className="password-input"><LockKeyhole size={18} /><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            {error ? <p className="login-error">{error}</p> : null}
            {message ? <p className="login-success">{message}</p> : null}
            <button className="login-submit" type="submit" disabled={submitting}>{submitting ? "가입 요청 중..." : <>가입 요청 <ArrowRight size={18} /></>}</button>
          </form>
          <p className="login-signup-link"><Link href="/login"><ArrowLeft size={15} /> 로그인으로 돌아가기</Link></p>
        </div>
      </section>
    </main>
  );
}
