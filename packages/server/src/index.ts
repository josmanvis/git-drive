import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, existsSync, mkdirSync, statSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { getDiskInfo } from 'node-disk-info';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 4483;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../../../packages/ui/dist')));

// ── Helpers ──────────────────────────────────────────────────────────

function git(args: string, cwd?: string): string {
  return execSync(`git ${args}`, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function getGitDrivePath(mountpoint: string): string {
  return path.join(mountpoint, '.git-drive');
}

function ensureGitDriveDir(mountpoint: string): string {
  const gitDrivePath = getGitDrivePath(mountpoint);
  if (!existsSync(gitDrivePath)) {
    try {
      execSync(`mkdir -p "${gitDrivePath}"`);
    } catch (err: any) {
      throw new Error(`Failed to write to drive. Please ensure Terminal/Node has "Removable Volumes" access in macOS Privacy settings. Details: ${err.message}`);
    }
  }
  return gitDrivePath;
}

function listRepos(gitDrivePath: string): Array<{ name: string; path: string; lastModified: string }> {
  if (!existsSync(gitDrivePath)) return [];

  return readdirSync(gitDrivePath)
    .filter((entry) => {
      const entryPath = path.join(gitDrivePath, entry);
      // Accept both bare repos (name.git) and directories with HEAD file
      return (
        statSync(entryPath).isDirectory() &&
        (entry.endsWith('.git') || existsSync(path.join(entryPath, 'HEAD')))
      );
    })
    .map((entry) => {
      const entryPath = path.join(gitDrivePath, entry);
      const stat = statSync(entryPath);
      return {
        name: entry.replace(/\.git$/, ''),
        path: entryPath,
        lastModified: stat.mtime.toISOString(),
      };
    });
}

function loadLinks(): Record<string, { mountpoint: string; repoName: string; linkedAt: string }> {
  const linksFile = path.join(homedir(), '.config', 'git-drive', 'links.json');
  if (!existsSync(linksFile)) return {};
  try {
    return JSON.parse(readFileSync(linksFile, 'utf-8'));
  } catch {
    return {};
  }
}

// ── API Routes ───────────────────────────────────────────────────────

// List all connected drives
app.get('/api/drives', async (_req, res) => {
  try {
    const drives = await getDiskInfo();
    const result = drives
      .filter((d: any) => {
        const mp = d.mounted;
        if (!mp) return false;
        if (mp === "/" || mp === "100%") return false;

        if (process.platform === "darwin") {
          return mp.startsWith("/Volumes/") && !mp.startsWith("/Volumes/Recovery");
        }

        if (mp.startsWith("/sys") || mp.startsWith("/proc") || mp.startsWith("/run") || mp.startsWith("/snap") || mp.startsWith("/boot")) return false;
        if (d.filesystem === "tmpfs" || d.filesystem === "devtmpfs" || d.filesystem === "udev" || d.filesystem === "overlay") return false;

        return true;
      })
      .map((d: any) => ({
        device: d.filesystem,
        description: d.mounted,
        size: d.blocks ? parseInt(d.blocks) * 1024 : 0,
        isRemovable: true, // simplified assumption
        isSystem: d.mounted === '/',
        mountpoints: [d.mounted],
        hasGitDrive: existsSync(getGitDrivePath(d.mounted)),
      }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list drives' });
  }
});

// List repos on a specific drive
app.get('/api/drives/:mountpoint/repos', (req, res) => {
  try {
    const mountpoint = decodeURIComponent(req.params.mountpoint);
    const gitDrivePath = getGitDrivePath(mountpoint);

    if (!existsSync(mountpoint)) {
      res.status(404).json({ error: 'Drive not found or not mounted' });
      return;
    }

    const repos = listRepos(gitDrivePath);
    res.json({
      mountpoint,
      gitDrivePath,
      initialized: existsSync(gitDrivePath),
      repos,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list repos' });
  }
});

// Initialize git-drive on a drive (create .git-drive directory)
app.post('/api/drives/:mountpoint/init', (req, res) => {
  try {
    const mountpoint = decodeURIComponent(req.params.mountpoint);

    if (!existsSync(mountpoint)) {
      res.status(404).json({ error: 'Drive not found or not mounted' });
      return;
    }

    const gitDrivePath = ensureGitDriveDir(mountpoint);
    res.json({
      mountpoint,
      gitDrivePath,
      message: 'Git Drive initialized on this drive',
    });
  } catch (err: any) {
    console.error("Init Error:", err);
    res.status(500).json({ error: err.message || 'Failed to initialize drive' });
  }
});

// Create a new bare repo on a drive
app.post('/api/drives/:mountpoint/repos', (req, res) => {
  try {
    const mountpoint = decodeURIComponent(req.params.mountpoint);
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Repo name is required' });
      return;
    }

    // Sanitize name
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '-');

    if (!existsSync(mountpoint)) {
      res.status(404).json({ error: 'Drive not found or not mounted' });
      return;
    }

    const gitDrivePath = ensureGitDriveDir(mountpoint);
    const repoName = safeName.endsWith('.git') ? safeName : `${safeName}.git`;
    const repoPath = path.join(gitDrivePath, repoName);

    if (existsSync(repoPath)) {
      res.status(409).json({ error: 'Repository already exists' });
      return;
    }

    git(`init --bare "${repoPath}"`);

    res.status(201).json({
      name: safeName.replace(/\.git$/, ''),
      path: repoPath,
      message: `Bare repository created: ${repoName}`,
      remoteUrl: repoPath,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create repository' });
  }
});

// Delete a repo from a drive
app.delete('/api/drives/:mountpoint/repos/:repoName', (req, res) => {
  try {
    const mountpoint = decodeURIComponent(req.params.mountpoint);
    const repoName = decodeURIComponent(req.params.repoName);
    const gitDrivePath = getGitDrivePath(mountpoint);

    const bareRepoName = repoName.endsWith('.git') ? repoName : `${repoName}.git`;
    const repoPath = path.join(gitDrivePath, bareRepoName);

    if (!existsSync(repoPath)) {
      // Also check without .git suffix
      const altPath = path.join(gitDrivePath, repoName);
      if (!existsSync(altPath)) {
        res.status(404).json({ error: 'Repository not found' });
        return;
      }
      execSync(`rm -rf "${altPath}"`);
    } else {
      execSync(`rm -rf "${repoPath}"`);
    }

    res.json({ message: `Repository '${repoName}' deleted` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete repository' });
  }
});

// Get info about a specific repo
app.get('/api/drives/:mountpoint/repos/:repoName', (req, res) => {
  try {
    const mountpoint = decodeURIComponent(req.params.mountpoint);
    const repoName = decodeURIComponent(req.params.repoName);
    const gitDrivePath = getGitDrivePath(mountpoint);

    const bareRepoName = repoName.endsWith('.git') ? repoName : `${repoName}.git`;
    let repoPath = path.join(gitDrivePath, bareRepoName);

    if (!existsSync(repoPath)) {
      repoPath = path.join(gitDrivePath, repoName);
      if (!existsSync(repoPath)) {
        res.status(404).json({ error: 'Repository not found' });
        return;
      }
    }

    // Get branches
    let branches: string[] = [];
    try {
      const branchOutput = git("branch --format='%(refname:short)'", repoPath);
      branches = branchOutput
        .split('\n')
        .map((b) => b.trim().replace(/^'|'$/g, ''))
        .filter(Boolean);
    } catch {
      // Empty repo has no branches
    }

    // Get tags
    let tags: string[] = [];
    try {
      const tagOutput = git("tag", repoPath);
      tags = tagOutput
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean);
    } catch {
      // No tags
    }

    // Get last commit info
    let lastCommit: { hash: string; message: string; date: string } | null = null;
    try {
      const log = git('log -1 --format="%H|%s|%ci" --all', repoPath);
      if (log) {
        const [hash, message, date] = log.replace(/^"|"$/g, '').split('|');
        lastCommit = { hash, message, date };
      }
    } catch {
      // Empty repo
    }

    const stat = statSync(repoPath);

    res.json({
      name: repoName.replace(/\.git$/, ''),
      path: repoPath,
      branches,
      tags,
      lastCommit,
      lastModified: stat.mtime.toISOString(),
      remoteUrl: repoPath,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get repo info' });
  }
});

// Check if there are local working directory unpushed changes
app.get('/api/drives/:mountpoint/repos/:repoName/local-status', (req, res) => {
  try {
    const mountpoint = decodeURIComponent(req.params.mountpoint);
    let repoName = decodeURIComponent(req.params.repoName);
    repoName = repoName.replace(/\.git$/, '');

    const links = loadLinks();
    let localPath: string | null = null;

    // Find if this specific drive's repo is globally linked to any local folder on the user's machine
    for (const [p, data] of Object.entries(links)) {
      if (data.mountpoint === mountpoint && data.repoName.replace(/\.git$/, '') === repoName) {
        if (existsSync(p)) {
          localPath = p;
          break;
        }
      }
    }

    if (!localPath) {
      res.json({ linked: false });
      return;
    }

    // Check git status locally
    let hasChanges = false;
    let unpushed = false;
    try {
      const statusOutput = git('status --porcelain', localPath);
      hasChanges = statusOutput.trim().length > 0;

      const unpushedOutput = git('log gd/main..HEAD --oneline', localPath); // Assuming main for now
      unpushed = unpushedOutput.trim().length > 0;
    } catch {
      // Ignore git errors if repo is in weird state
    }

    res.json({
      linked: true,
      localPath,
      hasChanges,
      unpushed
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check local status' });
  }
});

// Remotely push local working directory to git-drive
app.post('/api/drives/:mountpoint/repos/:repoName/push', (req, res) => {
  try {
    const mountpoint = decodeURIComponent(req.params.mountpoint);
    let repoName = decodeURIComponent(req.params.repoName);
    repoName = repoName.replace(/\.git$/, '');

    const links = loadLinks();
    let localPath: string | null = null;
    for (const [p, data] of Object.entries(links)) {
      if (data.mountpoint === mountpoint && data.repoName.replace(/\.git$/, '') === repoName) {
        if (existsSync(p)) {
          localPath = p;
          break;
        }
      }
    }

    if (!localPath) {
      res.status(404).json({ error: 'Local linked repository not found.' });
      return;
    }

    git('push gd --all', localPath);
    git('push gd --tags', localPath);

    // Save push telemetry
    try {
      const gitDrivePath = getGitDrivePath(mountpoint);
      const bareRepoName = repoName.endsWith('.git') ? repoName : `${repoName}.git`;
      let repoPath = path.join(gitDrivePath, bareRepoName);
      if (!existsSync(repoPath)) repoPath = path.join(gitDrivePath, repoName);

      const payload = {
        date: new Date().toISOString(),
        computer: homedir(), // Server relies on os module
        user: process.env.USER || 'local-user',
        localDir: localPath,
        mode: 'web-ui',
      };
      const logFile = path.join(repoPath, "git-drive-pushlog.json");
      const fs = require('fs');
      fs.appendFileSync(logFile, JSON.stringify(payload) + "\n", "utf-8");
    } catch { }

    res.json({ success: true, message: 'Successfully backed up local code to Git Drive!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to push' });
  }
});

// Browse repository files tree
app.get('/api/drives/:mountpoint/repos/:repoName/tree', (req, res) => {
  try {
    const mountpoint = decodeURIComponent(req.params.mountpoint);
    const repoName = decodeURIComponent(req.params.repoName);
    const branch = req.query.branch || 'main'; // Provide a default if they use main
    const treePath = (req.query.path as string) || '';

    const gitDrivePath = getGitDrivePath(mountpoint);
    const bareRepoName = repoName.endsWith('.git') ? repoName : `${repoName}.git`;
    let repoPath = path.join(gitDrivePath, bareRepoName);

    if (!existsSync(repoPath)) {
      repoPath = path.join(gitDrivePath, repoName);
    }

    // Resolves default branch if passed "HEAD" or empty logic. Safely ask git for HEAD branch:
    let targetBranch = branch as string;
    if (!targetBranch) {
      try {
        const branchOutput = git('branch --show-current', repoPath);
        targetBranch = branchOutput || 'HEAD';
      } catch {
        targetBranch = 'main';
      }
    }

    // git ls-tree
    const target = treePath ? `${targetBranch}:${treePath}` : targetBranch;
    const output = git(`ls-tree ${target}`, repoPath);

    const files = output.split('\n').filter(Boolean).map((line) => {
      // 040000 tree <hash>\t<path>
      // 100644 blob <hash>\t<path>
      const parts = line.split('\t');
      const meta = parts[0].split(' ');
      return {
        mode: meta[0],
        type: meta[1],
        hash: meta[2],
        path: parts[1],
        name: parts[1].split('/').pop(),
      };
    });

    res.json({ files });
  } catch (err) {
    res.json({ files: [] }); // Typically happens if repo has zero commits
  }
});

// Get combined git commit history and git-drive push logs
app.get('/api/drives/:mountpoint/repos/:repoName/commits', (req, res) => {
  try {
    const mountpoint = decodeURIComponent(req.params.mountpoint);
    const repoName = decodeURIComponent(req.params.repoName);
    const branch = req.query.branch || 'main'; // Using branch filters

    const gitDrivePath = getGitDrivePath(mountpoint);
    const bareRepoName = repoName.endsWith('.git') ? repoName : `${repoName}.git`;
    let repoPath = path.join(gitDrivePath, bareRepoName);

    if (!existsSync(repoPath)) {
      repoPath = path.join(gitDrivePath, repoName);
    }

    // Git commits log
    let commits: any[] = [];
    try {
      // hash|authorName|authorEmail|message|date
      const logOutput = git(`log ${branch} -n 100 --format="%H|%an|%ae|%s|%ci"`, repoPath);
      commits = logOutput
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [hash, author, email, message, date] = line.split('|');
          return { hash, author, email, message, date };
        });
    } catch (e) {
      // Empty repo or invalid branch
    }

    // Git drive push logs overlay
    let pushLogs: any[] = [];
    try {
      const logFile = path.join(repoPath, "git-drive-pushlog.json");
      if (existsSync(logFile)) {
        const rawLogs = require('fs').readFileSync(logFile, "utf-8").trim().split('\n');
        pushLogs = rawLogs.map((l: string) => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        }).filter(Boolean);
        pushLogs.reverse(); // Newest first
      }
    } catch { }

    res.json({ commits, pushLogs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve history' });
  }
});

// Get single commit details (patch/diff)
app.get('/api/drives/:mountpoint/repos/:repoName/commits/:hash', (req, res) => {
  try {
    const mountpoint = decodeURIComponent(req.params.mountpoint);
    const repoName = decodeURIComponent(req.params.repoName);
    const hash = req.params.hash;

    const gitDrivePath = getGitDrivePath(mountpoint);
    const bareRepoName = repoName.endsWith('.git') ? repoName : `${repoName}.git`;
    let repoPath = path.join(gitDrivePath, bareRepoName);
    if (!existsSync(repoPath)) repoPath = path.join(gitDrivePath, repoName);

    // hash|authorName|authorEmail|message|date
    const logOutput = git(`log -1 --format="%H|%an|%ae|%s|%ci" ${hash}`, repoPath);
    const [commitHash, author, email, message, date] = logOutput.split('|');

    // Get the diff/patch
    const patch = git(`show --format="" ${hash}`, repoPath);

    res.json({
      hash: commitHash,
      author,
      email,
      message,
      date,
      patch
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve commit details' });
  }
});

// Read raw file content
app.get('/api/drives/:mountpoint/repos/:repoName/blob', (req, res) => {
  try {
    const mountpoint = decodeURIComponent(req.params.mountpoint);
    const repoName = decodeURIComponent(req.params.repoName);
    const branch = req.query.branch || 'main';
    const filePath = req.query.path as string;

    const gitDrivePath = getGitDrivePath(mountpoint);
    const bareRepoName = repoName.endsWith('.git') ? repoName : `${repoName}.git`;
    let repoPath = path.join(gitDrivePath, bareRepoName);

    if (!existsSync(repoPath)) {
      repoPath = path.join(gitDrivePath, repoName);
    }

    const content = git(`show ${branch}:${filePath}`, repoPath);
    res.send(content);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (_req, res) => {
  const indexPath = path.join(__dirname, '../../../packages/ui/dist', 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('UI not built. Run: pnpm build:ui');
  }
});

app.listen(port, () => {
  console.log(`\n  🚀 Git Drive is running at http://localhost:${port}\n`);
});
