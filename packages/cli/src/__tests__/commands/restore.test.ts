import { restore } from '../../commands/restore.js';
import { GitDriveError } from '../../errors.js';
import { vol } from 'memfs';

// Mock fs
jest.mock('fs', () => {
  const { fs } = require('memfs');
  return fs;
});

// Mock config
jest.mock('../../config.js', () => ({
  requireConfig: jest.fn(),
  assertDriveMounted: jest.fn(),
  getDriveStorePath: jest.fn((drivePath: string) => `${drivePath}/.git-drive`),
}));

// Mock git
jest.mock('../../git.js', () => ({
  git: jest.fn(),
}));

// Mock server
jest.mock('../../server.js', () => ({
  ensureServerRunning: jest.fn(),
}));

import { git } from '../../git.js';
import { requireConfig, assertDriveMounted } from '../../config.js';

const mockGit = git as jest.Mock;
const mockRequireConfig = requireConfig as jest.Mock;
const mockAssertDriveMounted = assertDriveMounted as jest.Mock;

describe('restore command', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    vol.reset();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    mockRequireConfig.mockReturnValue({ drivePath: '/Volumes/MyUSB' });
    mockAssertDriveMounted.mockImplementation(() => {});
    mockGit.mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should throw error when no project name provided', () => {
    expect(() => restore([])).toThrow(GitDriveError);
    expect(() => restore([])).toThrow('Usage: git drive restore <project-name> [target-dir]');
  });

  it('should throw error when project not found on drive', () => {
    vol.fromJSON({
      '/Volumes/MyUSB/.git-drive': '',
    });

    expect(() => restore(['nonexistent-project'])).toThrow(GitDriveError);
    expect(() => restore(['nonexistent-project'])).toThrow("Project 'nonexistent-project' not found on drive.");
  });

  it('should throw error when target directory already exists', () => {
    vol.fromJSON({
      '/Volumes/MyUSB/.git-drive/my-project.git/HEAD': '',
      '/home/user/my-project': '',
    });

    expect(() => restore(['my-project', '/home/user/my-project'])).toThrow(GitDriveError);
    expect(() => restore(['my-project', '/home/user/my-project'])).toThrow('Directory already exists');
  });

  it('should clone the bare repo to target directory', () => {
    vol.fromJSON({
      '/Volumes/MyUSB/.git-drive/my-project.git/HEAD': '',
    });

    restore(['my-project', '/home/user/restored-project']);

    expect(mockGit).toHaveBeenCalledWith(
      expect.stringContaining('clone /Volumes/MyUSB/.git-drive/my-project.git')
    );
  });

  it('should rename origin remote to drive', () => {
    vol.fromJSON({
      '/Volumes/MyUSB/.git-drive/my-project.git/HEAD': '',
    });

    restore(['my-project', '/home/user/restored-project']);

    expect(mockGit).toHaveBeenCalledWith(
      expect.stringContaining('remote rename origin drive'),
      expect.any(String)
    );
  });

  it('should use project name as target directory if not specified', () => {
    vol.fromJSON({
      '/Volumes/MyUSB/.git-drive/my-project.git/HEAD': '',
    });

    restore(['my-project']);

    // Should call git clone with the project name 
    // The git function is called twice: once for clone, once for remote rename
    expect(mockGit).toHaveBeenCalledTimes(2);
    expect(mockGit).toHaveBeenNthCalledWith(1, 
      expect.stringMatching(/clone.*my-project\.git.*my-project$/)
    );
  });

  it('should log success message', () => {
    vol.fromJSON({
      '/Volumes/MyUSB/.git-drive/my-project.git/HEAD': '',
    });

    restore(['my-project']);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Restored'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('my-project'));
  });

  it('should work with custom target directory', () => {
    vol.fromJSON({
      '/Volumes/MyUSB/.git-drive/my-project.git/HEAD': '',
    });

    restore(['my-project', '/custom/target']);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/custom/target'));
  });
});