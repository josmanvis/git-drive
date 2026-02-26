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

// Mock server
jest.mock('../../server.js', () => ({
  ensureServerRunning: jest.fn(),
}));

// Mock os
jest.mock('os', () => ({
  homedir: () => '/home/testuser',
}));

import { getDiskInfo } from 'node-disk-info';
import { list } from '../../commands/list.js';

const mockGetDiskInfo = getDiskInfo as jest.Mock;

describe('list command', () => {
  let consoleSpy: jest.SpyInstance;
  const originalPlatform = process.platform;

  beforeEach(() => {
    jest.clearAllMocks();
    vol.reset();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    Object.defineProperty(process, 'platform', { value: 'darwin', writable: true });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true });
  });

  it('should display no drives message when no external drives found', async () => {
    mockGetDiskInfo.mockResolvedValue([]);

    vol.fromJSON({
      '/home/testuser/.config/git-drive/links.json': '{}',
    });

    await list([]);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No external drives detected'));
  });

  it('should list connected drives with git-drive status', async () => {
    mockGetDiskInfo.mockResolvedValue([
      { mounted: '/Volumes/MyUSB', filesystem: 'MyUSB', blocks: 32000000, available: 16000000 },
      { mounted: '/Volumes/External', filesystem: 'External', blocks: 1000000000, available: 500000000 },
    ]);

    vol.fromJSON({
      '/home/testuser/.config/git-drive/links.json': '{}',
      '/Volumes/MyUSB/.git-drive/my-project.git/HEAD': '',
      '/Volumes/External': '',
    });

    await list([]);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/Volumes/MyUSB'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/Volumes/External'));
  });

  it('should count repositories on initialized drives', async () => {
    mockGetDiskInfo.mockResolvedValue([
      { mounted: '/Volumes/MyUSB', filesystem: 'MyUSB', blocks: 32000000, available: 16000000 },
    ]);

    vol.fromJSON({
      '/home/testuser/.config/git-drive/links.json': '{}',
      '/Volumes/MyUSB/.git-drive/project1.git/HEAD': '',
      '/Volumes/MyUSB/.git-drive/project2.git/HEAD': '',
      '/Volumes/MyUSB/.git-drive/project3.git/HEAD': '',
    });

    await list([]);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Repositories: 3'));
  });

  it('should display drive size in GB', async () => {
    mockGetDiskInfo.mockResolvedValue([
      { mounted: '/Volumes/MyUSB', filesystem: 'MyUSB', blocks: 97656250, available: 50000000 },
    ]);

    vol.fromJSON({
      '/home/testuser/.config/git-drive/links.json': '{}',
      '/Volumes/MyUSB': '',
    });

    await list([]);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('GB'));
  });

  it('should handle errors when detecting drives', async () => {
    mockGetDiskInfo.mockRejectedValue(new Error('Failed to detect drives'));

    vol.fromJSON({
      '/home/testuser/.config/git-drive/links.json': '{}',
    });

    await list([]);

    expect(consoleSpy).toHaveBeenCalledWith('Error detecting drives:', expect.any(Error));
  });
});