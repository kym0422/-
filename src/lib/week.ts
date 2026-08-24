import type { CohortStatus, IsoDate } from "./types";

const DAY_IN_MS = 24 * 60 * 60 * 1_000;

export type DateInput = Date | IsoDate;

export interface InternshipWeek {
  status: CohortStatus;
  week: number;
  totalWeeks: number;
  label: string;
}

function toUtcDay(value: DateInput): number {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new RangeError("유효하지 않은 날짜입니다.");
    }
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new RangeError("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDay = Date.UTC(year, month - 1, day);
  const parsed = new Date(utcDay);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new RangeError("유효하지 않은 날짜입니다.");
  }
  return utcDay;
}

/**
 * Calculates the inclusive internship week. Days 1-7 are week 1, days 8-14
 * are week 2. A date after the inclusive end date is marked completed.
 */
export function calculateInternshipWeek(
  startDate: DateInput,
  endDate: DateInput,
  currentDate: DateInput = new Date(),
): InternshipWeek {
  const start = toUtcDay(startDate);
  const end = toUtcDay(endDate);
  const current = toUtcDay(currentDate);

  if (end < start) {
    throw new RangeError("실습 종료일은 시작일보다 빠를 수 없습니다.");
  }

  const totalDays = Math.floor((end - start) / DAY_IN_MS) + 1;
  const totalWeeks = Math.ceil(totalDays / 7);

  if (current < start) {
    return { status: "UPCOMING", week: 0, totalWeeks, label: "실습 시작 전" };
  }
  if (current > end) {
    return { status: "COMPLETED", week: totalWeeks, totalWeeks, label: "실습 종료" };
  }

  const elapsedDays = Math.floor((current - start) / DAY_IN_MS);
  const week = Math.floor(elapsedDays / 7) + 1;
  return { status: "ACTIVE", week, totalWeeks, label: `${week}주차` };
}

export const getInternshipWeek = calculateInternshipWeek;
