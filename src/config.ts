import { homedir } from "os";
import { join } from "path";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { GitDriveError } from "./errors.js";

const CONFIG_DIR = join(homedir(), ".config", "git-drive");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface Config {
  drivePath: string;
}

export function loadConfig(): Config | null {
  if (!existsSync(CONFIG_FILE)) return null;
  const raw = readFileSync(CONFIG_FILE, "utf-8");
  return JSON.parse(raw) as Config;
}

export function saveConfig(config: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
}

export function requireConfig(): Config {
  const config = loadConfig();
  if (!config) {
    throw new GitDriveError("No drive configured. Run: git drive init <path>");
  }
  return config;
}

export function assertDriveMounted(drivePath: string): void {
  if (!existsSync(drivePath)) {
    throw new GitDriveError(
      `Drive not found at ${drivePath}. Is it connected?`
    );
  }
}

export function getDriveStorePath(drivePath: string): string {
  return join(drivePath, "git-drive");
}
