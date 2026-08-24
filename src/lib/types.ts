export const ROLES = ["ADMIN", "MENTOR", "INTERN"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  ADMIN: "관리자",
  MENTOR: "멘토",
  INTERN: "인턴",
};

export type UserId = string;
export type CohortId = string;
export type NoticeId = string;
export type CalendarEventId = string;
export type TaskId = string;
export type WeeklyReportId = string;
export type EvaluationId = string;
export type SuggestionId = string;
export type ResourceId = string;
export type IsoDate = string;
export type IsoDateTime = string;

export interface AuditFields {
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  createdBy: UserId;
}

interface BaseUser {
  id: UserId;
  email: string;
  name: string;
  displayName: string;
  department: string;
  isActive: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AdminUser extends BaseUser {
  role: "ADMIN";
}

export interface MentorUser extends BaseUser {
  role: "MENTOR";
  jobTitle: string;
}

export interface InternUser extends BaseUser {
  role: "INTERN";
  cohortId: CohortId;
  teamName: string;
  internshipStartDate: IsoDate;
  internshipEndDate: IsoDate;
  primaryMentorId: UserId;
  secondaryMentorId?: UserId;
}

export type User = AdminUser | MentorUser | InternUser;
export type AuthenticatedUser = {
  [CurrentRole in Role]: { id: UserId; role: CurrentRole };
}[Role];

export type CohortStatus = "UPCOMING" | "ACTIVE" | "COMPLETED";

export interface Cohort extends AuditFields {
  id: CohortId;
  name: string;
  startDate: IsoDate;
  endDate: IsoDate;
  status: CohortStatus;
}

export type NoticeAudience = "ALL" | "ADMIN" | "MENTOR" | "INTERN" | "COHORT";

export interface Notice extends AuditFields {
  id: NoticeId;
  title: string;
  content: string;
  audience: NoticeAudience;
  targetCohortId?: CohortId;
  publishedAt: IsoDateTime;
  visibleFrom: IsoDateTime;
  visibleUntil?: IsoDateTime;
  isPinned: boolean;
}

export interface NoticeComment extends AuditFields {
  id: string;
  noticeId: NoticeId;
  content: string;
  attachmentName?: string;
}

export type CalendarVisibility = "ALL" | "PRIVATE" | "ADMIN" | "MENTOR" | "INTERN";

interface BaseCalendarEvent extends AuditFields {
  id: CalendarEventId;
  title: string;
  description: string;
  startDate: IsoDateTime;
  endDate: IsoDateTime;
  isImportant: boolean;
  noticeId?: NoticeId;
}

export interface ScheduleEvent extends BaseCalendarEvent {
  eventType: "SCHEDULE";
  visibility: CalendarVisibility;
}

export interface TodoEvent extends BaseCalendarEvent {
  eventType: "TODO";
  visibility: "PRIVATE";
  isCompleted: boolean;
}

export type CalendarEvent = ScheduleEvent | TodoEvent;

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export interface TaskMilestone {
  id: string;
  title: string;
  dueDate: IsoDate;
  isCompleted: boolean;
}

export interface Task extends AuditFields {
  id: TaskId;
  title: string;
  description: string;
  internId: UserId;
  dueDate: IsoDate;
  status: TaskStatus;
  priority: TaskPriority;
  milestones: readonly TaskMilestone[];
  attachmentNames: readonly string[];
}

export type ReportStatus = "DRAFT" | "SUBMITTED";

export interface WorkItem {
  id: string;
  title: string;
  detail: string;
  progress: number;
}

export interface WeeklyReport extends AuditFields {
  id: WeeklyReportId;
  internId: UserId;
  weekNumber: number;
  weekStartDate: IsoDate;
  weekEndDate: IsoDate;
  status: ReportStatus;
  workItems: readonly WorkItem[];
  progressSummary: string;
  blocker: string;
  feedbackMemo: string;
  attachmentNames: readonly string[];
  submittedAt?: IsoDateTime;
}

export type EvaluationStatus = "ACTIVE" | "CANCELED";

export interface EvaluationScores {
  execution: number;
  communication: number;
  collaboration: number;
  growth: number;
}

export interface Evaluation extends AuditFields {
  id: EvaluationId;
  internId: UserId;
  mentorId: UserId;
  evaluatedOn: IsoDate;
  scores: EvaluationScores;
  strengths: string;
  improvements: string;
  overallComment: string;
  status: EvaluationStatus;
  canceledAt?: IsoDateTime;
}

export type SuggestionStatus = "ACTIVE" | "CANCELED";

/**
 * Persistence-only suggestion record. Never send this shape to an admin client;
 * use the projections in suggestions.ts so submitter identity cannot leak.
 */
export interface SuggestionRecord {
  id: SuggestionId;
  title: string;
  content: string;
  submitterId: UserId;
  status: SuggestionStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  readAt?: IsoDateTime;
  canceledAt?: IsoDateTime;
}

export interface AdminSuggestionView {
  id: SuggestionId;
  title: string;
  content: string;
  status: SuggestionStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  isRead: boolean;
}

export interface SubmitterSuggestionView extends AdminSuggestionView {
  canCancel: boolean;
}

export type ResourceKind = "TEMPLATE" | "LIBRARY";

export interface Resource extends AuditFields {
  id: ResourceId;
  kind: ResourceKind;
  title: string;
  description: string;
  category: string;
  originalFileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}

export interface DemoData {
  users: readonly User[];
  cohorts: readonly Cohort[];
  notices: readonly Notice[];
  noticeComments: readonly NoticeComment[];
  events: readonly CalendarEvent[];
  tasks: readonly Task[];
  weeklyReports: readonly WeeklyReport[];
  evaluations: readonly Evaluation[];
  suggestions: readonly SuggestionRecord[];
  resources: readonly Resource[];
}

export function isAdminUser(user: User): user is AdminUser {
  return user.role === "ADMIN";
}

export function isMentorUser(user: User): user is MentorUser {
  return user.role === "MENTOR";
}

export function isInternUser(user: User): user is InternUser {
  return user.role === "INTERN";
}
