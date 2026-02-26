import { git, listDrives, getRepoRoot, getProjectName, getRemoteUrl, isGitRepo } from '../git.js';

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

describe('git', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('git function', () => {
    it('should execute git command and return trimmed output', () => {
      mockExecSync.mockReturnValue('  output from git  \n');

      const result = git('status --short');

      expect(mockExecSync).toHaveBeenCalledWith('git status --short', {
        cwd: undefined,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      expect(result).toBe('output from git');
    });

    it('should execute git command with cwd option', () => {
      mockExecSync.mockReturnValue('output');

      const result = git('status', '/path/to/repo');

      expect(mockExecSync).toHaveBeenCalledWith('git status', {
        cwd: '/path/to/repo',
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      expect(result).toBe('output');
    });

    it('should propagate errors from git command', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: not a git repository');
      });

      expect(() => git('status')).toThrow('fatal: not a git repository');
    });
  });

  describe('listDrives', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should filter drives correctly on macOS', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      mockGetDiskInfo.mockResolvedValue([
        { mounted: '/', filesystem: 'Macintosh HD', blocks: 500000000, available: 100000000 },
        { mounted: '/Volumes/MyUSB', filesystem: 'MyUSB', blocks: 32000000, available: 16000000 },
        { mounted: '/Volumes/Recovery', filesystem: 'Recovery', blocks: 1000000, available: 500000 },
        { mounted: '/Volumes/External', filesystem: 'External', blocks: 1000000000, available: 500000000 },
      ]);

      const result = await listDrives();

      expect(result).toHaveLength(2);
      expect(result.map((d: any) => d.mounted)).toEqual(['/Volumes/MyUSB', '/Volumes/External']);
    });

    it('should filter drives correctly on Linux', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      mockGetDiskInfo.mockResolvedValue([
        { mounted: '/', filesystem: 'root', blocks: 500000000, available: 100000000 },
        { mounted: '/mnt/usb', filesystem: 'usbdrive', blocks: 32000000, available: 16000000 },
        { mounted: '/sys', filesystem: 'sysfs', blocks: 0, available: 0 },
        { mounted: '/proc', filesystem: 'proc', blocks: 0, available: 0 },
        { mounted: '/run', filesystem: 'tmpfs', blocks: 1000000, available: 500000 },
        { mounted: '/media/user/external', filesystem: 'external', blocks: 1000000000, available: 500000000 },
      ]);

      const result = await listDrives();

      expect(result).toHaveLength(2);
      expect(result.map((d: any) => d.mounted)).toEqual(['/mnt/usb', '/media/user/external']);
    });

    it('should filter out tmpfs and overlay filesystems', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      mockGetDiskInfo.mockResolvedValue([
        { mounted: '/mnt/real', filesystem: 'ext4', blocks: 1000000, available: 500000 },
        { mounted: '/mnt/tmpfs', filesystem: 'tmpfs', blocks: 1000000, available: 500000 },
        { mounted: '/mnt/devtmpfs', filesystem: 'devtmpfs', blocks: 1000000, available: 500000 },
        { mounted: '/mnt/overlay', filesystem: 'overlay', blocks: 1000000, available: 500000 },
        { mounted: '/mnt/udev', filesystem: 'udev', blocks: 1000000, available: 500000 },
      ]);

      const result = await listDrives();

      expect(result).toHaveLength(1);
      expect(result[0].mounted).toBe('/mnt/real');
    });

    it('should filter out drives without mountpoint', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      mockGetDiskInfo.mockResolvedValue([
        { mounted: null, filesystem: 'nomount', blocks: 1000000, available: 500000 },
        { mounted: '/Volumes/Valid', filesystem: 'valid', blocks: 1000000, available: 500000 },
      ]);

      const result = await listDrives();

      expect(result).toHaveLength(1);
    });

    it('should filter out drives with mounted value of "100%"', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      mockGetDiskInfo.mockResolvedValue([
        { mounted: '100%', filesystem: 'weird', blocks: 1000000, available: 500000 },
        { mounted: '/Volumes/Valid', filesystem: 'valid', blocks: 1000000, available: 500000 },
      ]);

      const result = await listDrives();

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no drives match', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      mockGetDiskInfo.mockResolvedValue([
        { mounted: '/', filesystem: 'system', blocks: 500000000, available: 100000000 },
      ]);

      const result = await listDrives();

      expect(result).toHaveLength(0);
    });

    it('should filter out temporary paths with TemporaryItems', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      mockGetDiskInfo.mockResolvedValue([
        { mounted: '/var/folders/2b/b7kfzb0s2v55m89_k9qvpj9w0000gn/T/TemporaryItems/NSIRD_screencaptureui_g99XDe', filesystem: 'tmpfs', blocks: 1000, available: 500 },
      ]);

      const result = await listDrives();

      expect(result).toHaveLength(0);
    });

    it('should filter out /var/folders paths', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      mockGetDiskInfo.mockResolvedValue([
        { mounted: '/var/folders/abc', filesystem: 'tmpfs', blocks: 1000, available: 500 },
      ]);

      const result = await listDrives();

      expect(result).toHaveLength(0);
    });
  });

  describe('getRepoRoot', () => {
    it('should return the repo root path', () => {
      mockExecSync.mockReturnValue('/path/to/repo\n');

      const result = getRepoRoot();

      expect(mockExecSync).toHaveBeenCalledWith('git rev-parse --show-toplevel', expect.any(Object));
      expect(result).toBe('/path/to/repo');
    });
  });

  describe('getProjectName', () => {
    it('should return the basename of the repo root', () => {
      mockExecSync.mockReturnValue('/path/to/my-project');

      const result = getProjectName();

      expect(result).toBe('my-project');
    });

    it('should handle nested paths', () => {
      mockExecSync.mockReturnValue('/Users/developer/projects/awesome-app');

      const result = getProjectName();

      expect(result).toBe('awesome-app');
    });
  });

  describe('getRemoteUrl', () => {
    it('should return the remote URL if it exists', () => {
      mockExecSync.mockReturnValue('/Volumes/MyDrive/.git-drive/my-project.git');

      const result = getRemoteUrl('gd');

      expect(mockExecSync).toHaveBeenCalledWith('git remote get-url gd', expect.any(Object));
      expect(result).toBe('/Volumes/MyDrive/.git-drive/my-project.git');
    });

    it('should return null if remote does not exist', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: No such remote');
      });

      const result = getRemoteUrl('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('isGitRepo', () => {
    it('should return true when in a git repository', () => {
      mockExecSync.mockReturnValue('true');

      const result = isGitRepo();

      expect(result).toBe(true);
    });

    it('should return false when not in a git repository', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('fatal: not a git repository');
      });

      const result = isGitRepo();

      expect(result).toBe(false);
    });
  });
});