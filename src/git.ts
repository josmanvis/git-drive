import { execSync } from "child_process";
import { basename } from "path";

export function git(args: string, cwd?: string): string {
  return execSync(`git ${args}`, {
    cwd,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

export function getRepoRoot(): string {
  return git("rev-parse --show-toplevel");
}

export function getProjectName(): string {
  const root = getRepoRoot();
  return basename(root);
}

export function getRemoteUrl(remoteName: string): string | null {
  try {
    return git(`remote get-url ${remoteName}`);
  } catch {
    return null;
  }
}

export function isGitRepo(): boolean {
  try {
    git("rev-parse --is-inside-work-tree");
    return true;
  } catch {
    return false;
  }
}
