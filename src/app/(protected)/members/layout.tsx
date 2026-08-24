import { requireRole } from "@/lib/auth/current-user";

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  await requireRole("ADMIN", "MENTOR");
  return children;
}
