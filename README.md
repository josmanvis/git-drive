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
# Link current repo to a drive
git-drive link

# Push current repo to drive
git-drive push

# Show projects on drive
git-drive list

# Check drive and repo state
git-drive status
```

## How it works

Run the git-drive (available as a docker container). In the web ui (localhost:4483) just select the drive you want to use (this will create a `.git-drive/` directory in that drive if it doesnt already have it). Here you can see a list of existing repos in this drive (`.git-drive/*`) or add new ones so you can push your code to.

Installing git-drive also installs a git-drive cli which can do all of the same things as the web ui. Users can link their current codebase to any connected drive with `git-drive link` this should create the repo in git-drive if it doesnt already exist. Then add a new remote (`git remote add git-drive .........`) and pushing to that new remote "git-drive".

Git-drive can handle scenarios where multiple git-drive volumes are connected.

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