import { GitDriveError, handleError } from '../errors.js';

describe('GitDriveError', () => {
  it('should create an error with the correct message', () => {
    const error = new GitDriveError('Something went wrong');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Something went wrong');
    expect(error.name).toBe('GitDriveError');
  });

  it('should create an error with an empty message', () => {
    const error = new GitDriveError('');
    expect(error.message).toBe('');
    expect(error.name).toBe('GitDriveError');
  });
});

describe('handleError', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should handle GitDriveError', () => {
    const error = new GitDriveError('Custom git-drive error');
    handleError(error);
    expect(consoleSpy).toHaveBeenCalledWith('error: Custom git-drive error');
  });

  it('should handle regular Error', () => {
    const error = new Error('Regular error message');
    handleError(error);
    expect(consoleSpy).toHaveBeenCalledWith('error: Regular error message');
  });

  it('should extract stderr from execSync error message', () => {
    const error = new Error('Command failed: git push\nstderr: fatal: not a git repository');
    handleError(error);
    expect(consoleSpy).toHaveBeenCalledWith('error: fatal: not a git repository');
  });

  it('should handle unknown error types', () => {
    handleError('string error');
    expect(consoleSpy).toHaveBeenCalledWith('An unexpected error occurred.');
  });

  it('should handle null error', () => {
    handleError(null);
    expect(consoleSpy).toHaveBeenCalledWith('An unexpected error occurred.');
  });

  it('should handle undefined error', () => {
    handleError(undefined);
    expect(consoleSpy).toHaveBeenCalledWith('An unexpected error occurred.');
  });

  it('should handle object error', () => {
    handleError({ code: 'ERR_SOMETHING' });
    expect(consoleSpy).toHaveBeenCalledWith('An unexpected error occurred.');
  });
});