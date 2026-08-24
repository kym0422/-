import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { demoData, demoInterns } from "./demo-data";

describe("demo data", () => {
  test("contains the required role distribution and feature records", () => {
    assert.equal(demoData.users.filter((user) => user.role === "ADMIN").length, 1);
    assert.equal(demoData.users.filter((user) => user.role === "MENTOR").length, 2);
    assert.equal(demoData.users.filter((user) => user.role === "INTERN").length, 3);

    assert.ok(demoData.notices.length >= 3);
    assert.ok(demoData.events.length > 0);
    assert.ok(demoData.tasks.length >= 3);
    assert.ok(demoData.weeklyReports.length > 0);
    assert.ok(demoData.evaluations.length > 0);
    assert.ok(demoData.suggestions.length > 0);
    assert.ok(demoData.resources.some((resource) => resource.kind === "TEMPLATE"));
    assert.ok(demoData.resources.some((resource) => resource.kind === "LIBRARY"));
  });

  test("keeps user references internally consistent", () => {
    const userIds = new Set(demoData.users.map((user) => user.id));
    const mentorIds = new Set(
      demoData.users.filter((user) => user.role === "MENTOR").map((mentor) => mentor.id),
    );
    const internIds = new Set(demoInterns.map((intern) => intern.id));

    for (const intern of demoInterns) {
      assert.equal(mentorIds.has(intern.primaryMentorId), true);
      if (intern.secondaryMentorId !== undefined) {
        assert.equal(mentorIds.has(intern.secondaryMentorId), true);
      }
    }
    for (const task of demoData.tasks) {
      assert.equal(internIds.has(task.internId), true);
      assert.equal(userIds.has(task.createdBy), true);
    }
    for (const report of demoData.weeklyReports) {
      assert.equal(internIds.has(report.internId), true);
      assert.equal(report.createdBy, report.internId);
    }
    for (const evaluation of demoData.evaluations) {
      assert.equal(internIds.has(evaluation.internId), true);
      assert.equal(mentorIds.has(evaluation.mentorId), true);
      assert.equal(evaluation.createdBy, evaluation.mentorId);
    }
    for (const suggestion of demoData.suggestions) {
      assert.equal(internIds.has(suggestion.submitterId), true);
    }
  });
});
