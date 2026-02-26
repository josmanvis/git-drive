import { vol } from 'memfs';
import { join } from 'path';
import {
  loadConfig,
  saveConfig,
  requireConfig,
  assertDriveMounted,
  getDriveStorePath,
  loadLinks,
  saveLink,
  Config,
  LinkRegistry,
} from '../config.js';

// Mock fs and os modules
jest.mock('fs', () => {
  const { fs } = require('memfs');
  return fs;
});

jest.mock('os', () => ({
  homedir: () => '/home/testuser',
}));

describe('config', () => {
  const configDir = '/home/testuser/.config/git-drive';
  const configFile = join(configDir, 'config.json');
  const linksFile = join(configDir, 'links.json');

  beforeEach(() => {
    vol.reset();
  });

  describe('loadConfig', () => {
    it('should return null when config file does not exist', () => {
      const result = loadConfig();
      expect(result).toBeNull();
    });

    it('should load and parse valid config', () => {
      const config: Config = { drivePath: '/Volumes/TestDrive' };
      vol.fromJSON({
        [configFile]: JSON.stringify(config),
      });

      const result = loadConfig();
      expect(result).toEqual(config);
    });

    it('should throw on malformed JSON', () => {
      vol.fromJSON({
        [configFile]: 'not valid json',
      });

      expect(() => loadConfig()).toThrow();
    });
  });

  describe('saveConfig', () => {
    it('should create config directory if it does not exist', () => {
      const config: Config = { drivePath: '/Volumes/MyDrive' };
      saveConfig(config);

      const files = vol.toJSON();
      expect(files[configFile]).toBeDefined();
    });

    it('should save config with proper formatting', () => {
      const config: Config = { drivePath: '/Volumes/MyDrive' };
      saveConfig(config);

      const savedContent = vol.toJSON()[configFile];
      expect(savedContent).toBe(JSON.stringify(config, null, 2) + '\n');
    });

    it('should overwrite existing config', () => {
      const config1: Config = { drivePath: '/Volumes/Drive1' };
      const config2: Config = { drivePath: '/Volumes/Drive2' };

      saveConfig(config1);
      saveConfig(config2);

      const result = loadConfig();
      expect(result).toEqual(config2);
    });
  });

  describe('requireConfig', () => {
    it('should return config when it exists', () => {
      const config: Config = { drivePath: '/Volumes/TestDrive' };
      vol.fromJSON({
        [configFile]: JSON.stringify(config),
      });

      const result = requireConfig();
      expect(result).toEqual(config);
    });

    it('should throw GitDriveError when config does not exist', () => {
      expect(() => requireConfig()).toThrow('No drive configured. Run: git drive init <path>');
    });
  });

  describe('assertDriveMounted', () => {
    it('should not throw when drive path exists', () => {
      vol.fromJSON({
        '/Volumes/TestDrive/.git-drive': '',
      });

      expect(() => assertDriveMounted('/Volumes/TestDrive')).not.toThrow();
    });

    it('should throw GitDriveError when drive path does not exist', () => {
      expect(() => assertDriveMounted('/Volumes/NonExistent')).toThrow(
        'Drive not found at /Volumes/NonExistent. Is it connected?'
      );
    });
  });

  describe('getDriveStorePath', () => {
    it('should return the .git-drive path for a mountpoint', () => {
      expect(getDriveStorePath('/Volumes/MyDrive')).toBe('/Volumes/MyDrive/.git-drive');
    });

    it('should handle different path formats', () => {
      expect(getDriveStorePath('/mnt/usb')).toBe('/mnt/usb/.git-drive');
    });
  });

  describe('loadLinks', () => {
    it('should return empty object when links file does not exist', () => {
      const result = loadLinks();
      expect(result).toEqual({});
    });

    it('should load and parse valid links', () => {
      const links: LinkRegistry = {
        '/home/user/project1': {
          mountpoint: '/Volumes/Drive1',
          repoName: 'project1.git',
          linkedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vol.fromJSON({
        [linksFile]: JSON.stringify(links),
      });

      const result = loadLinks();
      expect(result).toEqual(links);
    });

    it('should return empty object on malformed JSON', () => {
      vol.fromJSON({
        [linksFile]: 'invalid json',
      });

      const result = loadLinks();
      expect(result).toEqual({});
    });
  });

  describe('saveLink', () => {
    it('should create links directory if it does not exist', () => {
      saveLink('/home/user/project', '/Volumes/Drive', 'project.git');

      const files = vol.toJSON();
      expect(files[linksFile]).toBeDefined();
    });

    it('should save a new link', () => {
      saveLink('/home/user/project', '/Volumes/Drive', 'project.git');

      const result = loadLinks();
      expect(result['/home/user/project']).toEqual({
        mountpoint: '/Volumes/Drive',
        repoName: 'project.git',
        linkedAt: expect.any(String),
      });
    });

    it('should update existing link', () => {
      saveLink('/home/user/project', '/Volumes/Drive1', 'project.git');
      saveLink('/home/user/project', '/Volumes/Drive2', 'project.git');

      const result = loadLinks();
      expect(result['/home/user/project'].mountpoint).toBe('/Volumes/Drive2');
    });

    it('should preserve other links when adding new one', () => {
      saveLink('/home/user/project1', '/Volumes/Drive', 'project1.git');
      saveLink('/home/user/project2', '/Volumes/Drive', 'project2.git');

      const result = loadLinks();
      expect(Object.keys(result)).toHaveLength(2);
    });
  });
});