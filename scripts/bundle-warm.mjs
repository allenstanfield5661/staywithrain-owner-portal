import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outfile = path.join(root, "netlify/functions/warm-calendar.mjs");
fs.mkdirSync(path.dirname(outfile), { recursive: true });

const result = spawnSync(
  "npx",
  [
    "-y",
    "esbuild",
    path.join(root, "netlify/functions-src/warm-calendar.ts"),
    "--bundle",
    "--platform=node",
    "--format=esm",
    `--outfile=${outfile}`,
    `--alias:@=${root}`,
    "--external:@netlify/blobs",
    "--external:next/cache",
    "--log-level=info",
  ],
  { cwd: root, stdio: "inherit" },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
