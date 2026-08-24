import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { DEMO_IDS, demoSuggestions } from "./demo-data";
import {
  toAdminSuggestion,
  toAdminSuggestions,
  toSubmitterSuggestion,
  toSubmitterSuggestions,
} from "./suggestions";
import type { SuggestionRecord } from "./types";

const suggestion = demoSuggestions[0];
assert.ok(suggestion);

describe("admin suggestion anonymization", () => {
  test("does not expose submitter identity in the object or serialized payload", () => {
    const view = toAdminSuggestion(suggestion);
    const keys = Object.keys(view);
    const payload = JSON.stringify(view);

    assert.equal(keys.includes("submitterId"), false);
    assert.equal(keys.includes("name"), false);
    assert.equal(keys.includes("email"), false);
    assert.equal(payload.includes(suggestion.submitterId), false);
    assert.deepEqual(view, {
      id: suggestion.id,
      title: suggestion.title,
      content: suggestion.content,
      status: suggestion.status,
      createdAt: suggestion.createdAt,
      updatedAt: suggestion.updatedAt,
      isRead: true,
    });
  });

  test("anonymizes every record in list projections", () => {
    const payload = JSON.stringify(toAdminSuggestions(demoSuggestions));
    for (const record of demoSuggestions) {
      assert.equal(payload.includes(record.submitterId), false);
    }
  });

  test("copies only explicitly selected fields even if storage gains identity data", () => {
    const recordWithAccidentalIdentity = {
      ...suggestion,
      submitterName: "노출되면 안 되는 이름",
      submitterEmail: "private@example.com",
    } satisfies SuggestionRecord & { submitterName: string; submitterEmail: string };

    const payload = JSON.stringify(toAdminSuggestion(recordWithAccidentalIdentity));
    assert.equal(payload.includes("노출되면 안 되는 이름"), false);
    assert.equal(payload.includes("private@example.com"), false);
  });
});

describe("submitter suggestion projection", () => {
  test("returns a suggestion to its owner without returning an identity field", () => {
    const view = toSubmitterSuggestion(suggestion, DEMO_IDS.internOne);
    assert.ok(view);
    assert.equal(view.canCancel, true);
    assert.equal("submitterId" in view, false);
  });

  test("does not return another intern's suggestion", () => {
    assert.equal(toSubmitterSuggestion(suggestion, DEMO_IDS.internTwo), null);
    const ownList = toSubmitterSuggestions(demoSuggestions, DEMO_IDS.internOne);
    assert.equal(ownList.length, 1);
    assert.equal(ownList[0]?.id, suggestion.id);
  });

  test("does not allow cancellation after a suggestion has been canceled", () => {
    const canceled = demoSuggestions.find((item) => item.status === "CANCELED");
    assert.ok(canceled);
    const view = toSubmitterSuggestion(canceled, canceled.submitterId);
    assert.ok(view);
    assert.equal(view.canCancel, false);
  });
});
