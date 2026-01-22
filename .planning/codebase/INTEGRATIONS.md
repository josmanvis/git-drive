# External Integrations

**Analysis Date:** 2026-01-22

## APIs & External Services

**None Detected**

No third-party APIs or external services are used in this codebase.

## Data Storage

**Databases:**
- Not used - No database integration

**File Storage:**
- Local filesystem only
  - Configuration: `~/.config/git-drive/config.json` (user home directory)
  - Git repositories: External USB drive or mounted filesystem
  - Client: Built-in Node.js `fs` module (promises-based)

**Caching:**
- Not used

## Authentication & Identity

**Auth Provider:**
- Custom - No authentication provider integrated
- Approach: File-based configuration with implicit trust of drive mount

## Monitoring & Observability

**Error Tracking:**
- Not used

**Logs:**
- Console output only
- Error handling: `console.error()` for errors, `console.log()` for standard output
- No persistent logging

## CI/CD & Deployment

**Hosting:**
- npm registry only (published as package)
- Local development installation

**CI Pipeline:**
- Not configured - No CI configuration detected

## Environment Configuration

**Required Configuration:**
- External drive path (configured once via `git drive init <path>`)
- No environment variables used
- No `.env` files required

**Configuration Storage:**
- User configuration: `~/.config/git-drive/config.json`
- Format: JSON
- Structure:
  ```json
  {
    "drivePath": "/Volumes/ExternalDrive"
  }
  ```

## System Integration

**Git Integration:**
- Uses `git` command-line tool (via `execSync`)
- Communicates with Git CLI for repository operations:
  - `git rev-parse` - Get repository root
  - `git init --bare` - Create bare repositories
  - `git remote` - Manage git remotes
  - `git push` - Push commits to bare repository
  - `git clone` - Clone from bare repository

**File System Integration:**
- Direct file system access for:
  - Drive detection and mounting verification
  - Repository storage organization
  - Project metadata (modification times)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

---

*Integration audit: 2026-01-22*
