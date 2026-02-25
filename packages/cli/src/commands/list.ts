import { readdirSync, statSync } from "fs";
import { join } from "path";
import { requireConfig, assertDriveMounted, getDriveStorePath } from "../config.js";
import { existsSync } from "fs";

export function list(_args: string[]): void {
  const config = requireConfig();
  assertDriveMounted(config.drivePath);

  const storePath = getDriveStorePath(config.drivePath);

  if (!existsSync(storePath)) {
    console.log("No projects on drive.");
    return;
  }

  const entries = readdirSync(storePath).filter((name) =>
    name.endsWith(".git")
  );

  if (entries.length === 0) {
    console.log("No projects on drive.");
    return;
  }

  console.log(`Projects on ${config.drivePath}:\n`);

  for (const entry of entries) {
    const name = entry.replace(/\.git$/, "");
    const entryPath = join(storePath, entry);
    const stat = statSync(entryPath);
    const date = stat.mtime.toISOString().split("T")[0];
    console.log(`  ${name.padEnd(30)} ${date}`);
  }

  console.log(`\n${entries.length} project${entries.length === 1 ? "" : "s"}`);
}
