import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { getDiskInfo } from "node-disk-info";
import { isGitRepo, getProjectName, getRemoteUrl } from "../git.js";

interface LinkConfig {
  mountpoint: string;
  repoName: string;
  linkedAt: string;
}

function loadLinks(): Record<string, LinkConfig> {
  const linksFile = join(homedir(), ".config", "git-drive", "links.json");
  if (!existsSync(linksFile)) return {};
  try {
    return JSON.parse(readFileSync(linksFile, "utf-8"));
  } catch {
    return {};
  }
}

function getGitDrivePath(mountpoint: string): string {
  return join(mountpoint, ".git-drive");
}

export async function status(_args: string[]): Promise<void> {
  console.log("Git Drive Status\n");

  // Get all connected drives
  let drives: any[] = [];
  try {
    drives = await getDiskInfo();
  } catch (err) {
    console.error("Error detecting drives:", err);
    return;
  }

  // Filter to external/removable drives
  const externalDrives = drives.filter((d: any) => {
    const mp = d.mounted;
    if (!mp) return false;
    if (mp === "/" || mp === "100%") return false;

    if (process.platform === "darwin") {
      return mp.startsWith("/Volumes/") && !mp.startsWith("/Volumes/Recovery");
    }

    if (mp.startsWith("/sys") || mp.startsWith("/proc") || mp.startsWith("/run") || mp.startsWith("/snap") || mp.startsWith("/boot")) return false;
    if (d.filesystem === "tmpfs" || d.filesystem === "devtmpfs" || d.filesystem === "udev" || d.filesystem === "overlay") return false;

    return true;
  });

  // Load links
  const links = loadLinks();
  const linkEntries = Object.entries(links);

  // Show connected drives with git-drive
  console.log("=== Connected Drives ===\n");
  
  if (externalDrives.length === 0) {
    console.log("No external drives connected.\n");
  } else {
    for (const drive of externalDrives) {
      const mp = drive.mounted;
      const gitDrivePath = getGitDrivePath(mp);
      const hasGitDrive = existsSync(gitDrivePath);

      if (hasGitDrive) {
        const entries = readdirSync(gitDrivePath).filter(n => n.endsWith(".git") || existsSync(join(gitDrivePath, n, "HEAD")));
        console.log(`✓ ${mp}`);
        console.log(`  ${entries.length} repo${entries.length === 1 ? "" : "s"} backed up`);
      } else {
        console.log(`○ ${mp} (not initialized)`);
      }
    }
    console.log();
  }

  // Show registered drives (from links)
  console.log("=== Registered Repositories ===\n");
  
  if (linkEntries.length === 0) {
    console.log("No repositories linked to drives yet.");
    console.log("Run 'git-drive link' to link a repository.\n");
  } else {
    for (const [localPath, link] of linkEntries) {
      const stillConnected = existsSync(link.mountpoint);
      const localExists = existsSync(localPath);
      
      console.log(`${localPath}`);
      console.log(`  → ${link.mountpoint} (${link.repoName})`);
      console.log(`  Drive: ${stillConnected ? "connected" : "NOT CONNECTED"}`);
      console.log(`  Local: ${localExists ? "exists" : "NOT FOUND"}`);
      console.log();
    }
  }

  // Show current repo status if in a git repo
  if (isGitRepo()) {
    console.log("=== Current Repository ===\n");
    const name = getProjectName();
    const remoteUrl = getRemoteUrl("gd");
    
    console.log(`Repository: ${name}`);
    if (remoteUrl) {
      console.log(`Remote 'gd': ${remoteUrl}`);
      
      // Check if this repo is linked
      const cwd = process.cwd();
      const link = links[cwd];
      if (link) {
        console.log(`Linked to: ${link.mountpoint}`);
      }
    } else {
      console.log(`No 'gd' remote configured.`);
      console.log("Run 'git-drive link' to set up backup.");
    }
    console.log();
  }

  // Server status hint
  console.log("=== Server ===\n");
  console.log("Web UI: http://localhost:4483");
  console.log("Run 'git-drive server' to start the web interface.\n");
}