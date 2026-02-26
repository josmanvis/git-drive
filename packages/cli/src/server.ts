import express, { Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { readdirSync, existsSync, mkdirSync, statSync, readFileSync, appendFileSync } from 'fs';
import { execSync } from 'child_process';
import { getDiskInfo } from 'node-disk-info';
import { homedir } from 'os';

const app = express();
const port = process.env.GIT_DRIVE_PORT || 4483;

app.use(express.json());

// Serve static UI files from the ui directory
const uiPath = path.join(__dirname, '..', 'ui');
app.use(express.static(uiPath));

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
      mkdirSync(gitDrivePath, { recursive: true });
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

// ── Server Health Check Utilities ────────────────────────────────────────────

const DEFAULT_PORT = 4483;

export function getServerPort(): number {
  return parseInt(process.env.GIT_DRIVE_PORT || String(DEFAULT_PORT), 10);
}

export async function isServerRunning(port?: number): Promise<boolean> {
  const serverPort = port || getServerPort();
  try {
    const response = await fetch(`http://localhost:${serverPort}/api/drives`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function ensureServerRunning(): Promise<void> {
  const port = getServerPort();
  const running = await isServerRunning(port);
  
  if (!running) {
    console.log('\n  🚀 Starting Git Drive server...\n');
    
    // Start server in detached/background mode
    const serverPath = require.resolve('./server.js');
    const child = spawn(process.execPath, [serverPath], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    });
    
    // Allow the parent process to exit independently
    child.unref();
    
    // Wait a moment for server to start
    let retries = 10;
    while (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 300));
      if (await isServerRunning(port)) {
        break;
      }
      retries--;
    }
    
    if (retries === 0) {
      throw new Error('Failed to start Git Drive server. Please run "git-drive server" manually.');
    }
  }
}

// ── API Routes ───────────────────────────────────────────────────────

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// List all connected drives
app.get('/api/drives', async (_req: Request, res: Response) => {
  try {
    const drives = await getDiskInfo();
    const result = drives
      .filter((d: any) => {
        const mp = d.mounted;
        if (!mp) return false;
        if (mp === "/" || mp === "100%") return false;

        // Exclude temporary and system paths on all platforms
        if (mp.startsWith("/var/") || mp.startsWith("/private/var/") || mp.startsWith("/tmp") || mp.startsWith("/private/tmp")) return false;
        if (mp.includes("TemporaryItems") || mp.includes("NSIRD_")) return false;
        if (mp.startsWith("/System/") || mp.startsWith("/Library/")) return false;

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
        isRemovable: true,
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
app.get('/api/drives/:mountpoint/repos', (req: Request, res: Response) => {
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

// Initialize git-drive on a drive
app.post('/api/drives/:mountpoint/init', (req: Request, res: Response) => {
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
app.post('/api/drives/:mountpoint/repos', (req: Request, res: Response) => {
  try {
    const mountpoint = decodeURIComponent(req.params.mountpoint);
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Repo name is required' });
      return;
    }

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
app.delete('/api/drives/:mountpoint/repos/:repoName', (req: Request, res: Response) => {
  try {
    const mountpoint = decodeURIComponent(req.params.mountpoint);
    const repoName = decodeURIComponent(req.params.repoName);
    const gitDrivePath = getGitDrivePath(mountpoint);

    const bareRepoName = repoName.endsWith('.git') ? repoName : `${repoName}.git`;
    const repoPath = path.join(gitDrivePath, bareRepoName);

    if (!existsSync(repoPath)) {
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
app.get('/api/drives/:mountpoint/repos/:repoName', (req: Request, res: Response) => {
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

    let branches: string[] = [];
    try {
      const branchOutput = git("branch --format='%(refname:short)'", repoPath);
      branches = branchOutput
        .split('\n')
        .map((b) => b.trim().replace(/^'|'$/g, ''))
        .filter(Boolean);
    } catch {}

    let tags: string[] = [];
    try {
      const tagOutput = git("tag", repoPath);
      tags = tagOutput.split('\n').map((t) => t.trim()).filter(Boolean);
    } catch {}

    let lastCommit: { hash: string; message: string; date: string } | null = null;
    try {
      const log = git('log -1 --format="%H|%s|%ci" --all', repoPath);
      if (log) {
        const [hash, message, date] = log.replace(/^"|"$/g, '').split('|');
        lastCommit = { hash, message, date };
      }
    } catch {}

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

// Local status check
app.get('/api/drives/:mountpoint/repos/:repoName/local-status', (req: Request, res: Response) => {
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
      res.json({ linked: false });
      return;
    }

    let hasChanges = false;
    let unpushed = false;
    try {
      const statusOutput = git('status --porcelain', localPath);
      hasChanges = statusOutput.trim().length > 0;
      const unpushedOutput = git('log gd/main..HEAD --oneline', localPath);
      unpushed = unpushedOutput.trim().length > 0;
    } catch {}

    res.json({ linked: true, localPath, hasChanges, unpushed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check local status' });
  }
});

// Push to git-drive
app.post('/api/drives/:mountpoint/repos/:repoName/push', (req: Request, res: Response) => {
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

    try {
      const gitDrivePath = getGitDrivePath(mountpoint);
      const bareRepoName = repoName.endsWith('.git') ? repoName : `${repoName}.git`;
      let repoPath = path.join(gitDrivePath, bareRepoName);
      if (!existsSync(repoPath)) repoPath = path.join(gitDrivePath, repoName);

      const payload = {
        date: new Date().toISOString(),
        computer: homedir(),
        user: process.env.USER || 'local-user',
        localDir: localPath,
        mode: 'web-ui',
      };
      const logFile = path.join(repoPath, "git-drive-pushlog.json");
      appendFileSync(logFile, JSON.stringify(payload) + "\n", "utf-8");
    } catch {}

    res.json({ success: true, message: 'Successfully backed up local code to Git Drive!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to push' });
  }
});

// Browse repository files tree
app.get('/api/drives/:mountpoint/repos/:repoName/tree', (req: Request, res: Response) => {
  try {
    const mountpoint = decodeURIComponent(req.params.mountpoint);
    const repoName = decodeURIComponent(req.params.repoName);
    const branch = (req.query.branch as string) || 'main';
    const treePath = (req.query.path as string) || '';

    const gitDrivePath = getGitDrivePath(mountpoint);
    const bareRepoName = repoName.endsWith('.git') ? repoName : `${repoName}.git`;
    let repoPath = path.join(gitDrivePath, bareRepoName);

    if (!existsSync(repoPath)) {
      repoPath = path.join(gitDrivePath, repoName);
    }

    const target = treePath ? `${branch}:${treePath}` : branch;
    const output = git(`ls-tree ${target}`, repoPath);

    const files = output.split('\n').filter(Boolean).map((line) => {
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
    res.json({ files: [] });
  }
});

// Get commit history
app.get('/api/drives/:mountpoint/repos/:repoName/commits', (req: Request, res: Response) => {
  try {
    const mountpoint = decodeURIComponent(req.params.mountpoint);
    const repoName = decodeURIComponent(req.params.repoName);
    const branch = (req.query.branch as string) || 'main';

    const gitDrivePath = getGitDrivePath(mountpoint);
    const bareRepoName = repoName.endsWith('.git') ? repoName : `${repoName}.git`;
    let repoPath = path.join(gitDrivePath, bareRepoName);

    if (!existsSync(repoPath)) {
      repoPath = path.join(gitDrivePath, repoName);
    }

    let commits: any[] = [];
    try {
      const logOutput = git(`log ${branch} -n 100 --format="%H|%an|%ae|%s|%ci"`, repoPath);
      commits = logOutput
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [hash, author, email, message, date] = line.split('|');
          return { hash, author, email, message, date };
        });
    } catch {}

    let pushLogs: any[] = [];
    try {
      const logFile = path.join(repoPath, "git-drive-pushlog.json");
      if (existsSync(logFile)) {
        const rawLogs = readFileSync(logFile, "utf-8").trim().split('\n');
        pushLogs = rawLogs.map((l) => {
          try { return JSON.parse(l); } catch { return null; }
        }).filter(Boolean);
        pushLogs.reverse();
      }
    } catch {}

    res.json({ commits, pushLogs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve history' });
  }
});

// Get single commit details
app.get('/api/drives/:mountpoint/repos/:repoName/commits/:hash', (req: Request, res: Response) => {
  try {
    const mountpoint = decodeURIComponent(req.params.mountpoint);
    const repoName = decodeURIComponent(req.params.repoName);
    const hash = req.params.hash;

    const gitDrivePath = getGitDrivePath(mountpoint);
    const bareRepoName = repoName.endsWith('.git') ? repoName : `${repoName}.git`;
    let repoPath = path.join(gitDrivePath, bareRepoName);
    if (!existsSync(repoPath)) repoPath = path.join(gitDrivePath, repoName);

    const logOutput = git(`log -1 --format="%H|%an|%ae|%s|%ci" ${hash}`, repoPath);
    const [commitHash, author, email, message, date] = logOutput.split('|');

    const patch = git(`show --format="" ${hash}`, repoPath);

    res.json({ hash: commitHash, author, email, message, date, patch });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve commit details' });
  }
});

// Read raw file content
app.get('/api/drives/:mountpoint/repos/:repoName/blob', (req: Request, res: Response) => {
  try {
    const mountpoint = decodeURIComponent(req.params.mountpoint);
    const repoName = decodeURIComponent(req.params.repoName);
    const branch = (req.query.branch as string) || 'main';
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

// SPA fallback
app.get('*', (_req: Request, res: Response) => {
  const indexPath = path.join(uiPath, 'index.html');
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('UI not built. The package may need to be rebuilt.');
  }
});

// Start server only when run directly (not when imported)
if (require.main === module) {
  app.listen(port, () => {
    console.log(`\n  🚀 Git Drive is running at http://localhost:${port}\n`);
  });
}
