import path from "node:path";

export function startupMigrationsEnabled(value = process.env.MIGRATE_ON_START): boolean {
  return value?.trim().toLowerCase() === "true";
}

export async function runStartupMigrations(): Promise<void> {
  if (!startupMigrationsEnabled()) return;
  const migrationsFolder = path.resolve(process.env.DB_MIGRATIONS_DIR?.trim() || "migrations");
  const [{ migrate }, { db }] = await Promise.all([
    import("drizzle-orm/node-postgres/migrator"),
    import("@workspace/db"),
  ]);
  await migrate(db, { migrationsFolder });
}
