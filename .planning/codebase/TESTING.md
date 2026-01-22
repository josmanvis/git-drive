# Testing Patterns

**Analysis Date:** 2026-01-22

## Test Framework

**Runner:**
- Not detected
- No testing framework configured (no jest.config.*, vitest.config.*, package.json test script)

**Assertion Library:**
- Not applicable - no tests present

**Run Commands:**
- No test commands defined in `package.json`
- Current package.json scripts:
  ```json
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
  ```

## Test File Organization

**Location:**
- No test files detected in codebase
- No `__tests__` directory
- No `.test.ts` or `.spec.ts` files

**Naming:**
- No test naming convention established

**Structure:**
- Not applicable - no tests present

## Test Structure

**Suite Organization:**
- Not applicable - no tests present

**Patterns:**
- Not applicable - no tests present

## Mocking

**Framework:**
- Not detected - no mocking library configured

**Patterns:**
- Not applicable - no mocks present

**What to Mock:**
- If tests were to be added, candidates for mocking:
  - File system operations (`fs` module): `readFileSync`, `writeFileSync`, `mkdirSync`, `existsSync`, `readdirSync`, `statSync`, `rmSync`
  - Child process execution (`child_process.execSync`): Would need mocking to avoid running real git commands
  - Environment paths: `homedir()`, `process.argv`, `process.cwd()`, `process.chdir()`

**What NOT to Mock:**
- If tests were to be added, avoid mocking:
  - Error classes (`GitDriveError`) - should use real instances
  - Type interfaces (`Config`) - used for type checking only
  - Custom utility functions - better to test with real implementations

## Fixtures and Factories

**Test Data:**
- Not applicable - no test fixtures present

**Location:**
- If needed, should be created in: `src/__fixtures__/` or `src/__testdata__/`

## Coverage

**Requirements:**
- No coverage requirements enforced
- No coverage configuration present

**View Coverage:**
- Not applicable - no test runner configured

## Test Types

**Unit Tests:**
- Not present
- Candidates for unit testing:
  - `src/config.ts` functions: `loadConfig()`, `saveConfig()`, `requireConfig()`, `assertDriveMounted()`, `getDriveStorePath()`
  - `src/git.ts` functions: `git()`, `getRepoRoot()`, `getProjectName()`, `getRemoteUrl()`, `isGitRepo()`
  - `src/errors.ts`: `GitDriveError` class and `handleError()` function

**Integration Tests:**
- Not present
- Candidates for integration testing:
  - `src/commands/init.ts`: Configuration setup and drive initialization
  - `src/commands/push.ts`: Bare repository creation and remote configuration
  - `src/commands/archive.ts`: Multi-step archival process (push + delete)
  - `src/commands/restore.ts`: Repository cloning and remote renaming

**E2E Tests:**
- Not present
- Could be valuable for validating complete workflows with actual filesystem and git operations

## Common Patterns

**Async Testing:**
- Not applicable - codebase is synchronous
- All operations use `execSync` and synchronous file I/O

**Error Testing:**
- Not applicable - no tests present
- Current error handling in `src/errors.ts` shows pattern for testing:
  - Custom error instances: `instanceof GitDriveError`
  - Standard Error instances: `instanceof Error`
  - Unknown errors: catch-all with fallback message

## Current Testing Strategy

**Status:** No automated tests currently in place.

**Testing Approach:**
- Manual testing via CLI commands
- Commands throw `GitDriveError` on validation failures
- Exit codes used: `0` for success, `1` for failure
- User-facing error messages output to `console.error()`

**Why Manual Now:**
- Simple CLI tool with small codebase (374 lines total)
- Requires filesystem and git operations that are environment-dependent
- Suitable for expansion as test infrastructure is added

## Recommended Testing Structure

If tests are to be added, follow this structure:

**Test Files Location:**
```
src/
├── commands/
│   ├── init.ts
│   └── init.test.ts          # Co-located tests
├── config.ts
├── config.test.ts
├── git.ts
├── git.test.ts
├── errors.ts
└── errors.test.ts
```

**Test Dependencies Needed:**
- Jest or Vitest as test runner
- Mock library for fs and child_process (built-in to Jest/Vitest)
- Temporary directory library (e.g., `fs-extra` or native `fs.mkdtempSync`)

---

*Testing analysis: 2026-01-22*
