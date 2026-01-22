import { existsSync } from "fs";
import { join } from "path";
import { requireConfig, assertDriveMounted, getDriveStorePath } from "../config.js";
import { git, getProjectName, getRemoteUrl, isGitRepo } from "../git.js";
import { GitDriveError } from "../errors.js";

export function push(_args: string[]): void {
  if (!isGitRepo()) {
    throw new GitDriveError("Not in a git repository.");
  }

  const config = requireConfig();
  assertDriveMounted(config.drivePath);

  const projectName = getProjectName();
  const storePath = getDriveStorePath(config.drivePath);
  const bareRepoPath = join(storePath, `${projectName}.git`);

  // Create bare repo if it doesn't exist
  if (!existsSync(bareRepoPath)) {
    git(`init --bare ${bareRepoPath}`);
    console.log(`Created bare repo: ${bareRepoPath}`);
  }

  // Add or update remote
  const existingUrl = getRemoteUrl("drive");
  if (!existingUrl) {
    git(`remote add drive ${bareRepoPath}`);
  } else if (existingUrl !== bareRepoPath) {
    console.log(`Updating drive remote: ${existingUrl} -> ${bareRepoPath}`);
    git(`remote set-url drive ${bareRepoPath}`);
  }

  // Push all branches and tags
  git("push drive --all");
  git("push drive --tags");

  console.log(`Pushed ${projectName} to drive.`);
}
