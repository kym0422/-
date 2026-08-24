import Link from "next/link";
import { ArrowLeft, LogIn, ShieldX } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <main className="forbidden-page">
      <section className="forbidden-card">
        <span className="forbidden-icon"><ShieldX size={30} /></span>
        <p className="eyebrow">ERROR 403</p>
        <h1>접근 권한이 없습니다.</h1>
        <p>현재 계정으로는 이 페이지를 볼 수 없습니다. 역할에 맞는 메뉴를 이용하거나 관리자에게 권한을 문의해 주세요.</p>
        <div className="forbidden-actions"><Link href="/dashboard"><ArrowLeft size={17} /> 대시보드로 이동</Link><Link href="/login"><LogIn size={17} /> 다른 계정으로 로그인</Link></div>
      </section>
    </main>
  );
}
