import assert from "node:assert/strict";
import test from "node:test";
import {
  createTenantScope,
  createTenantScopeKey,
  hasTenantScopeChanged,
} from "./tenant-scope";
import { createAdoptionProgressStorageKey, createOnboardingStorageKey } from "./onboarding";

test("creates a normalized tenant scope only with user and organization", () => {
  assert.deepEqual(createTenantScope(" user_1 ", " org_1 "), {
    userId: "user_1",
    organizationId: "org_1",
    kind: "company",
  });
  assert.equal(createTenantScope(null, "org_1"), null);
  assert.equal(createTenantScope(" ", "org_1"), null);
});

test("creates collision-safe keys for user and organization", () => {
  assert.equal(
    createTenantScopeKey("user:one", "org/two"),
    "user%3Aone:org%2Ftwo",
  );
  assert.notEqual(
    createTenantScopeKey("user_1", "org_1"),
    createTenantScopeKey("user_1", "org_2"),
  );
});

test("detects user and organization scope changes", () => {
  const first = createTenantScopeKey("user_1", "org_1");
  const second = createTenantScopeKey("user_1", "org_2");

  assert.equal(hasTenantScopeChanged(first, first), false);
  assert.equal(hasTenantScopeChanged(first, second), true);
  assert.equal(hasTenantScopeChanged(undefined, first), true);
});

test("scopes onboarding completion by both user and organization", () => {
  const first = createOnboardingStorageKey("user_1", "org_1");
  const second = createOnboardingStorageKey("user_1", "org_2");

  assert.equal(first, "cohort:onboarding:user_1:org_1");
  assert.notEqual(first, second);
  assert.equal(createOnboardingStorageKey("user_1", null), "cohort:onboarding:user_1:personal%3Auser_1");
});

test("scopes adoption progress by both user and organization", () => {
  assert.equal(
    createAdoptionProgressStorageKey("user_1", "org_1"),
    "cohort:adoption-progress:user_1:org_1",
  );
  assert.equal(createAdoptionProgressStorageKey("user_1", null), "cohort:adoption-progress:user_1:personal%3Auser_1");
});

test("without an active organization the scope is the user's personal account", () => {
  assert.deepEqual(createTenantScope("user_1", null), {
    userId: "user_1",
    organizationId: "personal:user_1",
    kind: "personal",
  });
});

test("personal and company accounts never share a cache scope", () => {
  const personal = createTenantScopeKey("user_1", null);
  const company = createTenantScopeKey("user_1", "org_1");
  assert.notEqual(personal, company);
  assert.equal(hasTenantScopeChanged(company, personal), true);
  assert.notEqual(createTenantScopeKey("user_1", null), createTenantScopeKey("user_2", null));
});
