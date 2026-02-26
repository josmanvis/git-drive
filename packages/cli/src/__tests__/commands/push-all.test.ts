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

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    on: jest.fn(),
    kill: jest.fn(),
  })),
  execSync: jest.fn((cmd: string) => {
    // Mock git commands
    if (cmd.includes('remote get-url gd')) {
      throw new Error('remote not found');
    }
    if (cmd.includes('branch --list')) {
      return 'main';
    }
    if (cmd.includes('tag --list')) {
      return '';
    }
    if (cmd.includes('status --porcelain')) {
      return '';
    }
    return '';
  }),
}));

// Mock os
jest.mock('os', () => ({
  homedir: () => '/home/testuser',
  hostname: () => 'test-machine',
  userInfo: () => ({ username: 'testuser' }),
}));

// Mock prompts
jest.mock('prompts', () => jest.fn());

// Mock server
jest.mock('../../server.js', () => ({
  ensureServerRunning: jest.fn(),
}));

import { getDiskInfo } from 'node-disk-info';
import { pushAll } from '../../commands/push-all.js';

const mockGetDiskInfo = getDiskInfo as jest.Mock;
const mockPrompts = require('prompts') as jest.Mock;

describe('push-all command', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    vol.reset();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should display message when directory not found', async () => {
    await pushAll(['/nonexistent/directory']);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Directory not found'));
  });

  it('should display message when no projects found', async () => {
    vol.fromJSON({
      '/empty-dir': null,
    });

    await pushAll(['/empty-dir']);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No projects found'));
  });

  it('should display message when no initialized drives found', async () => {
    vol.fromJSON({
      '/dev-projects/my-project/.git/HEAD': '',
    });

    mockGetDiskInfo.mockResolvedValue([
      { mounted: '/Volumes/MyUSB', filesystem: 'MyUSB', blocks: 32000000, available: 16000000 },
    ]);

    // No .git-drive on the drive
    await pushAll(['/dev-projects']);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No initialized git-drives found'));
  });

  it('should scan and categorize git repos and non-git projects', async () => {
    vol.fromJSON({
      '/dev-projects/git-repo/.git/HEAD': '',
      '/dev-projects/git-repo/package.json': '{}',
      '/dev-projects/non-git-project/package.json': '{}',
      '/Volumes/MyUSB/.git-drive': null,
    });

    mockGetDiskInfo.mockResolvedValue([
      { mounted: '/Volumes/MyUSB', filesystem: 'MyUSB', blocks: 32000000, available: 16000000 },
    ]);

    // Mock prompts to cancel after showing projects
    mockPrompts.mockResolvedValue({ drive: undefined });

    await pushAll(['/dev-projects']);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Git repositories:'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Non-git projects'));
  });

  it('should skip hidden directories', async () => {
    vol.fromJSON({
      '/dev-projects/.hidden-dir/file.txt': '',
      '/dev-projects/visible-project/.git/HEAD': '',
      '/Volumes/MyUSB/.git-drive': null,
    });

    mockGetDiskInfo.mockResolvedValue([
      { mounted: '/Volumes/MyUSB', filesystem: 'MyUSB', blocks: 32000000, available: 16000000 },
    ]);

    mockPrompts.mockResolvedValue({ drive: undefined });

    await pushAll(['/dev-projects']);

    // .hidden-dir should not appear in output
    const calls = consoleSpy.mock.calls.map(c => c[0]).join(' ');
    expect(calls).not.toContain('.hidden-dir');
    expect(calls).toContain('visible-project');
  });

  it('should handle --skip-non-git flag', async () => {
    vol.fromJSON({
      '/dev-projects/git-repo/.git/HEAD': '',
      '/dev-projects/non-git-project/file.txt': '',
      '/Volumes/MyUSB/.git-drive': null,
    });

    mockGetDiskInfo.mockResolvedValue([
      { mounted: '/Volumes/MyUSB', filesystem: 'MyUSB', blocks: 32000000, available: 16000000 },
    ]);

    mockPrompts.mockResolvedValue({
      drive: { mounted: '/Volumes/MyUSB', filesystem: 'MyUSB' },
    });

    await pushAll(['/dev-projects', '--skip-non-git']);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping non-git directories'));
  });

  it('should handle --init-all flag', async () => {
    vol.fromJSON({
      '/dev-projects/git-repo/.git/HEAD': '',
      '/dev-projects/non-git-project/file.txt': '',
      '/Volumes/MyUSB/.git-drive': null,
    });

    mockGetDiskInfo.mockResolvedValue([
      { mounted: '/Volumes/MyUSB', filesystem: 'MyUSB', blocks: 32000000, available: 16000000 },
    ]);

    mockPrompts.mockResolvedValue({
      drive: { mounted: '/Volumes/MyUSB', filesystem: 'MyUSB' },
    });

    await pushAll(['/dev-projects', '--init-all', '--drive', '/Volumes/MyUSB']);

    // Should initialize the non-git project
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Initializing'));
  });
});