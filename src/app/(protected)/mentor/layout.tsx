import { requireRole } from "@/lib/auth/current-user";

export default async function MentorLayout({ children }: { children: React.ReactNode }) {
  await requireRole("MENTOR");
  return children;
}
