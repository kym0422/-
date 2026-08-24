import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DEMO_IDS, demoEvents, demoInterns, demoNotices, demoSuggestions, demoTasks } from "./demo-data";
import {
  canAssignTask,
  canAccessRoute,
  canCancelSuggestion,
  canEvaluateIntern,
  canCreateEvaluation,
  canEditCalendarEvent,
  canEditTask,
  canEditWeeklyReport,
  canManageCohorts,
  canManageIntern,
  canManageUsers,
  canSubmitTask,
  canViewIntern,
  canViewCalendarEvent,
  canViewNotice,
  canViewSuggestion,
  canViewTask,
  canViewWeeklyReport,
  hasPermission,
} from "./permissions";
import type { AuthenticatedUser } from "./types";

const admin: AuthenticatedUser = { id: DEMO_IDS.admin, role: "ADMIN" };
const mentorOne: AuthenticatedUser = { id: DEMO_IDS.mentorOne, role: "MENTOR" };
const mentorTwo: AuthenticatedUser = { id: DEMO_IDS.mentorTwo, role: "MENTOR" };
const internOne: AuthenticatedUser = { id: DEMO_IDS.internOne, role: "INTERN" };
const internTwo: AuthenticatedUser = { id: DEMO_IDS.internTwo, role: "INTERN" };

const assignedIntern = demoInterns.find((intern) => intern.id === DEMO_IDS.internOne);
const otherIntern = demoInterns.find((intern) => intern.id === DEMO_IDS.internThree);

assert.ok(assignedIntern);
assert.ok(otherIntern);

describe("role permission matrix", () => {
  test("grants management capabilities only to the intended roles", () => {
    assert.equal(hasPermission("ADMIN", "member:manage"), true);
    assert.equal(hasPermission("MENTOR", "member:manage"), false);
    assert.equal(hasPermission("MENTOR", "evaluation:write-assigned"), true);
    assert.equal(hasPermission("INTERN", "suggestion:write-own"), true);
    assert.equal(hasPermission("INTERN", "evaluation:read-all"), false);
    assert.equal(canManageUsers("ADMIN"), true);
    assert.equal(canManageUsers("MENTOR"), false);
    assert.equal(canManageCohorts("ADMIN"), true);
    assert.equal(canViewIntern("MENTOR"), true);
    assert.equal(canAssignTask("MENTOR"), true);
    assert.equal(canAssignTask("INTERN"), false);
    assert.equal(canSubmitTask("INTERN"), true);
    assert.equal(canEvaluateIntern("MENTOR"), true);
  });

  test("uses default-deny route access", () => {
    assert.equal(canAccessRoute("ADMIN", "/admin/settings"), true);
    assert.equal(canAccessRoute("MENTOR", "/admin/settings"), false);
    assert.equal(canAccessRoute("INTERN", "/admin/settings"), false);
    assert.equal(canAccessRoute("INTERN", "/members"), false);
    assert.equal(canAccessRoute("MENTOR", "/members?team=platform"), true);
    assert.equal(canAccessRoute("INTERN", "/intern/weekly-reports/123/"), true);
    assert.equal(canAccessRoute("INTERN", "/notices/notice-001"), true);
    assert.equal(canAccessRoute("INTERN", "/not-a-real-route"), false);
  });
});

describe("record-level permissions", () => {
  test("limits mentor access to primary or secondary assigned interns", () => {
    assert.equal(canManageIntern(admin, otherIntern), true);
    assert.equal(canManageIntern(mentorOne, assignedIntern), true);
    assert.equal(canManageIntern(mentorTwo, assignedIntern), true);
    assert.equal(canManageIntern(mentorOne, otherIntern), false);
  });

  test("keeps weekly reports editable only by their intern owner", () => {
    assert.equal(canViewWeeklyReport(admin, assignedIntern), true);
    assert.equal(canViewWeeklyReport(mentorOne, assignedIntern), true);
    assert.equal(canViewWeeklyReport(mentorOne, otherIntern), false);
    assert.equal(canViewWeeklyReport(internOne, assignedIntern), true);
    assert.equal(canViewWeeklyReport(internTwo, assignedIntern), false);

    assert.equal(canEditWeeklyReport(internOne, assignedIntern.id), true);
    assert.equal(canEditWeeklyReport(mentorOne, assignedIntern.id), false);
    assert.equal(canEditWeeklyReport(admin, assignedIntern.id), false);
  });

  test("allows admins and assigned mentors to manage tasks, never interns", () => {
    const task = demoTasks[0];
    assert.ok(task);

    assert.equal(canViewTask(admin, task, assignedIntern), true);
    assert.equal(canViewTask(mentorOne, task, assignedIntern), true);
    assert.equal(canViewTask(internOne, task, assignedIntern), true);
    assert.equal(canViewTask(internTwo, task, assignedIntern), false);

    assert.equal(canEditTask(admin, task, assignedIntern), true);
    assert.equal(canEditTask(mentorOne, task, assignedIntern), true);
    assert.equal(canEditTask(internOne, task, assignedIntern), false);
    assert.equal(canViewTask(mentorTwo, task, otherIntern), false);
    assert.equal(canEditTask(mentorTwo, task, otherIntern), false);
  });

  test("permits evaluations only from an assigned mentor", () => {
    assert.equal(canCreateEvaluation(mentorOne, assignedIntern), true);
    assert.equal(canCreateEvaluation(mentorOne, otherIntern), false);
    assert.equal(canCreateEvaluation(admin, assignedIntern), false);
  });

  test("keeps suggestions visible to admins and their submitter only", () => {
    const suggestion = demoSuggestions[0];
    assert.ok(suggestion);

    assert.equal(canViewSuggestion(admin, suggestion), true);
    assert.equal(canViewSuggestion(internOne, suggestion), true);
    assert.equal(canViewSuggestion(internTwo, suggestion), false);
    assert.equal(canViewSuggestion(mentorOne, suggestion), false);
    assert.equal(canCancelSuggestion(internOne, suggestion), true);
    assert.equal(canCancelSuggestion(admin, suggestion), false);
  });
});

describe("visibility policies", () => {
  test("filters notices by role or cohort", () => {
    const allNotice = demoNotices[0];
    const internNotice = demoNotices[1];
    assert.ok(allNotice);
    assert.ok(internNotice);

    assert.equal(canViewNotice(assignedIntern, allNotice), true);
    assert.equal(canViewNotice(assignedIntern, internNotice), true);
    assert.equal(canViewNotice(mentorOne, internNotice), false);
    assert.equal(canViewNotice(admin, internNotice), true);

    assert.equal(
      canViewNotice(assignedIntern, {
        ...allNotice,
        audience: "COHORT",
        targetCohortId: DEMO_IDS.currentCohort,
      }),
      true,
    );
  });

  test("keeps private todo events visible and editable only to the creator", () => {
    const todo = demoEvents.find((event) => event.eventType === "TODO");
    assert.ok(todo);

    assert.equal(canViewCalendarEvent(internOne, todo), true);
    assert.equal(canViewCalendarEvent(internTwo, todo), false);
    assert.equal(canViewCalendarEvent(admin, todo), false);
    assert.equal(canEditCalendarEvent(internOne, todo), true);
    assert.equal(canEditCalendarEvent(admin, todo), false);
  });
});
