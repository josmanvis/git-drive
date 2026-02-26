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
  execSync: jest.fn(),
}));

// Mock os
jest.mock('os', () => ({
  homedir: () => '/home/testuser',
}));

// Mock readline
jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    question: jest.fn((_prompt, callback) => callback()),
    close: jest.fn(),
  })),
}));

// Mock prompts
jest.mock('prompts', () => jest.fn());

import { getDiskInfo } from 'node-disk-info';
import { getCompanionInfo, isPortAvailable, findAvailablePort } from '../../commands/companion.js';

const mockGetDiskInfo = getDiskInfo as jest.Mock;

// Mock fetch for port testing
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('companion command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vol.reset();
    mockFetch.mockReset();
  });

  describe('getCompanionInfo', () => {
    it('should return installed: false when companion repo does not exist', () => {
      vol.fromJSON({
        '/Volumes/MyUSB/.git-drive': '',
      });

      const result = getCompanionInfo('/Volumes/MyUSB');

      expect(result.installed).toBe(false);
    });

    it('should return installed: true when companion repo exists', () => {
      vol.fromJSON({
        '/Volumes/MyUSB/.git-drive/git-drive.git/HEAD': '',
        '/Volumes/MyUSB/.git-drive/companion.json': JSON.stringify({
          version: '0.1.6',
          installedAt: '2026-02-26T00:00:00Z',
        }),
      });

      const result = getCompanionInfo('/Volumes/MyUSB');

      expect(result.installed).toBe(true);
      expect(result.version).toBe('0.1.6');
    });

    it('should return installed: true even without companion.json', () => {
      vol.fromJSON({
        '/Volumes/MyUSB/.git-drive/git-drive.git/HEAD': '',
      });

      const result = getCompanionInfo('/Volumes/MyUSB');

      expect(result.installed).toBe(true);
    });

    it('should handle malformed companion.json gracefully', () => {
      vol.fromJSON({
        '/Volumes/MyUSB/.git-drive/git-drive.git/HEAD': '',
        '/Volumes/MyUSB/.git-drive/companion.json': 'invalid json{',
      });

      const result = getCompanionInfo('/Volumes/MyUSB');

      expect(result.installed).toBe(true);
      expect(result.version).toBeUndefined();
    });
  });

  describe('isPortAvailable', () => {
    it('should return false when port is in use', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await isPortAvailable(4484);

      expect(result).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4484/api/health',
        expect.objectContaining({ method: 'HEAD' })
      );
    });

    it('should return true when port is available', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await isPortAvailable(4484);

      expect(result).toBe(true);
    });
  });

  describe('findAvailablePort', () => {
    it('should return the start port if available', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await findAvailablePort(4484);

      expect(result).toBe(4484);
    });

    it('should find next available port', async () => {
      // First port is in use
      mockFetch.mockResolvedValueOnce({ ok: true });
      // Second port is available
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await findAvailablePort(4484);

      expect(result).toBe(4485);
    });

    it('should throw after max attempts', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await expect(findAvailablePort(4484)).rejects.toThrow('Could not find an available port');
    });
  });
});
