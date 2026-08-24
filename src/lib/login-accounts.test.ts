import assert from "node:assert/strict";
import test from "node:test";
import { getDemoLoginAccounts, initialData } from "../components/app-data";

test("login shortcuts reflect a renamed demo administrator", () => {
  const profiles = initialData.profiles.map((profile) =>
    profile.id === "admin-1"
      ? { ...profile, name: "변경된 관리자", email: "renamed.admin@example.com" }
      : profile,
  );

  const administrator = getDemoLoginAccounts(profiles).find((account) => account.role === "ADMIN");

  assert.equal(administrator?.name, "변경된 관리자");
  assert.equal(administrator?.email, "renamed.admin@example.com");
});

test("login shortcuts use another active account only when the canonical account is inactive", () => {
  const profiles = [
    ...initialData.profiles.map((profile) =>
      profile.id === "admin-1" ? { ...profile, isActive: false } : profile,
    ),
    {
      id: "admin-2",
      name: "대체 관리자",
      email: "backup.admin@example.com",
      role: "ADMIN" as const,
      department: "인사팀",
      isActive: true,
    },
  ];

  const administrator = getDemoLoginAccounts(profiles).find((account) => account.role === "ADMIN");

  assert.equal(administrator?.id, "admin-2");
  assert.equal(administrator?.name, "대체 관리자");
});
