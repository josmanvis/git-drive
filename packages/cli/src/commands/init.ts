import { existsSync, statSync, mkdirSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { resolve, join } from "path";
import prompts from "prompts";
import { saveConfig, getDriveStorePath } from "../config.js";
import { listDrives } from "../git.js";
import { GitDriveError } from "../errors.js";

// Companion repository URL
const COMPANION_REPO_URL = "https://github.com/josmanvis/git-drive.git";

// Get the current version from package.json
function getCurrentVersion(): string {
  try {
    const packageJsonPath = join(__dirname, '..', '..', 'package.json');
    const packageJson = require(packageJsonPath);
    return packageJson.version;
  } catch {
    return 'unknown';
  }
}

// Install the companion (clone git-drive repo to the drive)
function installCompanion(storePath: string): { installed: boolean; version: string; error?: string } {
  const companionRepoPath = join(storePath, 'git-drive.git');
  const companionVersionPath = join(storePath, 'companion.json');
  const currentVersion = getCurrentVersion();

  try {
    // If companion already exists, update it
    if (existsSync(companionRepoPath)) {
      try {
        execSync(`git -C "${companionRepoPath}" fetch origin`, { stdio: 'pipe' });
        execSync(`git -C "${companionRepoPath}" reset --hard origin/main`, { stdio: 'pipe' });
      } catch {
        // If update fails, remove and re-clone
        execSync(`rm -rf "${companionRepoPath}"`, { stdio: 'pipe' });
        execSync(`git clone --bare "${COMPANION_REPO_URL}" "${companionRepoPath}"`, { stdio: 'pipe' });
      }
    } else {
      // Clone the companion
      execSync(`git clone --bare "${COMPANION_REPO_URL}" "${companionRepoPath}"`, { stdio: 'pipe' });
    }

    // Write companion version info
    const companionInfo = {
      version: currentVersion,
      installedAt: new Date().toISOString(),
      repoUrl: COMPANION_REPO_URL,
    };
    writeFileSync(companionVersionPath, JSON.stringify(companionInfo, null, 2));

    return { installed: true, version: currentVersion };
  } catch (err: any) {
    return { installed: false, version: currentVersion, error: err.message };
  }
}

export async function init(args: string[]): Promise<void> {
  let drivePath: string;

  const rawPath = args[0];

  if (!rawPath) {
    // No argument provided - prompt user to select a drive
    const drives = await listDrives();

    if (drives.length === 0) {
      throw new GitDriveError(
        "No external drives found. Please connect a drive and try again."
      );
    }

    const { selectedDrive } = await prompts({
      type: "select",
      name: "selectedDrive",
      message: "Select a drive to initialize git-drive:",
      choices: drives.map((d: any) => ({
        title: `${d.filesystem} (${d.mounted}) - ${Math.round((d.available / d.blocks) * 100)}% free`,
        value: d.mounted,
      })),
    });

    if (!selectedDrive) {
      console.log("Operation cancelled.");
      return;
    }

    drivePath = resolve(selectedDrive);
  } else {
    drivePath = resolve(rawPath);
  }

  if (!existsSync(drivePath)) {
    throw new GitDriveError(
      `Path not found: ${drivePath}\nIs the drive mounted?`
    );
  }

  const stat = statSync(drivePath);
  if (!stat.isDirectory()) {
    throw new GitDriveError(`Path is not a directory: ${drivePath}`);
  }

  const storePath = getDriveStorePath(drivePath);
  if (!existsSync(storePath)) {
    mkdirSync(storePath, { recursive: true });
  }

  saveConfig({ drivePath });

  console.log(`\n✅ Git Drive initialized!`);
  console.log(`   Drive: ${drivePath}`);
  console.log(`   Store: ${storePath}`);

  // Install companion
  console.log(`\n📦 Installing Drive Companion...`);
  const companionResult = installCompanion(storePath);
  
  if (companionResult.installed) {
    console.log(`   ✅ Companion v${companionResult.version} installed!`);
    console.log(`\n   You can now use 'git-drive companion ${drivePath}' on any machine.`);
  } else {
    console.log(`   ⚠️  Failed to install companion: ${companionResult.error}`);
    console.log(`   You can still use git-drive, but companion mode is not available.`);
  }
}

// Export for use in other modules
export { installCompanion, getCurrentVersion };