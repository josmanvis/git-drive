import { existsSync, statSync, mkdirSync } from "fs";
import { resolve } from "path";
import prompts from "prompts";
import { saveConfig, getDriveStorePath } from "../config.js";
import { listDrives } from "../git.js";
import { GitDriveError } from "../errors.js";

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
}