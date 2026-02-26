import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Routes, Route, Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { HardDrive, Search, FolderGit2, Trash2, Plus, ArrowLeft, File as FileIcon, Folder as FolderIcon, ChevronRight } from 'lucide-react';
import Fuse from 'fuse.js';

type Drive = {
  device: string;
  description: string;
  size: number;
  isRemovable: boolean;
  isSystem: boolean;
  mountpoints: string[];
  hasGitDrive: boolean;
};

type Repo = {
  name: string;
  path: string;
  lastModified: string;
};

type TreeItem = {
  mode: string;
  type: string;
  hash: string;
  path: string;
  name: string;
};

export default function App() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-200 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex items-center justify-between border-b border-gray-800 pb-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <FolderGit2 className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Git Drive</h1>
              <p className="text-gray-400 text-sm">Turn any drive into a git remote.</p>
            </div>
          </Link>
        </header>

        <Routes>
          <Route path="/" element={<DriveList />} />
          <Route path="/drives/:mountpoint" element={<RepoList />} />
          <Route path="/drives/:mountpoint/repos/:repoName" element={<RepoBrowser />} />
          <Route path="/drives/:mountpoint/repos/:repoName/commit/:hash" element={<CommitViewer />} />
        </Routes>
      </div>
    </div>
  );
}

function DriveList() {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchDrives = async () => {
    try {
      const { data } = await axios.get('/api/drives');
      const sortedDrives = data.sort((a: Drive, b: Drive) => {
        if (a.hasGitDrive === b.hasGitDrive) return 0;
        return a.hasGitDrive ? -1 : 1;
      });
      setDrives(sortedDrives);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrives();
  }, []);

  const handleInitDrive = async (mountpoint: string) => {
    try {
      await axios.post(`/api/drives/${encodeURIComponent(mountpoint)}/init`);
      fetchDrives();
    } catch (e: any) {
      alert(e.response?.data?.error || `Failed to initialize ${mountpoint}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <h2 className="text-xl font-semibold text-white flex items-center gap-2">
        <HardDrive className="w-5 h-5 text-gray-400" /> Connected Drives
      </h2>

      {loading ? (
        <div className="animate-pulse flex gap-4">
          <div className="h-24 w-full bg-gray-800/50 rounded-xl"></div>
          <div className="h-24 w-full bg-gray-800/50 rounded-xl"></div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          {drives.map((drive, idx) => {
            const mountpoint = drive.mountpoints[0];
            if (!mountpoint || drive.isSystem) return null;

            return (
              <div
                key={idx}
                className="group p-6 bg-gray-900 border border-gray-800 rounded-2xl hover:border-gray-700 hover:bg-gray-800/50 transition-all cursor-pointer shadow-lg shadow-black/20"
                onClick={() => {
                  if (drive.hasGitDrive) navigate(`/drives/${encodeURIComponent(mountpoint)}`);
                }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-gray-800 rounded-xl group-hover:bg-gray-700 transition-colors">
                    <HardDrive className="w-6 h-6 text-gray-300" />
                  </div>
                  {drive.hasGitDrive ? (
                    <span className="px-3 py-1 bg-green-500/10 text-green-400 text-xs font-semibold rounded-full border border-green-500/20">
                      Ready
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-gray-800 text-gray-400 text-xs font-semibold rounded-full border border-gray-700">
                      Unconfigured
                    </span>
                  )}
                </div>

                <h3 className="font-medium text-white text-lg mb-1 truncate" title={drive.description}>
                  {mountpoint}
                </h3>

                <div className="flex gap-2 text-xs text-gray-500 font-medium">
                  <span className="px-2 py-1 bg-gray-950 rounded-md border border-gray-800">
                    {drive.device}
                  </span>
                  <span>{(drive.size / 1024 / 1024 / 1024).toFixed(1)} GB</span>
                </div>

                {!drive.hasGitDrive && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInitDrive(mountpoint);
                    }}
                    className="mt-6 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    Initialize Git Drive
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RepoList() {
  const { mountpoint } = useParams<{ mountpoint: string }>();
  const navigate = useNavigate();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repoStatuses, setRepoStatuses] = useState<Record<string, { linked: boolean; hasChanges: boolean; unpushed: boolean }>>({});
  const [pushing, setPushing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRepos = async () => {
    if (!mountpoint) return;
    try {
      const { data } = await axios.get(`/api/drives/${encodeURIComponent(mountpoint)}/repos`);
      const repoList = data.repos || [];
      setRepos(repoList);

      repoList.forEach(async (r: Repo) => {
        try {
          const res = await axios.get(`/api/drives/${encodeURIComponent(mountpoint)}/repos/${encodeURIComponent(r.name)}/local-status`);
          setRepoStatuses((prev) => ({ ...prev, [r.name]: res.data }));
        } catch (err) {}
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, [mountpoint]);

  // Configure fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(repos, {
      keys: ['name', 'path'],
      threshold: 0.4,
      includeScore: true,
    });
  }, [repos]);

  // Filter repos based on search query
  const filteredRepos = useMemo(() => {
    if (!searchQuery.trim()) return repos;
    const results = fuse.search(searchQuery);
    return results.map(result => result.item);
  }, [fuse, repos, searchQuery]);

  const handleCreateRepo = async () => {
    if (!mountpoint) return;
    const name = prompt('Repository Name:');
    if (!name) return;
    try {
      await axios.post(`/api/drives/${encodeURIComponent(mountpoint)}/repos`, { name });
      fetchRepos();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePushRepo = async (e: React.MouseEvent, repoName: string) => {
    e.stopPropagation();
    if (!mountpoint) return;
    setPushing(repoName);
    try {
      await axios.post(`/api/drives/${encodeURIComponent(mountpoint)}/repos/${encodeURIComponent(repoName)}/push`);
      fetchRepos();
    } catch (err: any) {
      alert(err.response?.data?.error || `Failed to push ${repoName}`);
    } finally {
      setPushing(null);
    }
  };

  const handleDeleteRepo = async (repoName: string) => {
    if (!mountpoint) return;
    if (!confirm(`Are you sure you want to delete ${repoName}?`)) return;
    try {
      await axios.delete(`/api/drives/${encodeURIComponent(mountpoint)}/repos/${encodeURIComponent(repoName)}`);
      fetchRepos();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-gray-800 rounded-xl transition-colors text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-blue-400" />
          {mountpoint}
        </h2>
      </div>

      <div className="flex justify-between items-center bg-gray-900 border border-gray-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3 px-3 py-2 bg-gray-950 border border-gray-800 rounded-lg w-full max-w-sm">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Filter repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-gray-600"
          />
        </div>

        <button
          onClick={handleCreateRepo}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" /> New Repository
        </button>
      </div>

      <div className="grid gap-4">
        {filteredRepos.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl">
            <FolderGit2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            {searchQuery ? (
              <>
                <h3 className="text-lg font-medium text-white mb-2">No repositories match your search</h3>
                <p className="text-gray-500 text-sm">Try a different search term or clear the filter.</p>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium text-white mb-2">No repositories yet</h3>
                <p className="text-gray-500 text-sm">Create a new repository to get started backing up to this drive.</p>
              </>
            )}
          </div>
        ) : (
          filteredRepos.map((repo, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-5 bg-gray-900 border border-gray-800 rounded-2xl group hover:border-gray-700 transition-all cursor-pointer shadow-lg shadow-black/20"
              onClick={() => navigate(`/drives/${encodeURIComponent(mountpoint as string)}/repos/${encodeURIComponent(repo.name)}`)}
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-800 rounded-xl text-blue-400 group-hover:bg-blue-500/10 transition-colors">
                  <FolderGit2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-white font-medium text-lg leading-tight group-hover:text-blue-400 transition-colors">{repo.name}</h3>
                  <p className="text-gray-500 text-xs font-mono mt-1 opacity-60">{repo.path}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {repoStatuses[repo.name]?.linked && (repoStatuses[repo.name]?.hasChanges || repoStatuses[repo.name]?.unpushed) && (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-md">
                      Pending Changes
                    </span>
                    <button
                      onClick={(e) => handlePushRepo(e, repo.name)}
                      disabled={pushing === repo.name}
                      className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {pushing === repo.name ? 'Pushing...' : 'Push to Drive'}
                    </button>
                  </div>
                )}

                <div className="text-right text-sm">
                  <div className="text-gray-400">Modified</div>
                  <div className="text-gray-500 font-medium">{new Date(repo.lastModified).toLocaleDateString()}</div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteRepo(repo.name);
                  }}
                  className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-all ml-4"
                  title="Delete Repository"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RepoBrowser() {
  const { mountpoint, repoName } = useParams<{ mountpoint: string, repoName: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const branch = searchParams.get('branch') || 'main';
  const treePath = searchParams.get('path') || '';
  const viewMode = searchParams.get('view') || 'code';

  const [treeFiles, setTreeFiles] = useState<TreeItem[]>([]);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [repoDetails, setRepoDetails] = useState<any>(null);
  const [historyData, setHistoryData] = useState<{ commits: any[]; pushLogs: any[] } | null>(null);

  useEffect(() => {
    if (!mountpoint || !repoName) return;

    axios.get(`/api/drives/${encodeURIComponent(mountpoint)}/repos/${encodeURIComponent(repoName)}`)
      .then(({ data }) => {
        setRepoDetails(data);
        if (!searchParams.has('branch')) {
          let defaultBranch = 'main';
          if (data.branches && data.branches.length > 0) {
            if (data.branches.includes('main')) defaultBranch = 'main';
            else if (data.branches.includes('master')) defaultBranch = 'master';
            else defaultBranch = data.branches[0];
          }
          setSearchParams({ branch: defaultBranch, path: treePath, view: viewMode });
        }
      }).catch(console.error);
  }, [mountpoint, repoName]);

  const loadData = async () => {
    if (!mountpoint || !repoName || !branch) return;

    if (viewMode === 'code') {
      if (!treePath.includes('/') && treePath !== '') {
        // Assuming it's a file
        try {
          const { data } = await axios.get(
            `/api/drives/${encodeURIComponent(mountpoint)}/repos/${encodeURIComponent(repoName)}/blob?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(treePath)}`
          );
          setFileContent(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
          setTreeFiles([]);
          setReadmeContent(null);
        } catch(e) {}
      } else {
        // Assuming it's a directory
        setFileContent(null);
        try {
          const { data } = await axios.get(
            `/api/drives/${encodeURIComponent(mountpoint)}/repos/${encodeURIComponent(repoName)}/tree?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(treePath)}`
          );
          setTreeFiles(data.files || []);
          
          // Check for README if it's a directory view
          const readmeFile = data.files?.find((f: any) => f.name.toLowerCase() === 'readme.md');
          if (readmeFile) {
            try {
              const res = await axios.get(
                `/api/drives/${encodeURIComponent(mountpoint)}/repos/${encodeURIComponent(repoName)}/blob?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(readmeFile.path)}`
              );
              setReadmeContent(res.data);
            } catch(e) {}
          } else {
            setReadmeContent(null);
          }
        } catch (e) {
          setTreeFiles([]);
          setReadmeContent(null);
        }
      }
    } else {
      // History mode
      try {
        const { data } = await axios.get(
          `/api/drives/${encodeURIComponent(mountpoint)}/repos/${encodeURIComponent(repoName)}/commits?branch=${encodeURIComponent(branch)}`
        );
        setHistoryData(data);
      } catch (e) {
        setHistoryData(null);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [mountpoint, repoName, branch, treePath, viewMode]);

  const handlePathClick = (index: number) => {
    if (index === -1) {
      setSearchParams({ branch, path: '', view: viewMode });
      return;
    }
    const parts = treePath.split('/');
    const newPath = parts.slice(0, index + 1).join('/') + '/';
    setSearchParams({ branch, path: newPath, view: viewMode });
  };

  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 fade-in">
      <div className="flex items-center gap-4 font-mono text-sm bg-gray-900 border border-gray-800 p-4 rounded-xl">
        <button
          onClick={() => navigate(`/drives/${encodeURIComponent(mountpoint as string)}`)}
          className="hover:text-white text-gray-400 transition-colors p-1"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 flex-wrap flex-1">
          <span
            className="font-bold text-blue-400 hover:underline cursor-pointer"
            onClick={() => handlePathClick(-1)}
          >
            {repoName}
          </span>

          {treePath.replace(/\/$/, '').split('/').filter(Boolean).map((part, idx, arr) => (
            <React.Fragment key={idx}>
              <ChevronRight className="w-4 h-4 text-gray-600" />
              <span
                className={`hover:underline cursor-pointer ${idx === arr.length - 1 && !fileContent ? 'text-white' : 'text-blue-400'}`}
                onClick={() => handlePathClick(idx)}
              >
                {part}
              </span>
            </React.Fragment>
          ))}
        </div>

        {repoDetails && (
          <div className="flex items-center gap-3">
            <select
              value={branch}
              onChange={(e) => {
                setSearchParams({ branch: e.target.value, path: treePath, view: viewMode });
              }}
              className="bg-gray-800 border border-gray-700 text-sm rounded-lg px-3 py-1.5 outline-none cursor-pointer focus:border-gray-500 font-sans"
            >
              {repoDetails.branches && repoDetails.branches.length > 0 && (
                <optgroup label="Branches">
                  {repoDetails.branches.map((b: string) => <option key={b} value={b}>{b}</option>)}
                </optgroup>
              )}
              {repoDetails.tags && repoDetails.tags.length > 0 && (
                <optgroup label="Tags">
                  {repoDetails.tags.map((t: string) => <option key={t} value={t}>{t}</option>)}
                </optgroup>
              )}
            </select>

            <div className="flex bg-gray-950 border border-gray-800 rounded-lg p-1 ml-2">
              <button
                onClick={() => setSearchParams({ branch, path: treePath, view: 'code' })}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${viewMode === 'code' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'}`}
              >
                Code
              </button>
              <button
                onClick={() => setSearchParams({ branch, path: treePath, view: 'history' })}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${viewMode === 'history' ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'}`}
              >
                History
              </button>
            </div>
          </div>
        )}
      </div>

      {viewMode === 'code' && (
        <>
          {repoDetails?.lastCommit && treePath === '' && (
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex items-center justify-between shadow-lg shadow-black/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 min-w-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center font-bold text-gray-300 shrink-0 uppercase overflow-hidden text-clip">
                  {repoDetails.lastCommit.hash.substring(0, 5)}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-200">{repoDetails.lastCommit.message}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Committed on {new Date(repoDetails.lastCommit.date).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="text-xs font-mono text-gray-500 bg-gray-950 px-2 py-1 rounded-md border border-gray-800">
                {repoDetails.lastCommit.hash.substring(0, 8)}
              </div>
            </div>
          )}

          {fileContent !== null ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg shadow-black/40">
              <div className="bg-gray-800/80 px-4 py-2 border-b border-gray-700 text-xs font-mono text-gray-400 flex items-center gap-2">
                <FileIcon className="w-4 h-4" />
                {treePath.split('/').pop()}
              </div>
              <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-300 leading-relaxed whitespace-pre" style={{ tabSize: 2 }}>
                {fileContent}
              </pre>
            </div>
          ) : (
            <>
              <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg shadow-black/20 overflow-hidden">
                {treeFiles.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    This directory is empty or the repository has no commits yet.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-800/50">
                    {treeFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 cursor-pointer transition-colors group"
                        onClick={() => {
                          if (file.type === 'tree') {
                            setSearchParams({ branch, path: file.path + '/', view: viewMode });
                          } else {
                            setSearchParams({ branch, path: file.path, view: viewMode });
                          }
                        }}
                      >
                        {file.type === 'tree' ? (
                          <FolderIcon className="w-5 h-5 text-blue-400 fill-blue-400/20" />
                        ) : (
                          <FileIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-300" />
                        )}
                        <span className={`text-sm ${file.type === 'tree' ? 'text-white font-medium' : 'text-gray-300'}`}>
                          {file.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {readmeContent && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg shadow-black/20 overflow-hidden mt-6">
                  <div className="bg-gray-800/80 px-4 py-2 border-b border-gray-700 text-xs font-mono text-gray-400 flex items-center gap-2">
                    <FileIcon className="w-4 h-4" />
                    README.md
                  </div>
                  <pre className="p-6 overflow-x-auto text-sm font-sans text-gray-300 leading-relaxed whitespace-pre-wrap whitespace-normal" style={{ tabSize: 2 }}>
                    {readmeContent}
                  </pre>
                </div>
              )}
            </>
          )}
        </>
      )}

      {viewMode === 'history' && historyData && (
        <div className="space-y-6">
          {historyData.pushLogs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest pl-1 border-b border-gray-800 pb-2">Git Drive Transfer Logs</h3>
              <div className="grid gap-3">
                {historyData.pushLogs.map((log, idx) => (
                  <div key={idx} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex gap-4 text-sm">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 h-fit">
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 w-full">
                      <div className="flex justify-between items-start text-gray-300">
                        <span className="font-semibold text-white">{log.user} pushed this repo</span>
                        <span className="text-xs text-gray-500">{new Date(log.date).toLocaleString()}</span>
                      </div>
                      <div className="text-gray-500 text-xs font-mono grid grid-cols-[80px_1fr] gap-x-2">
                        <span>Computer:</span><span className="text-gray-400">{log.computer}</span>
                        <span>Source:</span><span className="text-gray-400 truncate" title={log.localDir}>{log.localDir}</span>
                        <span>Operation:</span><span className="text-gray-400">{log.mode}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3 pt-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest pl-1 border-b border-gray-800 pb-2">Git Commits ({branch})</h3>
            {historyData.commits.length === 0 ? (
              <div className="text-gray-500 text-sm p-4 text-center">No commits in this branch.</div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800/50">
                {historyData.commits.map((commit, idx) => (
                  <div 
                    key={idx} 
                    className="p-4 hover:bg-gray-800/30 transition-colors flex gap-4 items-start cursor-pointer group"
                    onClick={() => navigate(`/drives/${encodeURIComponent(mountpoint as string)}/repos/${encodeURIComponent(repoName as string)}/commit/${commit.hash}`)}
                  >
                    <div className="w-10 h-10 min-w-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center font-bold text-gray-300 shrink-0 uppercase overflow-hidden text-clip group-hover:bg-blue-500/10 group-hover:border-blue-500/30 group-hover:text-blue-400 transition-colors">
                      {commit.author.substring(0, 2)}
                    </div>
                    <div className="w-full">
                      <div className="flex justify-between gap-4">
                        <div className="font-medium text-gray-200 mb-1 leading-snug break-words group-hover:text-blue-400 transition-colors">
                          {commit.message}
                        </div>
                        <div className="text-xs font-mono text-gray-500 shrink-0 mt-1">
                          {commit.hash.substring(0, 7)}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 flex gap-2 items-center flex-wrap">
                        <span className="font-medium text-gray-400">{commit.author}</span>
                        <span>&bull;</span>
                        <span className="opacity-75">{commit.email}</span>
                        <span>&bull;</span>
                        <span>{new Date(commit.date).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CommitViewer() {
  const { mountpoint, repoName, hash } = useParams<{ mountpoint: string, repoName: string, hash: string }>();
  const navigate = useNavigate();
  const [commit, setCommit] = useState<any>(null);

  useEffect(() => {
    if (!mountpoint || !repoName || !hash) return;
    axios.get(`/api/drives/${encodeURIComponent(mountpoint)}/repos/${encodeURIComponent(repoName)}/commits/${hash}`)
      .then(({ data }) => setCommit(data))
      .catch(console.error);
  }, [mountpoint, repoName, hash]);

  if (!commit) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-20 bg-gray-800/50 rounded-xl"></div>
        <div className="h-64 bg-gray-800/50 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-800 rounded-xl transition-colors text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-xl font-semibold text-white">
          Commit <span className="font-mono text-blue-400">{commit.hash.substring(0, 7)}</span>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl flex items-start gap-4 shadow-lg shadow-black/20">
        <div className="w-12 h-12 min-w-12 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center font-bold text-gray-300 shrink-0 uppercase overflow-hidden text-clip text-lg">
          {commit.author.substring(0, 2)}
        </div>
        <div className="space-y-2">
          <div className="text-lg font-medium text-white">{commit.message}</div>
          <div className="text-sm text-gray-500 flex gap-2 items-center flex-wrap">
            <span className="font-medium text-gray-300">{commit.author}</span>
            <span className="text-gray-600">&lt;{commit.email}&gt;</span>
            <span>committed on {new Date(commit.date).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg shadow-black/40">
        <div className="bg-gray-800/80 px-4 py-3 border-b border-gray-700 text-sm font-semibold text-white flex items-center gap-2">
          <FileIcon className="w-4 h-4 text-gray-400" />
          Diff Changes
        </div>
        <div className="overflow-x-auto p-4 bg-[#0d1117]">
          {commit.patch.split('\n').map((line: string, i: number) => {
            let lineClass = "text-gray-300";
            let bgClass = "bg-transparent";
            
            if (line.startsWith('+') && !line.startsWith('+++')) {
              lineClass = "text-green-400";
              bgClass = "bg-green-500/10";
            } else if (line.startsWith('-') && !line.startsWith('---')) {
              lineClass = "text-red-400";
              bgClass = "bg-red-500/10";
            } else if (line.startsWith('@@')) {
              lineClass = "text-blue-400 font-semibold";
              bgClass = "bg-blue-500/5";
            }
            
            return (
              <pre key={i} className={`font-mono text-xs p-1 px-2 -mx-4 leading-relaxed ${lineClass} ${bgClass}`} style={{ tabSize: 2 }}>
                {line || ' '}
              </pre>
            );
          })}
        </div>
      </div>
    </div>
  );
}
