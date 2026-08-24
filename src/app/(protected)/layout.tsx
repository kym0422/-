import { ProtectedApp } from "@/components/app-shell";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedApp>{children}</ProtectedApp>;
}
