import { existsSync, readFileSync, rmSync } from "node:fs";
import { createClerkClient } from "@clerk/backend";
import { E2E_AUTH_FILE, E2E_FIXTURE_FILE, type E2EFixture } from "./fixtures";
import { applyClerkTestingEnvironment, clerkE2EEnvironment, e2eDatabaseUrl } from "./runtime";

function readFixture(): E2EFixture | null {
  if (!existsSync(E2E_FIXTURE_FILE)) return null;
  return JSON.parse(readFileSync(E2E_FIXTURE_FILE, "utf8")) as E2EFixture;
}

async function deleteLocalTenants(externalIds: string[]) {
  // O pool é carregado depois de DATABASE_URL ser definido, para que o teardown
  // não dependa do processo do servidor web que o Playwright já encerrou.
  process.env.DATABASE_URL = e2eDatabaseUrl();
  const [{ db, organizations, pool }, { inArray: drizzleInArray }] = await Promise.all([
    import("@workspace/db"),
    import("drizzle-orm"),
  ]);
  try {
    await db.delete(organizations).where(drizzleInArray(organizations.externalId, externalIds));
  } finally {
    await pool.end();
  }
}

export default async function globalTeardown(): Promise<void> {
  const fixture = readFixture();
  if (!fixture) return;

  const environment = clerkE2EEnvironment();
  applyClerkTestingEnvironment(environment);
  const client = createClerkClient({ secretKey: environment.secretKey });
  const organizationIds = fixture.organizations.map((organization) => organization.id);
  const failures: string[] = [];

  try {
    await deleteLocalTenants(organizationIds);
  } catch (error) {
    failures.push(`banco local: ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const organizationId of organizationIds) {
    try {
      await client.organizations.deleteOrganization(organizationId);
    } catch (error) {
      // Uma execução pode morrer depois de apagar a organização. A repetição do
      // cleanup é segura e não mascara outros erros de infraestrutura.
      const status = (error as { status?: number })?.status;
      if (status !== 404) failures.push(`organização ${organizationId}: ${String(error)}`);
    }
  }

  try {
    const user = await client.users.getUser(fixture.user.id);
    if (user.privateMetadata?.musterE2E === true) {
      await client.users.deleteUser(user.id);
    } else {
      failures.push("usuário Clerk não tinha a marca musterE2E e não foi removido");
    }
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status !== 404) failures.push(`usuário Clerk: ${String(error)}`);
  } finally {
    rmSync(E2E_AUTH_FILE, { force: true });
    rmSync(E2E_FIXTURE_FILE, { force: true });
  }

  if (failures.length > 0) {
    throw new Error(`Cleanup E2E incompleto: ${failures.join("; ")}`);
  }
}
