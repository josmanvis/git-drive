# Architecture

**Analysis Date:** 2026-01-22

## Pattern Overview

**Overall:** Command-line application with modular command pattern and layered abstractions

**Key Characteristics:**
- CLI entry point dispatching to isolated command handlers
- Separation of concerns: command logic, git operations, configuration management, error handling
- Synchronous execution using Node.js child_process for git operations
- Configuration-driven behavior with persistent state in user home directory
- Minimal external dependencies (Node.js stdlib only)

## Layers

**CLI Layer (Command Dispatch):**
- Purpose: Parse command arguments, route to appropriate command handler, manage process lifecycle
- Location: `src/index.ts`
- Contains: Main entry point, command registry, usage documentation, error handling wrapper
- Depends on: All command modules, error handling
- Used by: Node.js process execution

**Command Layer:**
- Purpose: Implement high-level workflows for each feature (init, push, archive, restore, list, status)
- Location: `src/commands/*.ts` (init.ts, push.ts, archive.ts, restore.ts, list.ts, status.ts)
- Contains: Command-specific business logic, parameter validation, orchestration of lower layers
- Depends on: Config layer, Git layer, Error types
- Used by: CLI dispatch layer

**Configuration Layer:**
- Purpose: Load, save, and validate application configuration (drive path); assert drive connectivity
- Location: `src/config.ts`
- Contains: Config file I/O, config validation, drive path helpers
- Depends on: Node.js fs, path, os modules; Error types
- Used by: Most command handlers; config validation before operations

**Git Abstraction Layer:**
- Purpose: Encapsulate git command execution and repository queries with consistent error handling
- Location: `src/git.ts`
- Contains: git() execution wrapper, repo root queries, project name resolution, remote URL inspection
- Depends on: Node.js child_process, path modules
- Used by: All command handlers that interact with git

**Error Handling Layer:**
- Purpose: Define custom error types and provide unified error output formatting
- Location: `src/errors.ts`
- Contains: GitDriveError exception class, handleError() formatting function
- Depends on: None
- Used by: All layers for consistent error propagation and output

## Data Flow

**Push Workflow:**

1. CLI receives `git drive push` command
2. Index.ts routes to push() handler in `src/commands/push.ts`
3. push() validates git repository status (isGitRepo)
4. Loads configuration from ~/.config/git-drive/config.json
5. Asserts drive is mounted at configured drivePath
6. Queries project name from git repository root
7. Creates or updates bare git repository at {drive}/git-drive/{project-name}.git
8. Adds "drive" remote to local repository pointing to bare repo
9. Pushes all branches and tags to drive remote
10. Outputs success message

**Archive Workflow:**

1. CLI receives `git drive archive [--force]` command
2. archive() in `src/commands/archive.ts` validates git repository
3. Checks for uncommitted changes (unless --force flag provided)
4. Calls push() internally to backup all content
5. Changes working directory to parent
6. Removes entire local repository directory
7. Outputs archive confirmation with restore instructions

**Restore Workflow:**

1. CLI receives `git drive restore <project-name> [target-dir]`
2. restore() in `src/commands/restore.ts` validates configuration
3. Asserts drive is mounted
4. Checks that bare repository exists on drive at {drive}/git-drive/{project-name}.git
5. Clones bare repository to target directory
6. Renames "origin" remote to "drive" for consistency with push workflow
7. Outputs success message with restored path

**Status Query Workflow:**

1. CLI receives `git drive status`
2. status() in `src/commands/status.ts` loads configuration (non-fatal if missing)
3. Checks drive connectivity by filesystem existence check
4. If connected: lists all projects in {drive}/git-drive/ by enumerating .git directories
5. If in a git repository: reports project name and drive remote status
6. Outputs multi-line status report

**State Management:**

- Configuration state: Persistent JSON file at ~/.config/git-drive/config.json (drivePath property only)
- Repository state: Stored in git bare repositories on external drive; local repositories maintain standard git state
- No in-memory state caching; all reads are fresh from filesystem/git

## Key Abstractions

**Git Command Wrapper (git()):**
- Purpose: Provide safe, consistent git command execution with error propagation
- Examples: `src/git.ts` functions like git(), getRepoRoot(), getProjectName(), getRemoteUrl()
- Pattern: execSync with explicit error handling; stdio piping to capture output; optional cwd parameter for working directory context

**GitDriveError Exception:**
- Purpose: Distinguish application-level errors (user/config issues) from system errors
- Examples: "No drive configured", "Working tree has uncommitted changes", "Path not found"
- Pattern: Custom Error subclass with name property; caught and formatted in main error handler

**Configuration Contract:**
- Purpose: Validate drive path existence and accessibility before operations
- Examples: requireConfig() (throws if missing), assertDriveMounted() (checks filesystem)
- Pattern: Fail-fast validation at command start; errors reported immediately to user

**Command Handler Signature:**
- Purpose: Provide consistent interface for CLI dispatch
- Pattern: (args: string[]) => void; throws GitDriveError on validation failures; logs results to console

## Entry Points

**CLI Entry Point (Node.js executable):**
- Location: `src/index.ts` (shebang: #!/usr/bin/env node)
- Triggers: Installation via npm/git-drive binary; direct node execution
- Responsibilities: Command parsing, handler dispatch, error handling, process exit code management

**Command Handlers (6 total):**
- init: Initialize drive path; called once per setup
- push: Back up current repository; called before archive or periodically
- archive: Backup and remove local copy; called when archiving projects
- restore: Retrieve archived project; called to bring archived projects back online
- list: Display all archived projects; informational query
- status: Display current drive and repository state; diagnostic command

## Error Handling

**Strategy:** Fail-fast with clear user messaging; distinguish application errors from system errors

**Patterns:**
- GitDriveError for expected failures (missing config, wrong path, uncommitted changes)
- Error type checking in main handler: if GitDriveError show message directly, else parse stderr from execSync
- Process exits with code 1 on any error; code 0 on success
- All error messages prefixed with "error: " for consistency

---

*Architecture analysis: 2026-01-22*
