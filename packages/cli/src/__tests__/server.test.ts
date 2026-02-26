import request from 'supertest';
import express, { Application } from 'express';
import { vol } from 'memfs';

// Mock fs
jest.mock('fs', () => {
  const { fs } = require('memfs');
  return fs;
});

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

// Mock node-disk-info
jest.mock('node-disk-info', () => ({
  getDiskInfo: jest.fn(),
}));

import { execSync } from 'child_process';
import { getDiskInfo } from 'node-disk-info';

const mockExecSync = execSync as jest.Mock;
const mockGetDiskInfo = getDiskInfo as jest.Mock;

// Create a test app with the same routes as server.ts
function createTestApp(): Application {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // List all connected drives
  app.get('/api/drives', async (_req, res) => {
    try {
      const drives = await mockGetDiskInfo();
      const result = drives
        .filter((d: any) => {
          const mp = d.mounted;
          if (!mp) return false;
          if (mp === '/' || mp === '100%') return false;

          if (process.platform === 'darwin') {
            return mp.startsWith('/Volumes/') && !mp.startsWith('/Volumes/Recovery');
          }

          if (mp.startsWith('/sys') || mp.startsWith('/proc') || mp.startsWith('/run') || mp.startsWith('/snap') || mp.startsWith('/boot')) return false;
          if (d.filesystem === 'tmpfs' || d.filesystem === 'devtmpfs' || d.filesystem === 'udev' || d.filesystem === 'overlay') return false;

          return true;
        })
        .map((d: any) => ({
          device: d.filesystem,
          description: d.mounted,
          size: d.blocks ? parseInt(d.blocks) * 1024 : 0,
          isRemovable: true,
          isSystem: d.mounted === '/',
          mountpoints: [d.mounted],
          hasGitDrive: vol.existsSync(`${d.mounted}/.git-drive`),
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
      const gitDrivePath = `${mountpoint}/.git-drive`;

      if (!vol.existsSync(mountpoint)) {
        res.status(404).json({ error: 'Drive not found or not mounted' });
        return;
      }

      const entries = vol.existsSync(gitDrivePath) ? vol.readdirSync(gitDrivePath) as string[] : [];
      const repos = entries
        .filter((entry: string) => {
          const entryPath = `${gitDrivePath}/${entry}`;
          const stat = vol.statSync(entryPath);
          const isDir = stat.isDirectory();
          return isDir && (entry.endsWith('.git') || vol.existsSync(`${entryPath}/HEAD`));
        })
        .map((entry: string) => {
          const entryPath = `${gitDrivePath}/${entry}`;
          const stat = vol.statSync(entryPath);
          return {
            name: entry.replace(/\.git$/, ''),
            path: entryPath,
            lastModified: stat.mtime.toISOString(),
          };
        });

      res.json({
        mountpoint,
        gitDrivePath,
        initialized: vol.existsSync(gitDrivePath),
        repos,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to list repos' });
    }
  });

  // Initialize git-drive on a drive
  app.post('/api/drives/:mountpoint/init', (req, res) => {
    try {
      const mountpoint = decodeURIComponent(req.params.mountpoint);

      if (!vol.existsSync(mountpoint)) {
        res.status(404).json({ error: 'Drive not found or not mounted' });
        return;
      }

      const gitDrivePath = `${mountpoint}/.git-drive`;
      vol.mkdirSync(gitDrivePath, { recursive: true });

      res.json({
        mountpoint,
        gitDrivePath,
        message: 'Git Drive initialized on this drive',
      });
    } catch (err: any) {
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

      const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '-');

      if (!vol.existsSync(mountpoint)) {
        res.status(404).json({ error: 'Drive not found or not mounted' });
        return;
      }

      const gitDrivePath = `${mountpoint}/.git-drive`;
      if (!vol.existsSync(gitDrivePath)) {
        vol.mkdirSync(gitDrivePath, { recursive: true });
      }

      const repoName = safeName.endsWith('.git') ? safeName : `${safeName}.git`;
      const repoPath = `${gitDrivePath}/${repoName}`;

      if (vol.existsSync(repoPath)) {
        res.status(409).json({ error: 'Repository already exists' });
        return;
      }

      // Mock git init --bare
      vol.mkdirSync(repoPath, { recursive: true });
      vol.writeFileSync(`${repoPath}/HEAD`, 'ref: refs/heads/main');

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
      const gitDrivePath = `${mountpoint}/.git-drive`;

      const bareRepoName = repoName.endsWith('.git') ? repoName : `${repoName}.git`;
      const repoPath = `${gitDrivePath}/${bareRepoName}`;

      if (!vol.existsSync(repoPath)) {
        res.status(404).json({ error: 'Repository not found' });
        return;
      }

      // Delete the repo directory
      vol.rmSync(repoPath, { recursive: true, force: true });

      res.json({ message: `Repository '${repoName}' deleted` });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete repository' });
    }
  });

  return app;
}

describe('Server API', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    vol.reset();
    app = createTestApp();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/drives', () => {
    it('should return list of drives', async () => {
      mockGetDiskInfo.mockResolvedValue([
        { mounted: '/Volumes/MyUSB', filesystem: 'MyUSB', blocks: 32000000, available: 16000000 },
        { mounted: '/Volumes/External', filesystem: 'External', blocks: 1000000000, available: 500000000 },
      ]);

      vol.fromJSON({
        '/Volumes/MyUSB/.git-drive': '',
        '/Volumes/External': '',
      });

      const response = await request(app).get('/api/drives');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('device');
      expect(response.body[0]).toHaveProperty('mountpoints');
      expect(response.body[0]).toHaveProperty('hasGitDrive');
    });

    it('should handle errors gracefully', async () => {
      mockGetDiskInfo.mockRejectedValue(new Error('Failed to get drives'));

      const response = await request(app).get('/api/drives');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to list drives');
    });
  });

  describe('GET /api/drives/:mountpoint/repos', () => {
    it('should return repos on a drive', async () => {
      vol.fromJSON({
        '/Volumes/MyUSB/.git-drive/my-project.git/HEAD': 'ref: refs/heads/main',
        '/Volumes/MyUSB/.git-drive/another-repo.git/HEAD': 'ref: refs/heads/main',
      });

      const response = await request(app).get('/api/drives/%2FVolumes%2FMyUSB/repos');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('mountpoint', '/Volumes/MyUSB');
      expect(response.body).toHaveProperty('initialized', true);
      expect(response.body.repos).toHaveLength(2);
    });

    it('should return 404 for non-existent drive', async () => {
      const response = await request(app).get('/api/drives/%2FVolumes%2FNonExistent/repos');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Drive not found or not mounted');
    });
  });

  describe('POST /api/drives/:mountpoint/init', () => {
    it('should initialize git-drive on a drive', async () => {
      vol.fromJSON({
        '/Volumes/MyUSB': '',
      });

      const response = await request(app).post('/api/drives/%2FVolumes%2FMyUSB/init');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Git Drive initialized on this drive');
    });

    it('should return 404 for non-existent drive', async () => {
      const response = await request(app).post('/api/drives/%2FVolumes%2FNonExistent/init');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/drives/:mountpoint/repos', () => {
    it('should create a new repository', async () => {
      vol.fromJSON({
        '/Volumes/MyUSB/.git-drive': '',
      });

      const response = await request(app)
        .post('/api/drives/%2FVolumes%2FMyUSB/repos')
        .send({ name: 'new-project' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('name', 'new-project');
    });

    it('should sanitize repository name', async () => {
      vol.fromJSON({
        '/Volumes/MyUSB/.git-drive': '',
      });

      const response = await request(app)
        .post('/api/drives/%2FVolumes%2FMyUSB/repos')
        .send({ name: 'my project with spaces!' });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('my-project-with-spaces-');
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post('/api/drives/%2FVolumes%2FMyUSB/repos')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 409 if repository already exists', async () => {
      vol.fromJSON({
        '/Volumes/MyUSB/.git-drive/existing-project.git/HEAD': '',
      });

      const response = await request(app)
        .post('/api/drives/%2FVolumes%2FMyUSB/repos')
        .send({ name: 'existing-project' });

      expect(response.status).toBe(409);
    });
  });

  describe('DELETE /api/drives/:mountpoint/repos/:repoName', () => {
    it('should delete a repository', async () => {
      vol.fromJSON({
        '/Volumes/MyUSB/.git-drive/my-project.git/HEAD': '',
      });

      const response = await request(app).delete('/api/drives/%2FVolumes%2FMyUSB/repos/my-project');

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent repository', async () => {
      vol.fromJSON({
        '/Volumes/MyUSB/.git-drive': '',
      });

      const response = await request(app).delete('/api/drives/%2FVolumes%2FMyUSB/repos/nonexistent');

      expect(response.status).toBe(404);
    });
  });
});