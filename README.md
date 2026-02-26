<div align="center">

# ◈ GIT-DRIVE

**Turn any drive into a git backup remote**

Backup your code to external storage volumes — offline, portable, and completely under your control.

[![npm version](https://img.shields.io/npm/v/git-drive?color=00d9ff&labelColor=0a0e14&style=for-the-badge)](https://www.npmjs.com/package/git-drive)
[![License](https://img.shields.io/badge/license-MIT-00d9ff?labelColor=0a0e14&style=for-the-badge)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-josmanvis/git-drive-00d9ff?labelColor=0a0e14&style=for-the-badge)](https://github.com/josmanvis/git-drive)
[![Docs](https://img.shields.io/badge/Documentation-josmanvis.github.io/git--drive-00d9ff?labelColor=0a0e14&style=for-the-badge)](https://josmanvis.github.io/git-drive/)

<img src="https://img.shields.io/badge/Node.js-≥18-00d9ff?labelColor=0a0e14&style=flat-square" alt="Node.js">
<img src="https://img.shields.io/badge/Platform-macOS|Linux|Windows-00d9ff?labelColor=0a0e14&style=flat-square" alt="Platform">

</div>

---

## ◈ What is Git-Drive?

Git-Drive transforms any connected storage volume into a **git remote repository**. Backup your code offline, transport it physically, or keep complete control of your data — no cloud required.

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Your Code     │─────▶│   Git-Drive     │─────▶│  External Drive │
│   Repository    │      │      CLI        │      │   (USB/HDD)     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

## ◈ Features

| | |
|:---:|:---|
| 🔌 **Offline Backups** | No internet required. Backup directly to USB drives, external HDDs, or network storage. |
| 📦 **Full Git Support** | Works with all git features—branches, tags, history. Your complete repo, preserved. |
| 🖥️ **Web UI** | Beautiful dashboard to manage drives, view repos, and monitor backup status. |
| 💾 **Multi-Drive** | Handle multiple connected drives simultaneously. Backup to different destinations. |
| 🚀 **Companion Mode** | Run git-drive directly from the drive itself. Portable and self-contained. |
| ⚡ **Push-All** | Backup entire directories of repos with a single command. Bulk operations made easy. |

## ◈ Installation

<h4>npm</h4>

```bash
npm install -g git-drive
```

<h4>pnpm</h4>

```bash
pnpm add -g git-drive
```

<h4>yarn</h4>

```bash
yarn global add git-drive
```

<h4>Docker</h4>

```bash
docker compose build
docker compose up -d
docker compose run git-drive-cli <command>
```

## ◈ Quick Start

```bash
# Initialize git-drive on a drive
git-drive init /Volumes/MyDrive

# Link current repo to drive
git-drive link

# Push to drive
git-drive push
```

## ◈ Commands

| Command | Description |
|---------|-------------|
| `init [path]` | Initialize git-drive on an external drive |
| `link` | Link current repo to a drive (interactive) |
| `push` | Push current repo to the linked drive |
| `list` | Show connected drives and their status |
| `status` | Show detailed status of drives and repos |
| `server` | Start the web UI at http://localhost:4483 |
| `companion [path]` | Run git-drive from a drive (portable mode) |
| `push-all <dir>` | Backup all repos in a directory |
| `-v, --version` | Show the installed version |

## ◈ How It Works

```
┌────────────────────────────────────────────────────────────┐
│                         YOUR DRIVE                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    .git-drive/                       │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐       │  │
│  │  │  repo-1/   │ │  repo-2/   │ │  repo-3/   │  ...  │  │
│  │  │  (bare)    │ │  (bare)    │ │  (bare)    │       │  │
│  │  └────────────┘ └────────────┘ └────────────┘       │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

1. **`git-drive init`** creates a `.git-drive/` directory on your drive
2. **`git-drive link`** adds a `git-drive` remote to your repository
3. **`git-drive push`** pushes all branches and tags to the drive

The CLI automatically starts the git-drive server in the background when needed.

## ◈ Companion Mode

Run git-drive directly from your external drive — **no installation required** on the host machine.

```bash
# Run from any drive with git-drive initialized
git-drive companion /Volumes/MyDrive
```

Perfect for:
- Using git-drive on multiple computers
- Accessing backups at a different machine  
- Keeping the drive completely self-contained

## ◈ Push-All Command

Backup your entire development directory in one command:

```bash
git-drive push-all ~/Developer/
```

| Flag | Description |
|------|-------------|
| `--drive <path>` | Non-interactive drive selection |
| `--init-all` | Initialize non-git directories as repos |
| `--skip-non-git` | Skip non-git directories |
| `--force` | Override existing drive links |

## ◈ Development

```bash
# Clone and setup
git clone https://github.com/josmanvis/git-drive.git
cd git-drive
pnpm install
pnpm build
pnpm dev
```

**Project Structure:**

```
packages/
├── cli/          # Command-line interface
├── server/       # Backend server  
└── ui/           # Web UI (React + Vite)
```

## ◈ Publishing

For maintainers — the project uses GitHub Actions for automated npm publishing:

1. Update version in `packages/cli/package.json`
2. Create and push a new git tag
3. CI automatically builds and publishes to npm

> ⚠️ Requires `NPM_TOKEN` secret in GitHub repository settings.

## ◈ Documentation

📖 **Full documentation:** [https://josmanvis.github.io/git-drive/](https://josmanvis.github.io/git-drive/)

## ◈ License

[MIT](LICENSE) — Use it, fork it, improve it.

---

<div align="center">

**[◈ GitHub](https://github.com/josmanvis/git-drive)** · 
**[◈ npm](https://www.npmjs.com/package/git-drive)** · 
**[◈ Documentation](https://josmanvis.github.io/git-drive/)**

Made with ◈ for developers who value their code

</div>