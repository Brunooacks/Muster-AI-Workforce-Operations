import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const indexPath = resolve(import.meta.dirname, "..", "api-zod", "src", "generated", "types", "index.ts");
const apiClientPath = resolve(import.meta.dirname, "..", "api-client-react", "src", "generated", "api.ts");
const source = await readFile(indexPath, "utf8");
const exportLine = "export * from './getAgentValueParams';";
const replacement = "export { type GetAgentValueParams as GetAgentValueQueryInput } from './getAgentValueParams';";

if (!source.includes(exportLine) && !source.includes(replacement)) {
  throw new Error("Export de GetAgentValueParams não encontrado após codegen.");
}

await writeFile(indexPath, source.replace(exportLine, replacement));

const apiClientSource = await readFile(apiClientPath, "utf8");
await writeFile(apiClientPath, `${apiClientSource.trimEnd()}\n`);
