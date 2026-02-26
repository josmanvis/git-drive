import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve, join } from "path";
import { createInterface } from "readline";
import prompts from "prompts";
import { listDrives } from "../git.js";
import { GitDriveError } from "../errors.js";
import { getDriveStorePath } from "../config.js";

const DEFAULT_PORT = 4484;
const MAX_PORT_ATTEMPTS = 20;

// Check if a port is available
async function isPortAvailable(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/api/health`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(500),
    });
    return false; // Port is in use
  } catch {
    return true; // Port is available
  }
}

// Find the next available port starting from DEFAULT_PORT
async function findAvailablePort(startPort: number = DEFAULT_PORT): Promise<number> {
  for (let port = startPort; port < startPort + MAX_PORT_ATTEMPTS; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new GitDriveError(`Could not find an available port after ${MAX_PORT_ATTEMPTS} attempts.`);
}

// Get companion info from a drive
function getCompanionInfo(drivePath: string): { installed: boolean; version?: string; installedAt?: string } {
  const storePath = getDriveStorePath(drivePath);
  const companionVersionPath = join(storePath, 'companion.json');
  const companionRepoPath = join(storePath, 'git-drive.git');

  if (!existsSync(companionRepoPath)) {
    return { installed: false };
  }

  try {
    if (existsSync(companionVersionPath)) {
      const companionInfo = JSON.parse(readFileSync(companionVersionPath, 'utf-8'));
      return {
        installed: true,
        version: companionInfo.version,
        installedAt: companionInfo.installedAt,
      };
    }
    return { installed: true }; // Repo exists but no version file
  } catch {
    return { installed: true };
  }
}

// Open browser to URL
function openBrowser(url: string): void {
  const platform = process.platform;
  let command: string;

  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  try {
    spawn(command, { shell: true, detached: true, stdio: 'ignore' });
  } catch (err) {
    console.log(`Please open your browser to: ${url}`);
  }
}

// Wait for Enter key
async function waitForEnter(): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('\nPress Enter to stop the companion server...', () => {
      rl.close();
      resolve();
    });
  });
}

export async function companion(args: string[]): Promise<void> {
  let drivePath: string;

  const rawPath = args[0];

  if (!rawPath) {
    // No argument provided - prompt user to select a drive
    const drives = await listDrives();

    // Filter to only drives with git-drive initialized
    const initializedDrives = drives.filter((d: any) => {
      const storePath = getDriveStorePath(d.mounted);
      return existsSync(storePath);
    });

    if (initializedDrives.length === 0) {
      throw new GitDriveError(
        "No drives with git-drive initialized found.\nRun 'git-drive init' on a drive first."
      );
    }

    const { selectedDrive } = await prompts({
      type: "select",
      name: "selectedDrive",
      message: "Select a drive to run in companion mode:",
      choices: initializedDrives.map((d: any) => {
        const companionInfo = getCompanionInfo(d.mounted);
        const companionStatus = companionInfo.installed 
          ? ` (Companion v${companionInfo.version || 'unknown'})` 
          : ' (No companion)';
        return {
          title: `${d.filesystem} (${d.mounted})${companionStatus}`,
          value: d.mounted,
        };
      }),
    });

    if (!selectedDrive) {
      console.log("Operation cancelled.");
      return;
    }

    drivePath = resolve(selectedDrive);
  } else {
    drivePath = resolve(rawPath);
  }

  // Verify the drive has git-drive initialized
  const storePath = getDriveStorePath(drivePath);
  if (!existsSync(storePath)) {
    throw new GitDriveError(
      `Git Drive not initialized on ${drivePath}.\nRun 'git-drive init ${drivePath}' first.`
    );
  }

  // Check companion status
  const companionInfo = getCompanionInfo(drivePath);
  if (!companionInfo.installed) {
    console.log(`\n⚠️  Warning: Companion not installed on this drive.`);
    console.log(`   Run 'git-drive init ${drivePath}' to install the companion.`);
    console.log(`   Continuing in standard mode...\n`);
  }

  // Find available port
  const port = await findAvailablePort();

  console.log(`\n🔌 Starting Git Drive in Companion Mode...`);
  console.log(`   Drive: ${drivePath}`);
  console.log(`   Port: ${port}`);
  if (companionInfo.version) {
    console.log(`   Companion: v${companionInfo.version}`);
  }

  // Start the server with companion mode environment variables
  const serverPath = require.resolve('../server.js');
  const env = {
    ...process.env,
    GIT_DRIVE_PORT: String(port),
    GIT_DRIVE_COMPANION_MODE: 'true',
    GIT_DRIVE_COMPANION_DRIVE: drivePath,
  };

  const child = spawn(process.execPath, [serverPath], {
    stdio: 'inherit',
    env,
  });

  child.on('error', (err) => {
    console.error('Failed to start companion server:', err.message);
    process.exit(1);
  });

  // Wait a moment for server to start, then open browser
  setTimeout(() => {
    const url = `http://localhost:${port}`;
    console.log(`\n   🌐 Opening browser: ${url}`);
    openBrowser(url);
    console.log(`\n   Companion mode is running.`);
  }, 1000);

  // Wait for Enter to stop
  await waitForEnter();

  console.log('\n   Stopping companion server...');
  child.kill();
  console.log('   👋 Companion mode stopped.');
}

// Export helper functions for testing
export { getCompanionInfo, findAvailablePort, isPortAvailable };