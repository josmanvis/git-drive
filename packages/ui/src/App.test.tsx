import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import axios from 'axios';

const mockAxios = vi.mocked(axios);

// Helper to render with router
const renderWithRouter = (initialRoute = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>
  );
};

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the header with title', () => {
    renderWithRouter();
    expect(screen.getByText('Git Drive')).toBeInTheDocument();
    expect(screen.getByText('Turn any drive into a git remote.')).toBeInTheDocument();
  });

  it('should render drive list on home route', () => {
    renderWithRouter();
    expect(screen.getByText('Connected Drives')).toBeInTheDocument();
  });
});

describe('DriveList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display loading state initially', () => {
    mockAxios.get.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    renderWithRouter();
    
    // Check for loading state (skeleton or loading text)
    expect(screen.getByText('Connected Drives')).toBeInTheDocument();
  });

  it('should display drives after loading', async () => {
    mockAxios.get.mockResolvedValue({
      data: [
        {
          device: 'TestDrive',
          description: '/Volumes/TestDrive',
          size: 32000000000,
          isRemovable: true,
          isSystem: false,
          mountpoints: ['/Volumes/TestDrive'],
          hasGitDrive: true,
        },
      ],
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('/Volumes/TestDrive')).toBeInTheDocument();
    });
  });

  it('should display unconfigured drive with initialize button', async () => {
    mockAxios.get.mockResolvedValue({
      data: [
        {
          device: 'NewDrive',
          description: '/Volumes/NewDrive',
          size: 64000000000,
          isRemovable: true,
          isSystem: false,
          mountpoints: ['/Volumes/NewDrive'],
          hasGitDrive: false,
        },
      ],
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Initialize Git Drive')).toBeInTheDocument();
    });
  });

  it('should initialize drive when button clicked', async () => {
    mockAxios.get.mockResolvedValue({
      data: [
        {
          device: 'NewDrive',
          description: '/Volumes/NewDrive',
          size: 64000000000,
          isRemovable: true,
          isSystem: false,
          mountpoints: ['/Volumes/NewDrive'],
          hasGitDrive: false,
        },
      ],
    });

    mockAxios.post.mockResolvedValue({ data: { message: 'Initialized' } });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Initialize Git Drive')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Initialize Git Drive'));

    await waitFor(() => {
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/init')
      );
    });
  });
});

describe('RepoList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display repos for a drive', async () => {
    mockAxios.get.mockResolvedValue({
      data: {
        mountpoint: '/Volumes/TestDrive',
        gitDrivePath: '/Volumes/TestDrive/.git-drive',
        initialized: true,
        repos: [
          {
            name: 'my-project',
            path: '/Volumes/TestDrive/.git-drive/my-project.git',
            lastModified: '2024-01-01T00:00:00.000Z',
          },
        ],
      },
    });

    renderWithRouter('/drives/%2FVolumes%2FTestDrive');

    await waitFor(() => {
      expect(screen.getByText('my-project')).toBeInTheDocument();
    });
  });

  it('should display empty state when no repos', async () => {
    mockAxios.get.mockResolvedValue({
      data: {
        mountpoint: '/Volumes/TestDrive',
        gitDrivePath: '/Volumes/TestDrive/.git-drive',
        initialized: true,
        repos: [],
      },
    });

    renderWithRouter('/drives/%2FVolumes%2FTestDrive');

    await waitFor(() => {
      expect(screen.getByText('No repositories yet')).toBeInTheDocument();
    });
  });

  it('should filter repos with search', async () => {
    mockAxios.get.mockResolvedValue({
      data: {
        mountpoint: '/Volumes/TestDrive',
        gitDrivePath: '/Volumes/TestDrive/.git-drive',
        initialized: true,
        repos: [
          { name: 'project-alpha', path: '/a', lastModified: '2024-01-01' },
          { name: 'project-beta', path: '/b', lastModified: '2024-01-02' },
        ],
      },
    });

    renderWithRouter('/drives/%2FVolumes%2FTestDrive');

    await waitFor(() => {
      expect(screen.getByText('project-alpha')).toBeInTheDocument();
      expect(screen.getByText('project-beta')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Filter repositories...');
    fireEvent.change(searchInput, { target: { value: 'alpha' } });

    await waitFor(() => {
      expect(screen.getByText('project-alpha')).toBeInTheDocument();
      expect(screen.queryByText('project-beta')).not.toBeInTheDocument();
    });
  });

  it('should create a new repo', async () => {
    mockAxios.get.mockResolvedValue({
      data: {
        mountpoint: '/Volumes/TestDrive',
        gitDrivePath: '/Volumes/TestDrive/.git-drive',
        initialized: true,
        repos: [],
      },
    });

    mockAxios.post.mockResolvedValue({
      data: { name: 'new-repo', path: '/path/to/new-repo.git' },
    });

    // Mock prompt
    vi.spyOn(window, 'prompt').mockReturnValue('new-repo');

    renderWithRouter('/drives/%2FVolumes%2FTestDrive');

    await waitFor(() => {
      expect(screen.getByText('New Repository')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('New Repository'));

    await waitFor(() => {
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/repos'),
        { name: 'new-repo' }
      );
    });
  });
});