import type {
  AdminSuggestionView,
  SubmitterSuggestionView,
  SuggestionRecord,
  UserId,
} from "./types";

/** Returns the deliberately identity-free representation safe for admin APIs. */
export function toAdminSuggestion(record: SuggestionRecord): AdminSuggestionView {
  return {
    id: record.id,
    title: record.title,
    content: record.content,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    isRead: record.readAt !== undefined,
  };
}

export function toAdminSuggestions(
  records: readonly SuggestionRecord[],
): readonly AdminSuggestionView[] {
  return records.map(toAdminSuggestion);
}

/** Returns only the requesting intern's suggestion; other interns receive null. */
export function toSubmitterSuggestion(
  record: SuggestionRecord,
  requesterId: UserId,
): SubmitterSuggestionView | null {
  if (record.submitterId !== requesterId) {
    return null;
  }

  return {
    ...toAdminSuggestion(record),
    canCancel: record.status === "ACTIVE",
  };
}

export function toSubmitterSuggestions(
  records: readonly SuggestionRecord[],
  requesterId: UserId,
): readonly SubmitterSuggestionView[] {
  return records.flatMap((record) => {
    const view = toSubmitterSuggestion(record, requesterId);
    return view === null ? [] : [view];
  });
}
