import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { requireMusterSessionToken } from "./muster-session";

describe("requireMusterSessionToken", () => {
  it("returns a configured Clerk session token", () => {
    expect(
      requireMusterSessionToken({ MUSTER_AUTH_TOKEN: "  clerk-session  " }),
    ).toBe("clerk-session");
  });

  it("fails closed without a session token", () => {
    expect(() => requireMusterSessionToken({})).toThrow(
      "MUSTER_AUTH_TOKEN ou --token-file é obrigatório",
    );
  });

  it("lê o token de arquivo sem persistir no repositório", () => {
    const directory = mkdtempSync(join(tmpdir(), "muster-session-"));
    const file = join(directory, "token");
    writeFileSync(file, "  clerk-from-file  ");
    expect(requireMusterSessionToken({}, file)).toBe("clerk-from-file");
  });
});
