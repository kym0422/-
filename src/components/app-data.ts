export type Role = "ADMIN" | "MENTOR" | "INTERN";

export type Profile = { id: string; name: string; email: string; phone?: string; role: Role; department: string; cohortId?: string; projectGroup?: string; startDate?: string; endDate?: string; avatarUrl?: string; isActive: boolean };
export type NoticeComment = { id: string; authorId: string; authorName: string; content: string; createdAt: string };
export type Notice = { id: string; title: string; content: string; target: "ALL" | Role; createdBy: string; createdAt: string; startDate: string; endDate?: string; important: boolean; calendarLinked: boolean; comments: NoticeComment[] };
export type CalendarEvent = { id: string; title: string; description: string; startDate: string; endDate: string; eventType: "SCHEDULE" | "TODO"; visibility: "ALL" | "PRIVATE" | "ADMIN" | "MENTOR" | "INTERN"; isImportant: boolean; isCompleted: boolean; createdBy: string; noticeId?: string };
export type Resource = { id: string; category: "TEMPLATE" | "LIBRARY"; title: string; description: string; fileName: string; fileSize: number; uploadedBy: string; uploadedAt: string };
export type AssignedTask = { id: string; internId: string; assignedBy: string; title: string; summary: string; startWeek: number; endWeek: number; primaryCategory: string; secondaryCategory: string; difficulty: "기본" | "중급" | "고급"; expectedOutput: string; createdAt: string };
export type WeeklyReportItem = { id: string; description: string; progress: number; weeklyFeedback: string; attachmentName?: string };
export type WeeklyReport = { id: string; internId: string; cohortId: string; projectType: "개인 프로젝트" | "팀 프로젝트"; weekNumber: number; items: WeeklyReportItem[]; updatedAt: string };
export type Evaluation = { id: string; internId: string; mentorId: string; title: string; content: string; status: "ACTIVE" | "CANCELED"; submittedAt: string; readAt?: string };
export type Suggestion = { id: string; ownerToken: string; title: string; content: string; status: "ACTIVE" | "CANCELED"; submittedAt: string; readAt?: string };
export type Cohort = { id: string; name: string; startDate: string; endDate: string; totalWeeks: number; status: "UPCOMING" | "ACTIVE" | "COMPLETED" };
export type MentorAssignment = { id: string; cohortId: string; internId: string; primaryMentorId: string; secondaryMentorId?: string };
/**
 * Reference data shared by the client shell. Feature records are intentionally
 * fetched by their own screens from Supabase rather than mirrored in memory.
 */
export type AppData = { profiles: Profile[]; cohorts: Cohort[]; mentorAssignments: MentorAssignment[] };

export const roleLabels: Record<Role, string> = { ADMIN: "관리자", MENTOR: "멘토", INTERN: "인턴" };
export const initialData: AppData = { profiles: [], cohorts: [], mentorAssignments: [] };

export function uid(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
export function getWeekNumber(startDate?: string, endDate?: string, reference = new Date()) { if (!startDate) return 1; const start = new Date(`${startDate}T00:00:00`); if (endDate && reference > new Date(`${endDate}T23:59:59`)) return null; return Math.max(1, Math.floor(Math.floor((reference.getTime() - start.getTime()) / 86_400_000) / 7) + 1); }
export function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
