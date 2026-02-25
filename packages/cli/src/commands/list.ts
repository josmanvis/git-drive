import { readdirSync, statSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { getDiskInfo } from "node-disk-info";

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

export async function list(_args: string[]): Promise<void> {
  console.log("Git Drive - Connected Drives\n");

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

  if (externalDrives.length === 0) {
    console.log("No external drives detected.");
    console.log("\nConnect an external drive and try again.");
    return;
  }

  // Load links to show which drives are registered
  const links = loadLinks();
  const registeredMountpoints = new Set(Object.values(links).map(l => l.mountpoint));

  for (const drive of externalDrives) {
    const mp = drive.mounted;
    const gitDrivePath = getGitDrivePath(mp);
    const hasGitDrive = existsSync(gitDrivePath);
    const isRegistered = registeredMountpoints.has(mp);

    // Count repos on this drive
    let repoCount = 0;
    if (hasGitDrive) {
      try {
        const entries = readdirSync(gitDrivePath).filter(n => n.endsWith(".git") || existsSync(join(gitDrivePath, n, "HEAD")));
        repoCount = entries.length;
      } catch {}
    }

    // Format size
    const sizeGB = drive.blocks ? ((parseInt(drive.blocks) * 1024) / (1024 * 1024 * 1024)).toFixed(1) : "?";
    
    // Status indicator
    const status = hasGitDrive ? "✓ registered" : "○ not registered";
    
    console.log(`  ${mp}`);
    console.log(`    Size: ${sizeGB} GB`);
    console.log(`    Status: ${status}`);
    console.log(`    Repositories: ${repoCount}`);
    console.log();
  }

  console.log(`\n${externalDrives.length} drive${externalDrives.length === 1 ? "" : "s"} detected.`);
  console.log("\nRun 'git-drive link' to link a repo to a drive.");
}