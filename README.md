# GIT-DRIVE

Git drive is an app that can turn any connected storage volume into another git remote repo you can use to backup your code.

## Installation

### npm

```bash
npm install -g git-drive
```

### pnpm

```bash
pnpm add -g git-drive
```

### yarn

```bash
yarn global add git-drive
```

## Quick Start

Once installed, you can use the `git-drive` command:

```bash
# Show version
git-drive -v

# Initialize git-drive on a drive (prompts to select if no path given)
git-drive init
git-drive init /Volumes/MyDrive

# Link current repo to a drive
git-drive link

# Push current repo to drive
git-drive push

# Show projects on drive
git-drive list

# Check drive and repo state
git-drive status

# Start the web UI server
git-drive server
```

## Commands

| Command | Description |
|---------|-------------|
| `init [path]` | Initialize git-drive on an external drive. Prompts for drive selection if no path provided. |
| `link` | Link current repo to a drive (interactive selection) |
| `push` | Push current repo to the linked drive |
| `push-all <dir>` | Backup all repos in a directory to a drive (see below) |
| `list` | Show connected drives and their status |
| `status` | Show detailed status of drives and repos |
| `companion [path]` | Run git-drive from a drive (companion mode) - see below |
| `server`, `start`, `ui` | Start the git-drive web UI server at http://localhost:4483 |
| `-v`, `-V`, `--version`, `version` | Show the installed version |

## Companion Mode

Companion mode allows you to run git-drive directly from an external drive, making it portable and self-contained. This is useful when:

- You want to use git-drive on multiple computers without installing it
- You're at a different machine and need to access your backups
- You want the drive to be completely self-contained

### Using Companion Mode

When you run `git-drive init` on a drive, it automatically installs a companion copy of git-drive on that drive. To use it:

```bash
# Interactive selection - shows drives with git-drive initialized
git-drive companion

# Direct path - run companion mode from a specific drive
git-drive companion /Volumes/MyDrive
```

This will:
1. Find an available port (starting from 4484)
2. Start the git-drive server in companion mode
3. Open your browser to the web UI
4. Show only the companion drive in the UI

Press Enter to stop the companion server.

### Companion Mode Features

- **Portable**: The companion is stored on the drive itself
- **Self-updating**: The companion can be updated from the web UI
- **Version tracking**: Shows companion version and update availability
- **Port detection**: Automatically finds an available port if the default is in use

## Push-All Command

The `push-all` command lets you backup all repositories in a directory with a single command:

```bash
# Backup all repos in a directory
git-drive push-all ~/Developer/

# With options
git-drive push-all ~/Developer/ --drive /Volumes/MyUSB    # Non-interactive drive selection
git-drive push-all ~/Developer/ --init-all                # Initialize non-git directories as repos
git-drive push-all ~/Developer/ --skip-non-git            # Skip non-git directories
git-drive push-all ~/Developer/ --force                   # Override existing drive links
```

### Features

- **Auto-discovery**: Scans directory for git repositories and non-git projects
- **Non-git handling**: Offers to initialize non-git projects as git repos before backing up
- **Full backup**: Pushes all branches and tags for each repository
- **Auto-link**: Automatically links each repo to the selected drive
- **Progress tracking**: Shows real-time progress and summary

### Options

| Flag | Description |
|------|-------------|
| `--drive <path>` | Specify the target drive (non-interactive) |
| `--init-all` | Automatically initialize all non-git projects |
| `--skip-non-git` | Skip non-git directories without prompting |
| `--force` | Re-link repos that are already linked to a different drive |

## How it works

Run the git-drive (available as a docker container). In the web ui (localhost:4483) just select the drive you want to use (this will create a `.git-drive/` directory in that drive if it doesnt already have it). Here you can see a list of existing repos in this drive (`.git-drive/*`) or add new ones so you can push your code to.

Installing git-drive also installs a git-drive cli which can do all of the same things as the web ui. Users can link their current codebase to any connected drive with `git-drive link` this should create the repo in git-drive if it doesnt already exist. Then add a new remote (`git remote add git-drive .........`) and pushing to that new remote "git-drive".

Git-drive can handle scenarios where multiple git-drive volumes are connected.

### Auto-Start Server

The CLI automatically starts the git-drive server in the background when needed. This means commands like `link`, `push`, `list`, and `status` work immediately without manually starting the server first.

## Docker

You can also run git-drive via Docker:

```bash
# Build the Docker image
docker compose build

# Run the container
docker compose up -d

# Use the CLI through Docker
docker compose run git-drive-cli <command>
```

## Development

```bash
# Clone the repository
git clone https://github.com/josmanvis/git-drive.git
cd git-drive

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run in development mode
pnpm dev
```

## Publishing (Maintainers)

The project uses GitHub Actions for automated publishing to npm. To publish a new version:

1. Update the version in `packages/cli/package.json`
2. Create a new git tag and push to main
3. The CI will automatically build and publish to npm

Make sure to set the `NPM_TOKEN` secret in your GitHub repository settings.

## License

MIT