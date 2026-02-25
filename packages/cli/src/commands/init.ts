import { existsSync, statSync, mkdirSync } from "fs";
import { resolve } from "path";
import { saveConfig, getDriveStorePath } from "../config.js";
import { GitDriveError } from "../errors.js";

export function init(args: string[]): void {
  const rawPath = args[0];

  if (!rawPath) {
    throw new GitDriveError("Usage: git drive init <path>");
  }

  const drivePath = resolve(rawPath);

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

  console.log(`Drive configured: ${storePath}`);
}
