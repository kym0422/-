import { requireRole } from "@/lib/auth/current-user";

export default async function InternLayout({ children }: { children: React.ReactNode }) {
  await requireRole("INTERN");
  return children;
}
