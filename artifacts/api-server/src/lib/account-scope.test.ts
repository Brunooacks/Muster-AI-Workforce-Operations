import { describe, expect, it } from "vitest";
import {
  isPersonalExternalId,
  personalExternalId,
  personalSlug,
  resolveAccountKind,
} from "./account-scope";

describe("account scope", () => {
  it("empresa quando há organização ativa, pessoal quando não há", () => {
    expect(resolveAccountKind("org_abc")).toBe("company");
    expect(resolveAccountKind(null)).toBe("personal");
    expect(resolveAccountKind("")).toBe("personal");
  });

  it("externalId pessoal nunca colide com um org_id do provedor", () => {
    const ext = personalExternalId("user_1");
    expect(ext).toBe("personal:user_1");
    expect(isPersonalExternalId(ext)).toBe(true);
    expect(isPersonalExternalId("org_1")).toBe(false);
    expect(isPersonalExternalId(null)).toBe(false);
  });

  it("recusa userId vazio", () => {
    expect(() => personalExternalId("  ")).toThrow();
  });

  it("slug pessoal é estável e seguro", () => {
    expect(personalSlug("user_2AbC")).toBe("pessoal-user-2abc");
    expect(personalSlug("___")).toBe("pessoal-conta");
  });
});
