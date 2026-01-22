# Codebase Concerns

**Analysis Date:** 2026-01-22

## Tech Debt

**Command Injection Vulnerability via execSync:**
- Issue: Git arguments are passed directly to `execSync` without sanitization. Paths containing special characters could allow injection.
- Files: `src/git.ts` (lines 5-9), `src/commands/push.ts` (lines 21, 28, 31, 35-36), `src/commands/archive.ts` (line 16), `src/commands/restore.ts` (line 30, 33)
- Impact: Malicious project names or file paths could execute arbitrary shell commands
- Fix approach: Use array form of `execSync` or use `spawn` instead of shell interpolation. Alternatively, escape shell arguments using a library like `shell-escape`.

**Unguarded Process State Mutation in archive:**
- Issue: `process.chdir("..")` modifies global process state without cleanup or error handling. If removal fails, the process stays in parent directory.
- Files: `src/commands/archive.ts` (lines 34-35)
- Impact: If `rmSync` throws after `process.chdir`, the error handler exits from wrong directory, potentially confusing users. Subsequent operations in same process would operate from wrong directory.
- Fix approach: Wrap in try-finally to restore original cwd. Consider using relative paths or path.join instead of process.chdir.

**Error Information Leakage in Git Operations:**
- Issue: Git command failures expose full stderr output which might contain sensitive repository or system information.
- Files: `src/errors.ts` (lines 14-16), `src/git.ts` (lines 4-9)
- Impact: Sensitive paths, auth tokens, or system details could leak to stdout/stderr
- Fix approach: Sanitize git error messages, only show relevant error lines, hide sensitive paths.

## Known Bugs

**Race Condition in Push Remote Handling:**
- Symptoms: If two processes call `push` simultaneously, both might check for existing remote URL and create duplicate remotes
- Files: `src/commands/push.ts` (lines 26-31)
- Trigger: Run `git drive push` from two separate terminal windows on same repo simultaneously
- Workaround: None. User must manually clean up remotes with `git remote rm drive`

**Archive Command Fails Silently on Partial Deletion:**
- Symptoms: If `rmSync` fails due to file locks (on Windows) or permissions, the output still says "Archived" but local copy remains
- Files: `src/commands/archive.ts` (lines 34-37)
- Trigger: On Windows with antivirus scanning files, or with open file handles
- Workaround: Manually delete directory after error, or use `--force` flag which ignores uncommitted changes but won't prevent rmSync errors

**Restore Creates Clone with Wrong Remote:**
- Symptoms: Cloning a bare repo creates `origin` remote, then it's renamed to `drive`, but if clone fails midway and user retries, state is inconsistent
- Files: `src/commands/restore.ts` (lines 30, 33)
- Trigger: Clone fails (network error, disk full) and user retries
- Workaround: Manually delete target directory and retry

## Security Considerations

**Config File Permissions Not Set:**
- Risk: `~/.config/git-drive/config.json` is created world-readable if default umask is permissive. Contains drive path which could be sensitive.
- Files: `src/config.ts` (lines 20-21)
- Current mitigation: None
- Recommendations: Call `chmod 600` on config file after creation. Use `mode` option in `mkdirSync` to set 0o700 permissions.

**No Validation of Path Traversal in Restore:**
- Risk: User can specify `../../../etc/passwd` as target-dir. While Git clone itself prevents escaping, relative paths could be confusing.
- Files: `src/commands/restore.ts` (lines 9, 25)
- Current mitigation: Uses `resolve()` to canonicalize paths
- Recommendations: Validate target path is within expected directory or is absolute

**Insufficient Argument Validation:**
- Risk: Commands don't validate argument length or type, leading to confusing errors
- Files: `src/commands/restore.ts` (line 8), `src/index.ts` (line 32)
- Current mitigation: Basic checks in some commands
- Recommendations: Add argument count/type validation before processing

## Performance Bottlenecks

**List Command Iterates All Entries Twice:**
- Problem: `readdirSync()` called, then filtered, then iterated with `statSync()` for each. No caching or batching.
- Files: `src/commands/list.ts` (lines 17-33)
- Cause: Synchronous I/O in loop, no parallelization
- Improvement path: Use `Dirent.isFile()` option in readdir to avoid extra stat calls. Not a bottleneck for typical drive sizes (<1000 projects) but poor pattern.

**Git Operations Not Buffered:**
- Problem: Each git command is a separate `execSync` call. `push --all` and `push --tags` execute separately instead of combined.
- Files: `src/commands/push.ts` (lines 35-36)
- Cause: Two separate git invocations where one could be chained
- Improvement path: Combine into single command: `git("push drive --all --tags")`

## Fragile Areas

**Archive Command - Destructive Without Confirmation:**
- Files: `src/commands/archive.ts`
- Why fragile: Deletes entire local directory with only a weak check for uncommitted changes. `--force` flag disables even that.
- Safe modification: Add confirmation prompt before deletion (even with --force). Consider adding `--dry-run` to preview what would be deleted. Add atomic transaction guarantee: push succeeds before any deletion.
- Test coverage: No tests present. This is the most dangerous command.

**Git Remote Initialization Logic:**
- Files: `src/commands/push.ts` (lines 19-32)
- Why fragile: Multiple state branches (remote doesn't exist, exists with same URL, exists with different URL). Easy to miss edge case.
- Safe modification: Add tests for all three branches. Consider replacing with `git remote set-url --add` if it exists, then prune duplicates.
- Test coverage: No tests present.

**Config Persistence:**
- Files: `src/config.ts` (lines 13-21)
- Why fragile: No atomic writes, no backup of old config. If process crashes during JSON write, config corrupts.
- Safe modification: Write to temp file first, then rename. Add version field to config format.
- Test coverage: No tests present.

**Drive Mount Assumption:**
- Files: `src/config.ts` (line 33), multiple commands
- Why fragile: Assumes if path exists, drive is mounted. On filesystems with autounmount, path could exist but be stale mount point.
- Safe modification: Check if path is actually accessible (try to read), not just exists
- Test coverage: No tests present.

## Scaling Limits

**Bare Repository Storage:**
- Current capacity: Works fine for ~1000s of projects on typical external drive
- Limit: No size limits enforced. Bare repos can grow large; no compression or GC recommended to users
- Scaling path: Document repository GC recommendations. Add `git drive gc` command to run `git gc --aggressive` on all bare repos.

**Synchronous I/O Operations:**
- Current capacity: All operations block. On drive with 1000+ projects, list/status commands visibly slow
- Limit: ~100ms per large operation on typical USB drive, scales linearly with project count
- Scaling path: Switch to async operations for I/O-heavy commands. Parallelize directory operations.

## Dependencies at Risk

**No Production Dependencies:**
- Risk: Codebase has only dev dependencies (TypeScript, @types/node). Good security posture but limits future extensibility.
- Impact: Any new feature requiring external library (e.g., progress bars, colors) requires new dep
- Migration plan: Carefully evaluate any production dependency for security and maintenance status

**execSync from child_process:**
- Risk: Node's `execSync` doesn't have a maxBuffer safeguard - large git command output (massive commit messages, etc.) could hang or crash process
- Impact: User loses ability to abort hanging process gracefully
- Migration plan: Switch to spawn() with streaming output, or add timeout parameter to execSync

## Missing Critical Features

**No Progress Indication:**
- Problem: Large git push operations give no feedback. User doesn't know if hung or still running.
- Blocks: Difficult to debug stalled operations

**No Test Suite:**
- Problem: Zero test coverage. No unit, integration, or e2e tests.
- Blocks: Refactoring, verification of security fixes, confidence in changes

**No Dry Run Mode:**
- Problem: Destructive operations (archive, push to wrong remote) have no preview
- Blocks: Users cannot safely test commands

**No Concurrency Control:**
- Problem: Multiple processes can push/archive simultaneously, causing corruption
- Blocks: Safe concurrent usage

**No Recovery from Partial Operations:**
- Problem: If push succeeds but archive deletion fails, no way to resume or rollback
- Blocks: Reliable archive operations

## Test Coverage Gaps

**Archive Command - No Tests:**
- What's not tested: Successful archive flow, archive with uncommitted changes detection, archive with --force flag, rmSync error scenarios, edge case where push succeeds but rm fails
- Files: `src/commands/archive.ts`
- Risk: Most destructive operation has zero test coverage. Easy to introduce regressions.
- Priority: High

**Push Command - No Tests:**
- What's not tested: Creating bare repo, adding new remote, updating existing remote, concurrent pushes, large repository push
- Files: `src/commands/push.ts`
- Risk: Core functionality untested. Remote state bugs undetected.
- Priority: High

**Restore Command - No Tests:**
- What's not tested: Successful restore, nonexistent project error, directory exists error, clone failure scenarios
- Files: `src/commands/restore.ts`
- Risk: Data recovery untested. Silent failures possible.
- Priority: High

**Config System - No Tests:**
- What's not tested: Config loading/saving, corrupted JSON recovery, missing config, permission errors, drive mount detection
- Files: `src/config.ts`
- Risk: Configuration system untested. State corruption undetected.
- Priority: High

**Error Handling - No Tests:**
- What's not tested: GitDriveError formatting, execSync error parsing, unknown error handling, edge case error messages
- Files: `src/errors.ts`
- Risk: Error messages could be unhelpful or expose sensitive info, untested.
- Priority: Medium

**Index/CLI - No Tests:**
- What's not tested: Command routing, unknown command handling, help text, missing command handler errors
- Files: `src/index.ts`
- Risk: CLI argument parsing untested. Invalid input handling unverified.
- Priority: Medium

---

*Concerns audit: 2026-01-22*
