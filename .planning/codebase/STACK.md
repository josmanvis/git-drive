# Technology Stack

**Analysis Date:** 2026-01-22

## Languages

**Primary:**
- TypeScript 5.9.3 - All source code

**Runtime:**
- Node.js 14.17+ (from TypeScript compiler requirement)

## Runtime

**Environment:**
- Node.js (ES2022 target)

**Package Manager:**
- npm - Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- None - Native Node.js modules only
- Uses built-in modules: `child_process`, `fs`, `path`, `os`

**Build/Dev:**
- TypeScript 5.9.3 - Compilation from `src/` to `dist/`
- Module system: Node16 ESM

## Key Dependencies

**Development Only:**
- `typescript` 5.9.3 - TypeScript compiler
- `@types/node` 22.19.7 - Type definitions for Node.js built-in modules

**Runtime Dependencies:**
- None - Zero runtime dependencies

## Configuration

**Environment:**
- Configuration directory: `~/.config/git-drive/config.json`
- Stores single configuration: `drivePath` (external drive path)
- Configuration persisted as JSON

**Build:**
- TypeScript compiler config: `tsconfig.json`
- Target: ES2022
- Module resolution: Node16 (ESM)
- Output: `./dist` directory
- Input: `./src` directory

## Compiler Options

**Settings:**
- `strict: true` - Strict type checking enabled
- `esModuleInterop: true` - CommonJS compatibility for imports
- `declaration: false` - No `.d.ts` generation
- `sourceMap: false` - No source maps
- `moduleResolution: Node16` - Node.js ESM module resolution

## Project Metadata

**Type:** Command-line tool (bin entry point)

**Entry Point:**
- Executable: `dist/index.js`
- Command: `git-drive` (registered via package.json bin)

**Build Scripts:**
- `npm run build` - Compile TypeScript to `dist/`
- `npm run dev` - Watch mode compilation

---

*Stack analysis: 2026-01-22*
