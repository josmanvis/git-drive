import { handleError } from "../errors.js";
import { saveLink } from "../config.js";
import { git, getProjectName, getRepoRoot, listDrives } from "../git.js";
import prompts from "prompts";
import * as fs from "fs";
import * as path from "path";

export async function link(args: string[]): Promise<void> {
  try {
    const drives = await listDrives();

    // Only fetch drives that actually have .git-drive configured
    const configuredDrives = drives
      .filter((drive) => drive.mounted && drive.mounted !== "/")
      .filter((drive) => fs.existsSync(path.join(drive.mounted, ".git-drive")));

    if (configuredDrives.length === 0) {
      console.log("No initialized git-drives found. Please initialize a drive first.");
      return;
    }

    // Check for --drive flag for non-interactive mode
    const driveFlagIndex = args.findIndex((a) => a === "--drive" || a === "-d");
    const drivePath = driveFlagIndex !== -1 ? args[driveFlagIndex + 1] : null;
    const createNew = args.includes("--create") || args.includes("-c");

    let drive;

    if (drivePath) {
      // Non-interactive mode: find the drive by path
      drive = configuredDrives.find((d) => d.mounted === drivePath);
      if (!drive) {
        console.log(`Drive not found at: ${drivePath}`);
        return;
      }
    } else {
      // Interactive mode
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
      drive = result.drive;
    }

    const gitDrivePath = path.join(drive.mounted, ".git-drive");
    const existingRepos = fs.readdirSync(gitDrivePath).filter((entry) => {
      const entryPath = path.join(gitDrivePath, entry);
      return (
        fs.statSync(entryPath).isDirectory() &&
        (entry.endsWith(".git") || fs.existsSync(path.join(entryPath, "HEAD")))
      );
    });

    const CREATE_NEW = "__CREATE_NEW__";
    let targetRepoName: string | null = null;

    if (createNew) {
      // Non-interactive mode: create new repo with project name
      const defaultName = getProjectName();
      targetRepoName = defaultName.endsWith(".git") ? defaultName : `${defaultName}.git`;

      const repoPath = path.join(gitDrivePath, targetRepoName);
      if (fs.existsSync(repoPath)) {
        console.log(`Repository ${targetRepoName} already exists in this drive. Linking to existing.`);
      } else {
        git(`init --bare "${repoPath}"`);
        console.log(`Created new bare repository: ${targetRepoName}`);
      }
    } else {
      // Interactive mode
      const { selectedRepo } = await prompts({
        type: "select",
        name: "selectedRepo",
        message: "Select an existing repository to link, or create a new one:",
        choices: [
          { title: "✨ Create new repository...", value: CREATE_NEW },
          ...existingRepos.map((repo) => ({
            title: `📁 ${repo.replace(/\.git$/, "")}`,
            value: repo,
          })),
        ],
      });

      if (!selectedRepo) return;
      targetRepoName = selectedRepo;

      if (selectedRepo === CREATE_NEW) {
        const defaultName = getProjectName();
        const { newRepoName } = await prompts({
          type: "text",
          name: "newRepoName",
          message: "Enter the new repository name:",
          initial: defaultName,
        });

        if (!newRepoName) return;
        targetRepoName = newRepoName.endsWith(".git") ? newRepoName : `${newRepoName}.git`;

        const repoPath = path.join(gitDrivePath, targetRepoName as string);
        if (fs.existsSync(repoPath)) {
          console.log(`Repository ${targetRepoName} already exists in this drive.`);
          return;
        }

        git(`init --bare "${repoPath}"`);
        console.log(`Created new bare repository: ${targetRepoName}`);
      }
    }

    if (!targetRepoName) return;

    const repoRoot = getRepoRoot();
    const finalRepoPath = path.join(gitDrivePath, targetRepoName as string);

    // Check if remote 'gd' already exists
    let gdExists = false;
    try {
      git(`remote get-url gd`, repoRoot);
      gdExists = true;
    } catch {
      // Remote does not exist
    }

    if (gdExists) {
      console.log("Remote 'gd' already exists. Updating it to point to the new drive.");
      git(`remote set-url gd "${finalRepoPath}"`, repoRoot);
    } else {
      git(`remote add gd "${finalRepoPath}"`, repoRoot);
    }

    // Persist to global git-drive registry for the Web UI
    saveLink(repoRoot, drive.mounted, targetRepoName as string);

    console.log(`\n✅ Successfully linked!`);
    console.log(`Repository: ${targetRepoName.replace(/\.git$/, "")}`);
    console.log(`Drive: ${drive.mounted}`);
    console.log(`\nYou can now push to this remote using:`);
    console.log(`  git push gd main`);

  } catch (err) {
    handleError(err);
    process.exit(1);
  }
}
