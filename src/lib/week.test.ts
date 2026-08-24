import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { calculateInternshipWeek } from "./week";

describe("calculateInternshipWeek", () => {
  test("treats days 1 through 7 as week 1", () => {
    assert.deepEqual(calculateInternshipWeek("2026-08-03", "2026-09-25", "2026-08-03"), {
      status: "ACTIVE",
      week: 1,
      totalWeeks: 8,
      label: "1주차",
    });
    assert.equal(calculateInternshipWeek("2026-08-03", "2026-09-25", "2026-08-09").week, 1);
  });

  test("starts week 2 on the eighth inclusive day", () => {
    const result = calculateInternshipWeek("2026-08-03", "2026-09-25", "2026-08-10");
    assert.equal(result.week, 2);
    assert.equal(result.label, "2주차");
    assert.equal(result.status, "ACTIVE");
  });

  test("reports upcoming before start and completed after end", () => {
    assert.deepEqual(calculateInternshipWeek("2026-08-03", "2026-08-16", "2026-08-02"), {
      status: "UPCOMING",
      week: 0,
      totalWeeks: 2,
      label: "실습 시작 전",
    });
    assert.deepEqual(calculateInternshipWeek("2026-08-03", "2026-08-16", "2026-08-17"), {
      status: "COMPLETED",
      week: 2,
      totalWeeks: 2,
      label: "실습 종료",
    });
  });

  test("keeps the inclusive end date active", () => {
    const result = calculateInternshipWeek("2026-08-03", "2026-08-16", "2026-08-16");
    assert.equal(result.status, "ACTIVE");
    assert.equal(result.week, 2);
  });

  test("calculates from each intern's own start date", () => {
    const earlierStart = calculateInternshipWeek("2026-08-03", "2026-09-25", "2026-08-13");
    const laterStart = calculateInternshipWeek("2026-08-10", "2026-10-02", "2026-08-13");
    assert.equal(earlierStart.week, 2);
    assert.equal(laterStart.week, 1);
  });

  test("handles Date inputs using UTC calendar days", () => {
    const result = calculateInternshipWeek(
      new Date("2026-08-03T23:00:00.000Z"),
      new Date("2026-08-16T00:00:00.000Z"),
      new Date("2026-08-10T00:01:00.000Z"),
    );
    assert.equal(result.week, 2);
  });

  test("rejects invalid or reversed ranges", () => {
    assert.throws(
      () => calculateInternshipWeek("2026-08-40", "2026-09-25", "2026-08-13"),
      RangeError,
    );
    assert.throws(
      () => calculateInternshipWeek("2026-09-25", "2026-08-03", "2026-08-13"),
      /종료일/,
    );
  });
});
