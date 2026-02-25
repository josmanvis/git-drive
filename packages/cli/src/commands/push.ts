import { git, getRemoteUrl, isGitRepo } from "../git.js";
import { GitDriveError } from "../errors.js";
import prompts from "prompts";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export async function push(_args: string[]): Promise<void> {
  if (!isGitRepo()) {
    throw new GitDriveError("Not in a git repository.");
  }

  const existingUrl = getRemoteUrl("gd");
  if (!existingUrl) {
    throw new GitDriveError("No git-drive linked for this project. Please run 'git-drive link' first.");
  }

  try {
    const currentBranch = git("branch --show-current") || "HEAD";

    const { pushMode } = await prompts({
      type: "select",
      name: "pushMode",
      message: `Pushing to ${existingUrl}\nSelect what to branch to push:`,
      choices: [
        { title: `Current branch only (${currentBranch})`, value: "current" },
        { title: "All branches & tags", value: "all" }
      ]
    });

    if (!pushMode) return;

    if (pushMode === "current") {
      console.log(`\nPushing ${currentBranch}...`);
      git(`push gd ${currentBranch}`);
      console.log(`✅ Successfully pushed ${currentBranch} to git-drive.`);
    } else {
      console.log("\nPushing all branches and tags...");
      git("push gd --all");
      git("push gd --tags");
      console.log(`✅ Successfully pushed all branches and tags to git-drive.`);
    }

    // Write context to a central pushlog safely inside the git-drive repo folder
    try {
      if (fs.existsSync(existingUrl)) {
        const payload = {
          date: new Date().toISOString(),
          computer: os.hostname(),
          user: os.userInfo().username,
          localDir: process.cwd(),
          mode: pushMode,
        };
        const logFile = path.join(existingUrl, "git-drive-pushlog.json");
        fs.appendFileSync(logFile, JSON.stringify(payload) + "\n", "utf-8");
      }
    } catch {
      // Intentionally swallow telemetry tracking errors
    }

  } catch (err: any) {
    throw new GitDriveError(`Failed to push to drive. Make sure the drive is connected.\n${err.message}`);
  }
}
