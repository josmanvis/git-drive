import { execSync } from "child_process";
import { basename } from "path";
import { getDiskInfo } from "node-disk-info";

export function git(args: string, cwd?: string): string {
  return execSync(`git ${args}`, {
    cwd,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

export async function listDrives(): Promise<any[]> {
  const drives = await getDiskInfo();
  return drives.filter((d: any) => {
    const mp = d.mounted;
    if (!mp) return false;
    if (mp === "/" || mp === "100%") return false;

    // Exclude temporary and system paths on all platforms
    if (mp.startsWith("/var/") || mp.startsWith("/private/var/") || mp.startsWith("/tmp") || mp.startsWith("/private/tmp")) return false;
    if (mp.includes("TemporaryItems") || mp.includes("NSIRD_")) return false;
    if (mp.startsWith("/System/") || mp.startsWith("/Library/")) return false;

    if (process.platform === "darwin") {
      return mp.startsWith("/Volumes/") && !mp.startsWith("/Volumes/Recovery");
    }

    if (mp.startsWith("/sys") || mp.startsWith("/proc") || mp.startsWith("/run") || mp.startsWith("/snap") || mp.startsWith("/boot")) return false;
    if (d.filesystem === "tmpfs" || d.filesystem === "devtmpfs" || d.filesystem === "udev" || d.filesystem === "overlay") return false;

    return true;
  });
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
