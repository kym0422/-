import type { Metadata } from "next";
import { AppStoreProvider } from "@/components/app-store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Genoray 현장실습 프로그램",
  description: "현장실습 업무, 과제, 평가와 일정을 한곳에서 관리합니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body><AppStoreProvider>{children}</AppStoreProvider></body>
    </html>
  );
}
