#!/usr/bin/env node

import { init } from "./commands/init.js";
import { push } from "./commands/push.js";
import { archive } from "./commands/archive.js";
import { restore } from "./commands/restore.js";
import { list } from "./commands/list.js";
import { status } from "./commands/status.js";
import { handleError } from "./errors.js";

const commands: Record<string, (args: string[]) => void> = {
  init,
  push,
  archive,
  restore,
  list,
  status,
};

function printUsage(): void {
  console.log(`usage: git drive <command> [options]

Commands:
  init <path>          Configure external drive path
  push                 Push current repo to drive
  archive [--force]    Push and remove local copy
  restore <name>       Clone project back from drive
  list                 Show projects on drive
  status               Check drive and repo state`);
}

const [command, ...args] = process.argv.slice(2);

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

  handler(args);
} catch (err) {
  handleError(err);
  process.exit(1);
}
