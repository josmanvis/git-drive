import { existsSync } from "fs";
import { join, resolve } from "path";
import { requireConfig, assertDriveMounted, getDriveStorePath } from "../config.js";
import { git } from "../git.js";
import { GitDriveError } from "../errors.js";

export function restore(args: string[]): void {
  const projectName = args[0];
  const targetDir = args[1] || projectName;

  if (!projectName) {
    throw new GitDriveError("Usage: git drive restore <project-name> [target-dir]");
  }

  const config = requireConfig();
  assertDriveMounted(config.drivePath);

  const storePath = getDriveStorePath(config.drivePath);
  const bareRepoPath = join(storePath, `${projectName}.git`);

  if (!existsSync(bareRepoPath)) {
    throw new GitDriveError(`Project '${projectName}' not found on drive.`);
  }

  const targetPath = resolve(targetDir);
  if (existsSync(targetPath)) {
    throw new GitDriveError(`Directory already exists: ${targetPath}`);
  }

  git(`clone ${bareRepoPath} ${targetPath}`);

  // Rename origin to drive so the remote stays consistent
  git("remote rename origin drive", targetPath);

  console.log(`Restored ${projectName} into ${targetPath}`);
}
