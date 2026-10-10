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
  runId: string;
  user: { id: string; email: string };
  organizations: Array<{ id: string; name: string }>;
  agents: Record<E2EAgentKey, E2EAgentFixture>;
  areas: Array<{ id: string; name: string }>;
  isolatedAgent: E2EAgentFixture;
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
  if (
    typeof fixture.runId !== "string" ||
    typeof fixture.user?.id !== "string" ||
    typeof fixture.user.email !== "string" ||
    !Array.isArray(fixture.organizations) ||
    fixture.organizations.length < 2 ||
    !Array.isArray(fixture.areas) ||
    fixture.areas.length < 2 ||
    !fixture.isolatedAgent ||
    typeof fixture.isolatedAgent.id !== "string"
  ) {
    throw new Error("Fixture E2E inválido: usuário, tenants ou áreas ausentes.");
  }
  return fixture as E2EFixture;
}
