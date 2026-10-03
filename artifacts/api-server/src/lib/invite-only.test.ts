import { describe, expect, it } from "vitest";
import { inviteOnlyEnabled } from "./invite-only";

describe("inviteOnlyEnabled", () => {
  it("ativa somente para o valor explícito true", () => {
    expect(inviteOnlyEnabled({ MUSTER_INVITE_ONLY: " true " })).toBe(true);
    expect(inviteOnlyEnabled({ MUSTER_INVITE_ONLY: "1" })).toBe(false);
    expect(inviteOnlyEnabled({})).toBe(false);
  });
});
