import { rmSync } from "fs";
import { requireConfig, assertDriveMounted } from "../config.js";
import { git, getRepoRoot, getProjectName, isGitRepo } from "../git.js";
import { push } from "./push.js";
import { GitDriveError } from "../errors.js";

export function archive(args: string[]): void {
  if (!isGitRepo()) {
    throw new GitDriveError("Not in a git repository.");
  }

  const force = args.includes("--force");

  // Check for uncommitted changes
  if (!force) {
    const status = git("status --porcelain");
    if (status) {
      throw new GitDriveError(
        "Working tree has uncommitted changes.\nCommit first or use --force to archive anyway."
      );
    }
  }

  const config = requireConfig();
  assertDriveMounted(config.drivePath);

  const projectName = getProjectName();
  const repoRoot = getRepoRoot();

  // Push first
  push([]);

  // Remove local copy
  process.chdir("..");
  rmSync(repoRoot, { recursive: true, force: true });

  console.log(`Archived: ${projectName}`);
  console.log(`Restore with: git drive restore ${projectName}`);
}
