import { defineConfig } from "drizzle-kit";
import path from "path";

// `generate` only reads the schema + snapshots in ./drizzle and never connects,
// so it must work offline (CI, contributors without a DB). A real DATABASE_URL
// is only needed for `push`/`migrate`, which will fail loudly on connect if the
// placeholder below is left in place.
const url =
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "./drizzle"),
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
