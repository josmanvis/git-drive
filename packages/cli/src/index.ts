#!/usr/bin/env node

import { push } from "./commands/push.js";
import { list } from "./commands/list.js";
import { status } from "./commands/status.js";
import { link } from "./commands/link.js";
import { handleError } from "./errors.js";

const commands: Record<string, (args: string[]) => void | Promise<void>> = {
  push,
  list,
  status,
  link,
};

function printUsage(): void {
  console.log(`usage: git drive <command> [options]

Commands:
  link                 Link current repo to a drive
  push                 Push current repo to drive
  list                 Show projects on drive
  status               Check drive and repo state`);
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

    await handler(args);
  } catch (err) {
    handleError(err);
    process.exit(1);
  }
})();
