import { readFileSync } from "node:fs";
import path from "node:path";

export type E2EAgentKey =
  | "sofia"
  | "vega"
  | "approve"
  | "adjust"
  | "reject";

export interface E2EAgentFixture {
  id: string;
  slug: string;
  name: string;
}

export interface E2EFixture {
  userId: string;
  organizationId: string;
  agents: Record<E2EAgentKey, E2EAgentFixture>;
}

export const E2E_AUTH_FILE = path.resolve(
  import.meta.dirname,
  "../playwright/.clerk/user.json",
);

export const E2E_FIXTURE_FILE = path.resolve(
  import.meta.dirname,
  "../playwright/.clerk/fixture.json",
);

export function loadE2EFixture(): E2EFixture {
  const fixture = JSON.parse(readFileSync(E2E_FIXTURE_FILE, "utf8")) as Partial<E2EFixture>;
  const keys: E2EAgentKey[] = ["sofia", "vega", "approve", "adjust", "reject"];
  for (const key of keys) {
    const agent = fixture.agents?.[key];
    if (!agent || typeof agent.id !== "string" || typeof agent.slug !== "string" || typeof agent.name !== "string") {
      throw new Error(`Fixture E2E inválido: agente ${key} não possui id, slug e name.`);
    }
  }
  if (typeof fixture.userId !== "string" || typeof fixture.organizationId !== "string") {
    throw new Error("Fixture E2E inválido: usuário ou organização ausente.");
  }
  return fixture as E2EFixture;
}
