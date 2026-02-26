#!/usr/bin/env node

import { spawn } from 'child_process';
import { push } from "./commands/push.js";
import { list } from "./commands/list.js";
import { status } from "./commands/status.js";
import { link } from "./commands/link.js";
import { init } from "./commands/init.js";
import { handleError } from "./errors.js";
import { ensureServerRunning } from "./server.js";

const commands: Record<string, (args: string[]) => void | Promise<void>> = {
  init,
  push,
  list,
  status,
  link,
  server: startServer,
  start: startServer,
  ui: startServer,
};

// Commands that don't need the server running
const NO_SERVER_COMMANDS = ['server', 'start', 'ui'];

function printUsage(): void {
  console.log(`
git-drive - Turn any external drive into a git remote backup for your code

Usage:
  git-drive <command> [options]

Commands:
  init                 Initialize git-drive on an external drive
  link                 Link current repo to a drive
  push                 Push current repo to drive
  list                 Show connected drives and their status
  status               Show detailed status of drives and repos
  server, start, ui    Start the git-drive web UI server

Options:
  -h, --help           Show this help message

Examples:
  git-drive init /Volumes/MyDrive   Initialize git-drive on a drive
  git-drive link                    Link current repo to a drive
  git-drive push                    Push current repo to drive
  git-drive list                    List connected drives
  git-drive status                  Show detailed status
  git-drive server                  Start the web UI at http://localhost:4483

Environment Variables:
  GIT_DRIVE_PORT       Port for the web server (default: 4483)

Docker:
  docker run -it --rm -v /Volumes:/Volumes -p 4483:4483 git-drive

Documentation:
  https://github.com/josmanvis/git-drive
`);
}

function startServer(_args: string[]): void {
  console.log('\n  🚀 Starting Git Drive server...\n');
  console.log('  Web UI: http://localhost:4483\n');
  console.log('  Press Ctrl+C to stop\n');
  
  const serverPath = require.resolve('./server.js');
  const child = spawn(process.execPath, [serverPath], {
    stdio: 'inherit',
    env: process.env
  });
  
  child.on('error', (err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

const [command, ...args] = process.argv.slice(2);

(async () => {
  try {
    if (!command || command === "--help" || command === "-h") {
      printUsage();
      process.exit(0);
    }

    const handler = commands[command];
    if (!handler) {
      console.error(`Unknown command: ${command}\n`);
      printUsage();
      process.exit(1);
    }

    // Ensure server is running for commands that need it
    if (!NO_SERVER_COMMANDS.includes(command)) {
      await ensureServerRunning();
    }

    await handler(args);
  } catch (err) {
    handleError(err);
    process.exit(1);
  }
})();
