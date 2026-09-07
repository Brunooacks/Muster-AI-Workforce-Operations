import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const episodes = JSON.parse(readFileSync(join(projectDir, "onboarding/episodes.json"), "utf8"));
const renderDir = join(projectDir, "renders/onboarding");
const publicDir = resolve(projectDir, "../../artifacts/cohort/public/onboarding");

mkdirSync(renderDir, { recursive: true });
mkdirSync(publicDir, { recursive: true });

for (const episode of episodes) {
  const output = join(renderDir, `${episode.id}.mp4`);
  const { id, ...episodeVariables } = episode;
  const variables = JSON.stringify(episodeVariables);
  const result = spawnSync(
    "npx",
    [
      "--yes",
      "hyperframes@0.8.29",
      "render",
      "--composition",
      "compositions/onboarding.html",
      "--quality",
      "high",
      "--strict",
      "--workers",
      "2",
      "--variables",
      variables,
      "--output",
      output,
    ],
    { cwd: projectDir, stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
  copyFileSync(output, join(publicDir, `${id}.mp4`));
  copyFileSync(join(projectDir, episode.assetPrimary), join(publicDir, `${id}.png`));
}
