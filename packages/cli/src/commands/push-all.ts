import { handleError } from "../errors.js";
import { saveLink } from "../config.js";
import { git, getRemoteUrl, getProjectName, listDrives } from "../git.js";
import prompts from "prompts";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface ScanResult {
  gitRepos: string[];
  nonGitProjects: string[];
}

interface BackupResult {
  name: string;
  status: "success" | "skipped" | "error" | "initialized";
  message?: string;
  branches?: number;
  tags?: number;
}

// Scan a directory and categorize subdirectories as git repos or non-git projects
function scanDirectory(dir: string): ScanResult {
  const gitRepos: string[] = [];
  const nonGitProjects: string[] = [];

  if (!fs.existsSync(dir)) {
    return { gitRepos, nonGitProjects };
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    // Skip hidden directories
    if (entry.name.startsWith(".")) continue;

    const fullPath = path.join(dir, entry.name);
    const gitPath = path.join(fullPath, ".git");

    if (fs.existsSync(gitPath)) {
      gitRepos.push(fullPath);
    } else {
      // Check if it's a project-like directory (has files, not empty)
      const subEntries = fs.readdirSync(fullPath);
      if (subEntries.length > 0) {
        nonGitProjects.push(fullPath);
      }
    }
  }

  return { gitRepos, nonGitProjects };
}

// Check if a directory is a git repository
function isGitRepo(dir: string): boolean {
  return fs.existsSync(path.join(dir, ".git"));
}

// Initialize a new git repository
function initGitRepo(dir: string): boolean {
  try {
    git("init", dir);
    return true;
  } catch {
    return false;
  }
}

// Check if there are untracked files
function hasUntrackedFiles(dir: string): boolean {
  try {
    const status = git("status --porcelain", dir);
    return status.length > 0;
  } catch {
    return false;
  }
}

// Create initial commit
function createInitialCommit(dir: string): boolean {
  try {
    git("add -A", dir);
    git('commit -m "Initial commit"', dir);
    return true;
  } catch {
    return false;
  }
}

// Count branches and tags
function countBranchesAndTags(repoPath: string): { branches: number; tags: number } {
  try {
    const branches = git("branch --list", repoPath).split("\n").filter(b => b.trim()).length;
    const tags = git("tag --list", repoPath).split("\n").filter(t => t.trim()).length;
    return { branches, tags };
  } catch {
    return { branches: 0, tags: 0 };
  }
}

// Link a repo to a drive
async function linkRepo(
  repoPath: string,
  driveMount: string,
  createNew: boolean = true
): Promise<{ success: boolean; message?: string }> {
  const gitDrivePath = path.join(driveMount, ".git-drive");
  
  if (!fs.existsSync(gitDrivePath)) {
    return { success: false, message: "Drive not initialized" };
  }

  const projectName = path.basename(repoPath);
  const repoName = projectName.endsWith(".git") ? projectName : `${projectName}.git`;
  const finalRepoPath = path.join(gitDrivePath, repoName);

  // Check if remote 'gd' already exists
  let gdExists = false;
  try {
    git("remote get-url gd", repoPath);
    gdExists = true;
  } catch {
    // Remote does not exist
  }

  if (gdExists) {
    // Check if it points to the same drive
    const existingUrl = getRemoteUrl("gd");
    if (existingUrl && existingUrl.startsWith(driveMount)) {
      return { success: true, message: "Already linked to this drive" };
    }
    // Update to new drive
    git(`remote set-url gd "${finalRepoPath}"`, repoPath);
    saveLink(repoPath, driveMount, repoName);
    return { success: true, message: "Updated link to new drive" };
  }

  // Create bare repo if needed
  if (!fs.existsSync(finalRepoPath)) {
    git(`init --bare "${finalRepoPath}"`);
  }

  // Add remote
  git(`remote add gd "${finalRepoPath}"`, repoPath);
  saveLink(repoPath, driveMount, repoName);

  return { success: true, message: "Linked successfully" };
}

// Push all branches and tags to drive
function pushAllToDrive(repoPath: string): { success: boolean; error?: string } {
  try {
    git("push gd --all", repoPath);
    git("push gd --tags", repoPath);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Write to pushlog
function writeToPushLog(repoPath: string, driveMount: string): void {
  try {
    const existingUrl = getRemoteUrl("gd");
    if (existingUrl && fs.existsSync(existingUrl)) {
      const payload = {
        date: new Date().toISOString(),
        computer: os.hostname(),
        user: os.userInfo().username,
        localDir: repoPath,
        mode: "push-all",
      };
      const logFile = path.join(existingUrl, "git-drive-pushlog.json");
      fs.appendFileSync(logFile, JSON.stringify(payload) + "\n", "utf-8");
    }
  } catch {
    // Intentionally swallow telemetry tracking errors
  }
}

export async function pushAll(args: string[]): Promise<void> {
  try {
    const targetDir = args[0] || ".";

    if (!fs.existsSync(targetDir)) {
      console.log(`Directory not found: ${targetDir}`);
      return;
    }

    const absoluteDir = path.resolve(targetDir);
    console.log(`\n📁 Scanning ${absoluteDir}...\n`);

    // Scan directory
    const { gitRepos, nonGitProjects } = scanDirectory(absoluteDir);

    if (gitRepos.length === 0 && nonGitProjects.length === 0) {
      console.log("No projects found in this directory.");
      return;
    }

    // Report findings
    if (gitRepos.length > 0) {
      console.log("Git repositories:");
      gitRepos.forEach((repo) => {
        console.log(`  - ${path.basename(repo)}`);
      });
    }

    if (nonGitProjects.length > 0) {
      console.log("\nNon-git projects (not yet tracked):");
      nonGitProjects.forEach((proj) => {
        console.log(`  - ${path.basename(proj)}`);
      });
    }

    // Get configured drives
    const drives = await listDrives();
    const configuredDrives = drives
      .filter((drive) => drive.mounted && drive.mounted !== "/")
      .filter((drive) => fs.existsSync(path.join(drive.mounted, ".git-drive")));

    if (configuredDrives.length === 0) {
      console.log("\nNo initialized git-drives found. Please initialize a drive first.");
      return;
    }

    // Check for --drive flag
    const driveFlagIndex = args.findIndex((a) => a === "--drive" || a === "-d");
    const drivePath = driveFlagIndex !== -1 ? args[driveFlagIndex + 1] : null;

    let selectedDrive: any;

    if (drivePath) {
      selectedDrive = configuredDrives.find((d) => d.mounted === drivePath);
      if (!selectedDrive) {
        console.log(`Drive not found at: ${drivePath}`);
        return;
      }
    } else {
      const result = await prompts({
        type: "select",
        name: "drive",
        message: "Select a configured git-drive:",
        choices: configuredDrives.map((d) => ({
          title: `${d.filesystem} (${d.mounted})`,
          value: d,
        })),
      });

      if (!result.drive) return;
      selectedDrive = result.drive;
    }

    // Handle non-git projects
    let projectsToInit: string[] = [];
    
    if (nonGitProjects.length > 0) {
      const initAll = args.includes("--init-all");
      const skipNonGit = args.includes("--skip-non-git");

      if (skipNonGit) {
        console.log("\n⏭️  Skipping non-git directories...");
      } else if (initAll) {
        projectsToInit = [...nonGitProjects];
      } else {
        const { initAction } = await prompts({
          type: "select",
          name: "initAction",
          message: "The following directories are not git repos. What would you like to do?",
          choices: [
            { title: "Initialize all as git repos", value: "all" },
            { title: "Let me select individually", value: "select" },
            { title: "Skip non-git directories", value: "skip" },
          ],
        });

        if (!initAction) return;

        if (initAction === "all") {
          projectsToInit = [...nonGitProjects];
        } else if (initAction === "select") {
          const { selected } = await prompts({
            type: "multiselect",
            name: "selected",
            message: "Select directories to initialize:",
            choices: nonGitProjects.map((proj) => ({
              title: path.basename(proj),
              value: proj,
            })),
          });

          if (selected) {
            projectsToInit = selected;
          }
        }
      }
    }

    console.log(`\n📦 Backing up to ${selectedDrive.mounted}...\n`);

    const results: BackupResult[] = [];

    // Initialize non-git projects first
    for (const proj of projectsToInit) {
      const name = path.basename(proj);
      console.log(`  📦 Initializing ${name} as git repo...`);

      if (!initGitRepo(proj)) {
        results.push({ name, status: "error", message: "Failed to initialize git repo" });
        console.log(`    ❌ Failed to initialize git repo`);
        continue;
      }

      // Create initial commit if there are files
      if (hasUntrackedFiles(proj)) {
        createInitialCommit(proj);
      }

      // Add to git repos list for processing
      gitRepos.push(proj);
      results.push({ name, status: "initialized", message: "Initialized as git repo" });
    }

    // Process all git repos
    for (const repo of gitRepos) {
      const name = path.basename(repo);
      const { branches, tags } = countBranchesAndTags(repo);

      // Check if already linked to a different drive
      const existingUrl = getRemoteUrl("gd");
      if (existingUrl && !existingUrl.startsWith(selectedDrive.mounted)) {
        const force = args.includes("--force");
        if (!force) {
          results.push({
            name,
            status: "skipped",
            message: "Already linked to different drive (use --force to override)",
          });
          console.log(`  ⚠️  ${name} - skipped (already linked to different drive)`);
          continue;
        }
      }

      // Link the repo
      const linkResult = await linkRepo(repo, selectedDrive.mounted);
      if (!linkResult.success) {
        results.push({ name, status: "error", message: linkResult.message });
        console.log(`  ❌ ${name} - ${linkResult.message}`);
        continue;
      }

      // Push all branches and tags
      const pushResult = pushAllToDrive(repo);
      if (!pushResult.success) {
        results.push({ name, status: "error", message: pushResult.error });
        console.log(`  ❌ ${name} - push failed: ${pushResult.error}`);
        continue;
      }

      // Write to pushlog
      writeToPushLog(repo, selectedDrive.mounted);

      results.push({ name, status: "success", branches, tags });
      console.log(`  ✅ ${name} (${branches} branches, ${tags} tags)`);
    }

    // Summary
    const successCount = results.filter((r) => r.status === "success").length;
    const initializedCount = results.filter((r) => r.status === "initialized").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    console.log("\n📊 Summary:");
    if (initializedCount > 0) console.log(`   ${initializedCount} initialized as new repos`);
    console.log(`   ${successCount} repos backed up`);
    if (skippedCount > 0) console.log(`   ${skippedCount} skipped`);
    if (errorCount > 0) console.log(`   ${errorCount} errors`);
    console.log("");
  } catch (err) {
    handleError(err);
    process.exit(1);
  }
}