# Codebase Structure

**Analysis Date:** 2026-01-22

## Directory Layout

```
git-drive/
├── src/                    # TypeScript source code
│   ├── commands/           # Command handlers (6 modules)
│   │   ├── init.ts
│   │   ├── push.ts
│   │   ├── archive.ts
│   │   ├── restore.ts
│   │   ├── list.ts
│   │   └── status.ts
│   ├── index.ts            # CLI entry point with command dispatch
│   ├── config.ts           # Configuration management
│   ├── git.ts              # Git command abstraction layer
│   └── errors.ts           # Error types and formatting
├── dist/                   # Compiled JavaScript (generated)
│   └── commands/
├── .planning/              # Planning documents (generated)
│   └── codebase/
├── package.json            # npm configuration and dependencies
├── tsconfig.json           # TypeScript compiler options
└── .gitignore              # Git ignore patterns
```

## Directory Purposes

**src/ (Source Code):**
- Purpose: All TypeScript source files for the application
- Contains: Entry point, command implementations, utilities, error definitions
- Key files: `index.ts` (entry), `commands/` (all command logic)

**src/commands/ (Command Implementations):**
- Purpose: Individual command handler modules, each implementing one CLI command
- Contains: init, push, archive, restore, list, status command logic
- Key files: Each file exports a function matching (args: string[]) => void signature

**dist/ (Compiled Output):**
- Purpose: Generated JavaScript output from TypeScript compilation
- Contains: Transpiled .js files mirroring src/ structure
- Generated: Yes
- Committed: No (in .gitignore)

**.planning/codebase/ (Analysis Documents):**
- Purpose: GSD codebase documentation for code generation planning
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md (when written)
- Generated: Yes (by orchestrator)
- Committed: Yes (version controlled for reference)

## Key File Locations

**Entry Points:**
- `src/index.ts`: Main CLI entry point; shebang executable; imports all commands and dispatches by name

**Configuration:**
- `src/config.ts`: Config loading/saving; configuration file location: ~/.config/git-drive/config.json
- `tsconfig.json`: TypeScript compilation target ES2022, Node16 modules, strict mode enabled

**Core Logic:**
- `src/git.ts`: git command wrapper; Repository queries (root, project name, remotes)
- `src/errors.ts`: GitDriveError type; handleError() formatter for console output
- `src/commands/*.ts`: Six command modules; each handles one CLI operation

**Testing:**
- Not applicable (no test files present)

## Naming Conventions

**Files:**
- `camelCase.ts` for source files: index.ts, config.ts, git.ts, errors.ts
- Command files match command names: init.ts, push.ts, archive.ts, restore.ts, list.ts, status.ts
- Compiled output: `camelCase.js` in dist/ directory

**Directories:**
- `lowercase/` for directory names: src, dist, commands, .planning
- Domain-specific grouping: commands/ contains all CLI command handlers

**Functions:**
- camelCase for all functions: init(), push(), archive(), restore(), list(), status(), git(), loadConfig(), saveConfig(), etc.
- Handler functions export command function: export function {command}(args: string[])
- Utility functions use descriptive names: getRepoRoot(), getProjectName(), getDriveStorePath(), assertDriveMounted()

**Types/Interfaces:**
- PascalCase for types: GitDriveError, Config
- Config interface has required properties in camelCase: drivePath

**Variables:**
- camelCase for all variables and parameters: args, config, drivePath, projectName, storePath, bareRepoPath, etc.

## Where to Add New Code

**New Command:**
1. Create new file in `src/commands/{command-name}.ts`
2. Export function matching signature: `export function {command-name}(args: string[]): void`
3. Import in `src/index.ts` at top: `import { {command-name} } from "./commands/{command-name}.js"`
4. Add to commands record: `{command-name},` in commands object
5. Add help text to printUsage() function
6. Implementation pattern: validate args → load config → assert prerequisites → perform operation → console.log() result

**New Utility Module:**
1. Create file at `src/{utility-name}.ts` (e.g., src/cache.ts, src/validate.ts)
2. Export functions with clear names
3. Import in commands that need them
4. Follow error handling pattern: throw GitDriveError for application errors

**Config Changes:**
1. Update Config interface in `src/config.ts` (add new property)
2. Update loadConfig() and saveConfig() JSON serialization (happens automatically)
3. Update requireConfig() validation if new field is required
4. Update all dependent code to access new property

**Git Operations:**
1. Add new helper function in `src/git.ts`
2. Follow pattern: use git() wrapper, return trimmed output or null on error
3. Add try-catch for git() calls that might fail gracefully
4. Import and use in commands

**Error Handling:**
1. Throw GitDriveError with descriptive message for user-facing errors
2. Let system errors propagate; main handler extracts stderr from execSync
3. Messages should be actionable: "... Run: git drive init <path>"

## Special Directories

**dist/ (Build Output):**
- Purpose: Generated JavaScript from TypeScript compilation via `npm run build`
- Generated: Yes
- Committed: No

**.planning/codebase/ (Documentation):**
- Purpose: Store GSD analysis documents for code generation planning
- Generated: Yes (orchestrator writes these)
- Committed: Yes (version controlled)

**.claude/ (Context Storage):**
- Purpose: Agent context and state (auto-generated by Claude agent)
- Generated: Yes
- Committed: No

## Import Patterns

**External Modules:**
- Node.js built-ins only: fs, child_process, path, os
- No npm dependencies (dev-only: typescript, @types/node)

**Internal Imports:**
- Use .js extensions in import statements (for ES Module compatibility): `import { init } from "./commands/init.js"`
- Relative imports: `../config.js`, `../errors.js`, `../git.js`
- Path aliases: Not used; relative imports preferred

---

*Structure analysis: 2026-01-22*
