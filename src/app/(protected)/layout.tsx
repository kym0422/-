import { ProtectedApp } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <ProtectedApp>{children}</ProtectedApp>;
}
