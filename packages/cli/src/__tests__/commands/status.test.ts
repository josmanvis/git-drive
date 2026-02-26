import { vol } from 'memfs';

// Mock fs
jest.mock('fs', () => {
  const { fs } = require('memfs');
  return fs;
});

// Mock node-disk-info
jest.mock('node-disk-info', () => ({
  getDiskInfo: jest.fn(),
}));

// Mock git
jest.mock('../../git.js', () => ({
  isGitRepo: jest.fn(),
  getProjectName: jest.fn(),
  getRemoteUrl: jest.fn(),
}));

// Mock server
jest.mock('../../server.js', () => ({
  ensureServerRunning: jest.fn(),
}));

// Mock os
jest.mock('os', () => ({
  homedir: () => '/home/testuser',
}));

import { getDiskInfo } from 'node-disk-info';
import { isGitRepo, getProjectName, getRemoteUrl } from '../../git.js';
import { status } from '../../commands/status.js';

const mockGetDiskInfo = getDiskInfo as jest.Mock;
const mockIsGitRepo = isGitRepo as jest.Mock;
const mockGetProjectName = getProjectName as jest.Mock;
const mockGetRemoteUrl = getRemoteUrl as jest.Mock;

describe('status command', () => {
  let consoleSpy: jest.SpyInstance;
  const originalPlatform = process.platform;

  beforeEach(() => {
    jest.clearAllMocks();
    vol.reset();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    mockIsGitRepo.mockReturnValue(false);
    Object.defineProperty(process, 'platform', { value: 'darwin', writable: true });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
  });

  it('should display connected drives section', async () => {
    mockGetDiskInfo.mockResolvedValue([
      { mounted: '/Volumes/MyUSB', filesystem: 'MyUSB', blocks: 32000000, available: 16000000 },
    ]);

    vol.fromJSON({
      '/home/testuser/.config/git-drive/links.json': '{}',
      '/Volumes/MyUSB/.git-drive/my-project.git/HEAD': '',
    });

    await status([]);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Connected Drives'));
  });

  it('should display no external drives message when none found', async () => {
    mockGetDiskInfo.mockResolvedValue([]);

    vol.fromJSON({
      '/home/testuser/.config/git-drive/links.json': '{}',
    });

    await status([]);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No external drives connected'));
  });

  it('should display registered repositories section', async () => {
    mockGetDiskInfo.mockResolvedValue([]);

    vol.fromJSON({
      '/home/testuser/.config/git-drive/links.json': JSON.stringify({
        '/home/user/project1': {
          mountpoint: '/Volumes/MyUSB',
          repoName: 'project1.git',
          linkedAt: '2024-01-01T00:00:00.000Z',
        },
      }),
      '/home/user/project1': '',
      '/Volumes/MyUSB': '',
    });

    await status([]);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Registered Repositories'));
  });

  it('should show NOT CONNECTED status when drive is not mounted', async () => {
    mockGetDiskInfo.mockResolvedValue([]);

    vol.fromJSON({
      '/home/testuser/.config/git-drive/links.json': JSON.stringify({
        '/home/user/project1': {
          mountpoint: '/Volumes/MyUSB',
          repoName: 'project1.git',
          linkedAt: '2024-01-01T00:00:00.000Z',
        },
      }),
      '/home/user/project1': '',
    });

    await status([]);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('NOT CONNECTED'));
  });

  it('should show NOT FOUND status when local directory does not exist', async () => {
    mockGetDiskInfo.mockResolvedValue([]);

    vol.fromJSON({
      '/home/testuser/.config/git-drive/links.json': JSON.stringify({
        '/home/user/nonexistent': {
          mountpoint: '/Volumes/MyUSB',
          repoName: 'project.git',
          linkedAt: '2024-01-01T00:00:00.000Z',
        },
      }),
      '/Volumes/MyUSB': '',
    });

    await status([]);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('NOT FOUND'));
  });

  it('should display current repository section when in a git repo', async () => {
    mockGetDiskInfo.mockResolvedValue([]);
    mockIsGitRepo.mockReturnValue(true);
    mockGetProjectName.mockReturnValue('my-project');
    mockGetRemoteUrl.mockReturnValue('/Volumes/MyUSB/.git-drive/my-project.git');

    vol.fromJSON({
      '/home/testuser/.config/git-drive/links.json': '{}',
    });

    await status([]);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Current Repository'));
  });

  it('should show no gd remote message when not linked', async () => {
    mockGetDiskInfo.mockResolvedValue([]);
    mockIsGitRepo.mockReturnValue(true);
    mockGetProjectName.mockReturnValue('my-project');
    mockGetRemoteUrl.mockReturnValue(null);

    vol.fromJSON({
      '/home/testuser/.config/git-drive/links.json': '{}',
    });

    await status([]);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("No 'gd' remote configured"));
  });

  it('should display server status section', async () => {
    mockGetDiskInfo.mockResolvedValue([]);

    vol.fromJSON({
      '/home/testuser/.config/git-drive/links.json': '{}',
    });

    await status([]);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Server'));
  });

  it('should handle errors gracefully', async () => {
    mockGetDiskInfo.mockRejectedValue(new Error('Failed to get disk info'));

    vol.fromJSON({
      '/home/testuser/.config/git-drive/links.json': '{}',
    });

    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    await status([]);

    expect(errorSpy).toHaveBeenCalledWith('Error detecting drives:', expect.any(Error));
    
    errorSpy.mockRestore();
  });
});