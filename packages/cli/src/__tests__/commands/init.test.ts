import { init } from '../../commands/init.js';
import { GitDriveError } from '../../errors.js';
import { vol } from 'memfs';

// Mock fs and path modules
jest.mock('fs', () => {
  const { fs } = require('memfs');
  return fs;
});

// Mock prompts
jest.mock('prompts', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock config
jest.mock('../../config.js', () => ({
  saveConfig: jest.fn(),
  getDriveStorePath: jest.fn((drivePath: string) => `${drivePath}/.git-drive`),
}));

// Mock git
jest.mock('../../git.js', () => ({
  listDrives: jest.fn(),
}));

import prompts from 'prompts';
import { listDrives } from '../../git.js';
import { saveConfig, getDriveStorePath } from '../../config.js';

const mockPrompts = prompts as unknown as jest.Mock;
const mockListDrives = listDrives as jest.Mock;
const mockSaveConfig = saveConfig as jest.Mock;
const mockGetDriveStorePath = getDriveStorePath as jest.Mock;

describe('init command', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    vol.reset();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    mockGetDriveStorePath.mockImplementation((drivePath: string) => `${drivePath}/.git-drive`);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('with path argument', () => {
    it('should initialize git-drive on specified path', async () => {
      const drivePath = '/Volumes/TestDrive';
      vol.fromJSON({
        [drivePath]: '',
      });

      await init([drivePath]);

      expect(mockSaveConfig).toHaveBeenCalledWith({ drivePath: expect.stringContaining('TestDrive') });
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Git Drive initialized'));
    });

    it('should throw error if path does not exist', async () => {
      await expect(init(['/Volumes/NonExistent'])).rejects.toThrow(GitDriveError);
      await expect(init(['/Volumes/NonExistent'])).rejects.toThrow('Path not found');
    });

    it('should throw error if path is not a directory', async () => {
      vol.fromJSON({
        '/Volumes/SomeFile': 'file content',
      });

      await expect(init(['/Volumes/SomeFile'])).rejects.toThrow('Path is not a directory');
    });

    it('should resolve relative paths', async () => {
      vol.fromJSON({
        '/current/dir/TestDrive': '',
      });

      // Mock cwd to return a specific directory
      const originalCwd = process.cwd;
      process.cwd = jest.fn(() => '/current/dir');

      await init(['./TestDrive']);

      expect(mockSaveConfig).toHaveBeenCalled();

      process.cwd = originalCwd;
    });
  });

  describe('without path argument (interactive)', () => {
    it('should throw error when no drives found', async () => {
      mockListDrives.mockResolvedValue([]);

      await expect(init([])).rejects.toThrow('No external drives found');
    });

    it('should prompt user to select a drive', async () => {
      mockListDrives.mockResolvedValue([
        { mounted: '/Volumes/Drive1', filesystem: 'Drive1', blocks: 1000000, available: 500000 },
        { mounted: '/Volumes/Drive2', filesystem: 'Drive2', blocks: 2000000, available: 1000000 },
      ]);

      mockPrompts.mockResolvedValue({
        selectedDrive: '/Volumes/Drive1',
      });

      vol.fromJSON({
        '/Volumes/Drive1': '',
      });

      await init([]);

      expect(mockPrompts).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'select',
          name: 'selectedDrive',
        })
      );
    });

    it('should handle user cancellation', async () => {
      mockListDrives.mockResolvedValue([
        { mounted: '/Volumes/Drive1', filesystem: 'Drive1', blocks: 1000000, available: 500000 },
      ]);

      mockPrompts.mockResolvedValue({
        selectedDrive: undefined,
      });

      await init([]);

      expect(consoleSpy).toHaveBeenCalledWith('Operation cancelled.');
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });
  });

  describe('store directory creation', () => {
    it('should create .git-drive directory if it does not exist', async () => {
      const drivePath = '/Volumes/TestDrive';
      vol.fromJSON({
        [drivePath]: '',
      });

      await init([drivePath]);

      // The store path should have been requested
      expect(mockGetDriveStorePath).toHaveBeenCalled();
    });
  });
});