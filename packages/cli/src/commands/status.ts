import { existsSync, readdirSync } from "fs";
import { loadConfig, getDriveStorePath } from "../config.js";
import { isGitRepo, getProjectName, getRemoteUrl } from "../git.js";
import { GitDriveError } from "../errors.js";

export function status(_args: string[]): void {
  const config = loadConfig();

  if (!config) {
    throw new GitDriveError("No drive configured. Run: git drive init <path>");
  }

  const connected = existsSync(config.drivePath);
  console.log(
    `Drive:  ${config.drivePath} (${connected ? "connected" : "NOT CONNECTED"})`
  );

  if (!connected) return;

  const storePath = getDriveStorePath(config.drivePath);
  if (existsSync(storePath)) {
    const projects = readdirSync(storePath).filter((n) => n.endsWith(".git"));
    console.log(`Store:  ${storePath} (${projects.length} project${projects.length === 1 ? "" : "s"})`);
  } else {
    console.log(`Store:  ${storePath} (not initialized)`);
  }

  if (isGitRepo()) {
    const name = getProjectName();
    const remoteUrl = getRemoteUrl("drive");
    if (remoteUrl) {
      console.log(`Repo:   ${name} (remote configured)`);
    } else {
      console.log(`Repo:   ${name} (no drive remote)`);
    }
  }
}
