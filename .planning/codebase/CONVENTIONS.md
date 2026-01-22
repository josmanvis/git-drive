# Coding Conventions

**Analysis Date:** 2026-01-22

## Naming Patterns

**Files:**
- Kebab-case for command files: `init.ts`, `push.ts`, `archive.ts`, `restore.ts`, `list.ts`, `status.ts`
- Lowercase for utility modules: `config.ts`, `errors.ts`, `git.ts`, `index.ts`
- Commands are organized in `src/commands/` directory
- Extension: `.ts` for all TypeScript files

**Functions:**
- camelCase for all function names: `init()`, `push()`, `archive()`, `restore()`, `list()`, `status()`
- Command functions export with pattern: `export function <commandName>(args: string[]): void`
- Utility functions use camelCase: `loadConfig()`, `saveConfig()`, `getRepoRoot()`, `getProjectName()`, `assertDriveMounted()`
- Prefix conventions: `is*` for boolean checks (`isGitRepo()`)
- Prefix conventions: `get*` for retrieval functions (`getRepoRoot()`, `getProjectName()`, `getRemoteUrl()`)
- Prefix conventions: `require*` for mandatory getters with error throwing (`requireConfig()`)
- Prefix conventions: `assert*` for validation functions that throw on failure (`assertDriveMounted()`)

**Variables:**
- camelCase for all variables and parameters: `rawPath`, `drivePath`, `repoRoot`, `projectName`, `storePath`, `bareRepoPath`
- Constants: UPPER_SNAKE_CASE for configuration paths: `CONFIG_DIR`, `CONFIG_FILE`
- Private/internal prefixes: None used; all module-level constants are uppercase

**Types:**
- PascalCase for interfaces: `Config`
- Record types for object lookups: `Record<string, (args: string[]) => void>` for command handlers
- Error classes: PascalCase: `GitDriveError`

## Code Style

**Formatting:**
- Target: ES2022
- Module system: Node16 with `.js` extensions in imports
- Strict TypeScript enabled with `strict: true`
- 2-space indentation (inferred from package and compiled output)
- Semicolons used consistently at statement ends

**Linting:**
- No formal linting configuration detected (.eslintrc not present)
- No Prettier configuration detected (.prettierrc not present)
- TypeScript compiler with strict mode enforces type safety

**Type Safety:**
- All function parameters explicitly typed: `args: string[]`, `cwd?: string`, `remoteName: string`
- Return types explicitly declared: `void`, `string`, `Config`, `boolean`, `Config | null`
- Optional parameters marked: `cwd?: string`, `targetDir = args[1] || projectName`
- Union types used for nullable returns: `string | null`

## Import Organization

**Order:**
1. Node.js built-in modules (`fs`, `path`, `os`, `child_process`)
2. Relative imports from project modules (`./config.js`, `./errors.js`, `./commands/...`)
3. No third-party dependencies imported

**Path Aliases:**
- No path aliases configured; all imports use relative paths
- Imports include `.js` extension: `import { handleError } from "./errors.js"`
- Example: `import { init } from "./commands/init.js"`

**Export Pattern:**
- Named exports used consistently: `export function`, `export class`, `export interface`
- No default exports
- Single responsibility per file maintained

## Error Handling

**Patterns:**
- Custom error class `GitDriveError` extends native `Error` with consistent naming
- Error instantiation: `throw new GitDriveError("message")`
- Error handling at top level in `src/index.ts` try-catch block
- Type-safe error checking: `if (err instanceof GitDriveError)`, `if (err instanceof Error)`
- Fallback for unknown errors: `else { console.error("An unexpected error occurred.") }`
- stderr extraction from `execSync` errors: regex match on error message
- Examples from `src/errors.ts`:
  ```typescript
  export function handleError(err: unknown): void {
    if (err instanceof GitDriveError) {
      console.error(`error: ${err.message}`);
    } else if (err instanceof Error) {
      const msg = err.message;
      const stderrMatch = msg.match(/stderr:\s*([\s\S]*)/);
      if (stderrMatch) {
        console.error(`error: ${stderrMatch[1].trim()}`);
      } else {
        console.error(`error: ${msg}`);
      }
    } else {
      console.error("An unexpected error occurred.");
    }
  }
  ```

## Logging

**Framework:** console (built-in)

**Patterns:**
- `console.log()` for normal output: user messages, status updates
- `console.error()` for error output: error handling
- Consistent prefix: `error: ` for error messages
- Informational output with context: `console.log(\`Drive: ${config.drivePath} (connected)\`)`
- String interpolation used for variables: `` `Drive configured: ${storePath}` ``
- Status updates: `console.log(\`Pushed ${projectName} to drive.\`)`
- Diagnostic output: `console.log(\`Created bare repo: ${bareRepoPath}\`)`

## Comments

**When to Comment:**
- Used for explaining non-obvious logic or git operations
- Precedes multi-step operations to clarify intent
- Examples from codebase:
  - `// Create bare repo if it doesn't exist`
  - `// Add or update remote`
  - `// Push all branches and tags`
  - `// Check for uncommitted changes`
  - `// Push first`
  - `// Remove local copy`
  - `// execSync errors include stderr in the message`
  - `// Rename origin to drive so the remote stays consistent`

**JSDoc/TSDoc:**
- Not used; minimal documentation approach
- Function purposes clear from names and context

## Function Design

**Size:**
- Typically 5-40 lines per function
- Largest file is `src/index.ts` at 51 lines (entry point with usage function)
- Command implementations: 30-40 lines each
- Utility functions: 2-10 lines each

**Parameters:**
- Prefer explicit parameters over implicit state: `function git(args: string, cwd?: string)`
- Command functions always accept `args: string[]` array from CLI arguments
- Optional parameters use defaults: `const targetDir = args[1] || projectName`

**Return Values:**
- Command handlers return `void` and communicate via console.log/error
- Utility functions return specific types: `string`, `boolean`, `Config`
- Nullable returns use union types: `string | null`
- No implicit undefined returns used

## Module Design

**Exports:**
- Single export per command file: one `export function <command>`
- Multiple exports in utility modules: `export function loadConfig()`, `export function saveConfig()`, etc.
- Interface exports for type sharing: `export interface Config`
- Error class export: `export class GitDriveError`

**Barrel Files:**
- Not used; imports reference specific files directly
- Example: `import { init } from "./commands/init.js"` not `import { init } from "./commands/"`

**Module Responsibilities:**
- `src/config.ts`: Configuration file I/O and drive path utilities
- `src/git.ts`: Git command execution and git repo inspection
- `src/errors.ts`: Error class definition and centralized error handling
- `src/commands/*.ts`: Individual command implementations
- `src/index.ts`: CLI entry point and command router

---

*Convention analysis: 2026-01-22*
