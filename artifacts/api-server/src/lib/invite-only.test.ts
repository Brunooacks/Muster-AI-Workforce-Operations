import { describe, expect, it } from "vitest";
import { inviteOnlyEnabled } from "./invite-only";

describe("inviteOnlyEnabled", () => {
  it("fica ativo quando a variável não está definida (fail closed)", () => {
    expect(inviteOnlyEnabled({})).toBe(true);
  });

  it("só desativa com o valor explícito false", () => {
    expect(inviteOnlyEnabled({ MUSTER_INVITE_ONLY: "false" })).toBe(false);
    expect(inviteOnlyEnabled({ MUSTER_INVITE_ONLY: " FALSE " })).toBe(false);
  });

  it("mantém ativo para true, vazio ou valores malformados", () => {
    expect(inviteOnlyEnabled({ MUSTER_INVITE_ONLY: " true " })).toBe(true);
    expect(inviteOnlyEnabled({ MUSTER_INVITE_ONLY: "" })).toBe(true);
    expect(inviteOnlyEnabled({ MUSTER_INVITE_ONLY: "0" })).toBe(true);
    expect(inviteOnlyEnabled({ MUSTER_INVITE_ONLY: "no" })).toBe(true);
  });
});
