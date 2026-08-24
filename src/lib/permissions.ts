import type {
  AuthenticatedUser,
  CalendarEvent,
  Evaluation,
  InternUser,
  Notice,
  Role,
  SuggestionRecord,
  Task,
} from "./types";

export const PERMISSIONS = [
  "notice:read",
  "notice:manage",
  "calendar:use",
  "resource:read",
  "report:read-all",
  "report:read-assigned",
  "report:write-own",
  "task:manage-all",
  "task:manage-assigned",
  "task:read-own",
  "evaluation:read-all",
  "evaluation:write-assigned",
  "suggestion:read-anonymous",
  "suggestion:write-own",
  "member:read",
  "member:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  ADMIN: [
    "notice:read",
    "notice:manage",
    "calendar:use",
    "resource:read",
    "report:read-all",
    "task:manage-all",
    "evaluation:read-all",
    "suggestion:read-anonymous",
    "member:read",
    "member:manage",
  ],
  MENTOR: [
    "notice:read",
    "calendar:use",
    "resource:read",
    "report:read-assigned",
    "task:manage-assigned",
    "evaluation:write-assigned",
    "member:read",
  ],
  INTERN: [
    "notice:read",
    "calendar:use",
    "resource:read",
    "report:write-own",
    "task:read-own",
    "suggestion:write-own",
  ],
};

const COMMON_EXACT_ROUTES = new Set([
  "/dashboard",
  "/profile",
  "/calendar",
  "/403",
]);

const COMMON_ROUTE_PREFIXES = ["/notices", "/board/templates", "/board/library"] as const;

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

// Shared role checks keep components from scattering role string comparisons.
export const canManageUsers = (role: Role) => hasPermission(role, "member:manage");
export const canManageCohorts = (role: Role) => role === "ADMIN";
export const canViewIntern = (role: Role) => role === "ADMIN" || role === "MENTOR";
export const canAssignTask = (role: Role) =>
  hasPermission(role, "task:manage-all") || hasPermission(role, "task:manage-assigned");
export const canSubmitTask = (role: Role) => role === "INTERN";
export const canEvaluateIntern = (role: Role) =>
  hasPermission(role, "evaluation:read-all") || hasPermission(role, "evaluation:write-assigned");

function normalizedPath(pathname: string): string {
  const pathOnly = pathname.split(/[?#]/, 1)[0] || "/";
  if (pathOnly === "/") {
    return pathOnly;
  }
  return pathOnly.replace(/\/+$/, "");
}

function isRouteOrChild(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** Default-deny route policy for authenticated application routes. */
export function canAccessRoute(role: Role, pathname: string): boolean {
  const path = normalizedPath(pathname);

  if (
    COMMON_EXACT_ROUTES.has(path) ||
    COMMON_ROUTE_PREFIXES.some((route) => isRouteOrChild(path, route))
  ) {
    return true;
  }
  if (isRouteOrChild(path, "/admin")) {
    return role === "ADMIN";
  }
  if (isRouteOrChild(path, "/mentor")) {
    return role === "MENTOR";
  }
  if (isRouteOrChild(path, "/intern")) {
    return role === "INTERN";
  }
  if (isRouteOrChild(path, "/members")) {
    return role === "ADMIN" || role === "MENTOR";
  }

  return false;
}

export function isAssignedMentor(
  mentorId: string,
  intern: Pick<InternUser, "primaryMentorId" | "secondaryMentorId">,
): boolean {
  return intern.primaryMentorId === mentorId || intern.secondaryMentorId === mentorId;
}

export function canManageIntern(
  actor: AuthenticatedUser,
  intern: Pick<InternUser, "id" | "primaryMentorId" | "secondaryMentorId">,
): boolean {
  if (actor.role === "ADMIN") {
    return true;
  }
  return actor.role === "MENTOR" && isAssignedMentor(actor.id, intern);
}

export function canViewWeeklyReport(
  actor: AuthenticatedUser,
  owner: Pick<InternUser, "id" | "primaryMentorId" | "secondaryMentorId">,
): boolean {
  if (actor.role === "ADMIN") {
    return true;
  }
  if (actor.role === "INTERN") {
    return actor.id === owner.id;
  }
  return isAssignedMentor(actor.id, owner);
}

export function canEditWeeklyReport(
  actor: AuthenticatedUser,
  ownerId: string,
): boolean {
  return actor.role === "INTERN" && actor.id === ownerId;
}

export function canViewTask(
  actor: AuthenticatedUser,
  task: Pick<Task, "internId">,
  assignee: Pick<InternUser, "id" | "primaryMentorId" | "secondaryMentorId">,
): boolean {
  if (task.internId !== assignee.id) {
    return false;
  }
  if (actor.role === "ADMIN") {
    return true;
  }
  if (actor.role === "INTERN") {
    return actor.id === task.internId;
  }
  return isAssignedMentor(actor.id, assignee);
}

export function canEditTask(
  actor: AuthenticatedUser,
  task: Pick<Task, "internId">,
  assignee: Pick<InternUser, "id" | "primaryMentorId" | "secondaryMentorId">,
): boolean {
  if (task.internId !== assignee.id) {
    return false;
  }
  return actor.role === "ADMIN" || (actor.role === "MENTOR" && isAssignedMentor(actor.id, assignee));
}

export function canViewEvaluation(
  actor: AuthenticatedUser,
  evaluation: Pick<Evaluation, "mentorId">,
): boolean {
  return actor.role === "ADMIN" || (actor.role === "MENTOR" && actor.id === evaluation.mentorId);
}

export function canCreateEvaluation(
  actor: AuthenticatedUser,
  intern: Pick<InternUser, "primaryMentorId" | "secondaryMentorId">,
): boolean {
  return actor.role === "MENTOR" && isAssignedMentor(actor.id, intern);
}

export function canViewSuggestion(
  actor: AuthenticatedUser,
  suggestion: Pick<SuggestionRecord, "submitterId">,
): boolean {
  return actor.role === "ADMIN" || (actor.role === "INTERN" && actor.id === suggestion.submitterId);
}

export function canCancelSuggestion(
  actor: AuthenticatedUser,
  suggestion: Pick<SuggestionRecord, "submitterId" | "status">,
): boolean {
  return actor.role === "INTERN" && actor.id === suggestion.submitterId && suggestion.status === "ACTIVE";
}

export function canViewNotice(user: UserForNotice, notice: Notice): boolean {
  if (user.role === "ADMIN" || notice.audience === "ALL" || notice.audience === user.role) {
    return true;
  }
  return notice.audience === "COHORT" && user.role === "INTERN" && user.cohortId === notice.targetCohortId;
}

type UserForNotice =
  | { id: string; role: "ADMIN" | "MENTOR" }
  | { id: string; role: "INTERN"; cohortId: string };

export function canViewCalendarEvent(
  user: AuthenticatedUser,
  event: CalendarEvent,
): boolean {
  if (event.createdBy === user.id) {
    return true;
  }
  if (event.visibility === "ALL") {
    return true;
  }
  if (event.visibility === "PRIVATE") {
    return false;
  }
  return event.visibility === user.role;
}

export function canEditCalendarEvent(
  user: AuthenticatedUser,
  event: Pick<CalendarEvent, "createdBy">,
): boolean {
  return event.createdBy === user.id;
}
