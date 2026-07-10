import { defineConfig } from "drizzle-kit";

// `generate` only reads the schema + snapshots in ./drizzle and never connects,
// so it must work offline (CI, contributors without a DB). A real DATABASE_URL
// is only needed for `push`/`migrate`, which will fail loudly on connect if the
// placeholder below is left in place.
const url =
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  // Paths are relative to this package (all db scripts run with cwd=lib/db):
  // drizzle-kit mishandles absolute `out` paths when reading back snapshots.
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
