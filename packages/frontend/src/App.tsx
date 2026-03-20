import { useState, useCallback, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { JobList } from './components/JobList';
import { DetailPanel } from './components/DetailPanel';
import { DocumentUpload } from './components/DocumentUpload';
import { ProfileManager } from './components/ProfileManager';
import { UserSwitcher } from './components/UserSwitcher';
import type { AppUser } from './components/UserSwitcher';
import { OnboardingWizard } from './components/OnboardingWizard';
import { Setup } from './pages/Setup';
import { Skills } from './pages/Settings/Skills';
import { useJobs } from './hooks/useJobs';
import { useStats } from './hooks/useStats';
import { useJob } from './hooks/useJob';
import { usersApi, setActiveUserId, companiesApi } from './api/client';
import type { JobFilters, Company } from './api/types';

type View = 'dashboard' | 'documents' | 'profiles' | 'settings';

const LS_KEY = 'jobgrid_user_id';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [filters, setFilters] = useState<JobFilters>({ sort: 'fit_score', order: 'desc' });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // User state
  const [users, setUsers] = useState<AppUser[]>([]);
  const [activeUser, setActiveUser] = useState<AppUser | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Settings state
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  // Company discovery state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverCandidates, setDiscoverCandidates] = useState<any[]>([]);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [confirmingIds, setConfirmingIds] = useState<Set<string>>(new Set());

  // Fetch companies list
  const fetchCompanies = useCallback(async () => {
    try {
      const list = await companiesApi.list();
      setCompanies(list);
    } catch {
      /* ignore */
    }
  }, []);

  // Discover companies via AI
  const handleDiscover = useCallback(async () => {
    setDiscoverLoading(true);
    setDiscoverError(null);
    setDiscoverCandidates([]);
    try {
      const data = await companiesApi.discover();
      setDiscoverCandidates(data.companies || []);
    } catch (err: any) {
      setDiscoverError(err?.response?.data?.error || 'Discovery failed');
    } finally {
      setDiscoverLoading(false);
    }
  }, []);

  // Confirm adding a discovered company
  const handleDiscoverAdd = useCallback(async (company: any) => {
    setConfirmingIds(prev => new Set(prev).add(company.name));
    try {
      await companiesApi.discoverConfirm([company]);
      setDiscoverCandidates(prev => prev.filter(c => c.name !== company.name));
      await fetchCompanies();
    } catch {
      /* ignore */
    } finally {
      setConfirmingIds(prev => { const s = new Set(prev); s.delete(company.name); return s; });
    }
  }, [fetchCompanies]);

  // Fetch users and determine initial state
  const fetchUsers = useCallback(async () => {
    try {
      const list = await usersApi.list();
      setUsers(list);
      return list as AppUser[];
    } catch (err: any) {
      // 412 means setup_required — show Setup wizard instead of OnboardingWizard
      if (err?.response?.status === 412) {
        setShowSetup(true);
        setInitialized(true);
      }
      return [];
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      const list = await fetchUsers();
      // If 412 was caught above, initialized is already true
      if (list.length === 0 && !showSetup) {
        // No users — show first-run Setup wizard
        setShowSetup(true);
        setInitialized(true);
        return;
      }

      const storedId = localStorage.getItem(LS_KEY);
      if (storedId) {
        const found = list.find((u: AppUser) => u.id === Number(storedId));
        if (found) {
          setActiveUser(found);
          setActiveUserId(found.id);
          setInitialized(true);
          return;
        }
      }

      if (list.length > 0) {
        // Pick first user
        const first = list[0];
        setActiveUser(first);
        setActiveUserId(first.id);
        localStorage.setItem(LS_KEY, String(first.id));
      }
      setInitialized(true);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwitchUser = useCallback((user: AppUser) => {
    setActiveUser(user);
    setActiveUserId(user.id);
    localStorage.setItem(LS_KEY, String(user.id));
  }, []);

  const handleOnboardingComplete = useCallback((user: { id: number; name: string; avatarColor: string }) => {
    const appUser: AppUser = { id: user.id, name: user.name, avatarColor: user.avatarColor };
    setActiveUser(appUser);
    setActiveUserId(user.id);
    localStorage.setItem(LS_KEY, String(user.id));
    setUsers((prev) => [...prev, appUser]);
    setShowOnboarding(false);
  }, []);

  const handleSetupComplete = useCallback((user: { id: number; name: string; avatarColor: string }) => {
    const appUser: AppUser = { id: user.id, name: user.name, avatarColor: user.avatarColor };
    setActiveUser(appUser);
    setActiveUserId(user.id);
    localStorage.setItem(LS_KEY, String(user.id));
    setUsers([appUser]);
    setShowSetup(false);
  }, []);

  const handleAddUser = useCallback(() => {
    setShowOnboarding(true);
  }, []);

  const handleRename = useCallback(async () => {
    if (!activeUser || !newName.trim()) return;
    try {
      await usersApi.update(activeUser.id, { name: newName.trim() });
      const updated = { ...activeUser, name: newName.trim() };
      setActiveUser(updated);
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
      setRenaming(false);
    } catch {
      /* ignore */
    }
  }, [activeUser, newName]);

  const [scoreTier, setScoreTier] = useState<'analytic' | 'ai' | undefined>(undefined);
  const filtersWithProfile = { ...filters, profileId: activeProfileId ?? undefined, scoreTier };
  const { jobs, loading, refetch: refetchJobs } = useJobs(filtersWithProfile);
  const { stats, refetch: refetchStats } = useStats(activeProfileId);
  const { job: selectedJob, refetch: refetchJob, updateStatus, updateNotes } = useJob(selectedId);

  const handleRefresh = useCallback(() => {
    refetchJobs();
    refetchStats();
    if (selectedId) refetchJob();
  }, [refetchJobs, refetchStats, refetchJob, selectedId]);

  const handleStatusChange = useCallback(async (status: string) => {
    await updateStatus(status);
    refetchJobs();
    refetchStats();
  }, [updateStatus, refetchJobs, refetchStats]);

  const handleNotesChange = useCallback(async (notes: string) => {
    await updateNotes(notes);
  }, [updateNotes]);

  // Show first-run setup wizard (no users exist or 412 from backend)
  if (showSetup) {
    return <Setup onComplete={handleSetupComplete} />;
  }

  // Show onboarding wizard for adding additional users
  if (showOnboarding) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

  // Wait for initialization
  if (!initialized) {
    return (
      <div className="h-screen flex items-center justify-center">
        <span className="text-text-dim text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar
        stats={stats}
        onScrapeComplete={handleRefresh}
        activeProfileId={activeProfileId}
        onProfileChange={setActiveProfileId}
        scoreTier={scoreTier}
        onScoreTierChange={setScoreTier}
        userSwitcher={
          <UserSwitcher
            activeUser={activeUser}
            users={users}
            onSwitch={handleSwitchUser}
            onAddUser={handleAddUser}
            onRefresh={fetchUsers}
          />
        }
      />

      {/* Navigation tabs */}
      <div className="bg-bg-secondary border-b border-border-subtle px-6 flex gap-1">
        {([
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'documents', label: 'Documents' },
          { key: 'profiles', label: 'Profiles' },
          { key: 'settings', label: 'Settings' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-4 py-2.5 text-xs font-semibold transition-all border-b-2 -mb-px
              ${view === key
                ? 'text-accent-indigo-light border-accent-indigo'
                : 'text-text-dim border-transparent hover:text-text-muted hover:border-border-subtle'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* View content */}
      {view === 'dashboard' && (
        <div className="flex flex-1 overflow-hidden">
          <JobList
            jobs={jobs}
            selectedId={selectedId}
            onSelect={setSelectedId}
            filters={filters}
            onFiltersChange={setFilters}
          />
          <div className="flex-1 overflow-hidden">
            {selectedJob ? (
              <DetailPanel
                job={selectedJob}
                onStatusChange={handleStatusChange}
                onNotesChange={handleNotesChange}
                activeProfileId={activeProfileId}
                onRefresh={handleRefresh}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-text-dim text-sm">
                {loading ? 'Loading...' : 'Select a job to view details'}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'documents' && (
        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-bg-card">
          <DocumentUpload />
        </div>
      )}

      {view === 'profiles' && (
        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-bg-card">
          <ProfileManager onProfileActivated={setActiveProfileId} />
        </div>
      )}

      {view === 'settings' && (
        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-bg-card">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-[22px] font-bold text-text-primary tracking-tight mb-6">Settings</h2>

            {/* Current User */}
            <div className="bg-gradient-to-br from-bg-tertiary/70 to-bg-tertiary/30 border border-border-subtle rounded-xl p-5 px-6 mb-4">
              <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-3">Current User</div>
              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ backgroundColor: activeUser?.avatarColor || '#6366f1' }}
                >
                  {activeUser?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  {renaming ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                        className="bg-bg-primary/40 border border-border-subtle rounded-lg p-2 text-xs text-text-primary outline-none focus:border-accent-indigo/40 flex-1"
                        autoFocus
                      />
                      <button onClick={handleRename} className="text-accent-indigo text-[11px] font-semibold">Save</button>
                      <button onClick={() => setRenaming(false)} className="text-text-dim text-[11px]">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-text-primary">{activeUser?.name}</span>
                      <button
                        onClick={() => { setNewName(activeUser?.name || ''); setRenaming(true); }}
                        className="text-accent-indigo text-[10px] font-semibold hover:text-accent-indigo-light"
                      >
                        Rename
                      </button>
                    </div>
                  )}
                  <div className="text-[10px] text-text-dim mt-0.5">ID: {activeUser?.id}</div>
                </div>
              </div>
            </div>

            {/* All Users */}
            <div className="bg-gradient-to-br from-bg-tertiary/70 to-bg-tertiary/30 border border-border-subtle rounded-xl p-5 px-6 mb-6">
              <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-3">All Users</div>
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => handleSwitchUser(u)}
                    className={`flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer hover:bg-accent-indigo/[0.06] transition-colors ${u.id === activeUser?.id ? 'bg-accent-indigo/[0.08]' : ''}`}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ backgroundColor: u.avatarColor }}
                    >
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-text-secondary flex-1">{u.name}</span>
                    {u.id === activeUser?.id && (
                      <span className="text-[10px] text-accent-indigo-light font-semibold">Active</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* My Skills */}
            {activeUser && (
              <div className="mb-6">
                <h3 className="text-[13px] font-bold text-text-primary tracking-tight mb-4">My Skills</h3>
                <Skills userId={activeUser.id} />
              </div>
            )}

            {/* Companies */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[13px] font-bold text-text-primary tracking-tight">Companies</h3>
                <button
                  onClick={handleDiscover}
                  disabled={discoverLoading}
                  className="text-[10px] font-semibold bg-accent-indigo/20 hover:bg-accent-indigo/30 text-accent-indigo-light border border-accent-indigo/30 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                >
                  {discoverLoading ? 'Discovering...' : 'Discover More'}
                </button>
              </div>

              {discoverError && (
                <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 text-[11px] text-red-400 mb-3">
                  {discoverError}
                  <button onClick={() => setDiscoverError(null)} className="ml-2 underline">dismiss</button>
                </div>
              )}

              {/* Discovery candidates */}
              {discoverCandidates.length > 0 && (
                <div className="bg-purple-900/10 border border-purple-800/30 rounded-xl p-4 px-5 mb-3">
                  <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-purple-400 mb-3">
                    AI-Suggested Companies ({discoverCandidates.length})
                  </div>
                  <div className="space-y-2">
                    {discoverCandidates.map((c) => (
                      <div key={c.name} className="flex items-center gap-3 py-1.5 px-2 rounded-lg bg-bg-primary/20">
                        <span className="text-xs font-medium text-text-secondary flex-1">{c.name}</span>
                        {c.reason && (
                          <span className="text-[10px] text-text-dim truncate max-w-[160px]">{c.reason}</span>
                        )}
                        <div className="flex items-center gap-1 text-[9px] text-text-dim">
                          {c.greenhouse && <span className="bg-green-900/40 text-green-400 px-1 py-0.5 rounded">GH</span>}
                          {c.lever && <span className="bg-blue-900/40 text-blue-400 px-1 py-0.5 rounded">LV</span>}
                          {c.ashby && <span className="bg-orange-900/40 text-orange-400 px-1 py-0.5 rounded">AB</span>}
                        </div>
                        <button
                          onClick={() => handleDiscoverAdd(c)}
                          disabled={confirmingIds.has(c.name)}
                          className="text-[10px] font-semibold text-accent-indigo hover:text-accent-indigo-light disabled:opacity-50 transition-colors"
                        >
                          {confirmingIds.has(c.name) ? 'Adding...' : 'Add'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Company list */}
              <div className="bg-gradient-to-br from-bg-tertiary/70 to-bg-tertiary/30 border border-border-subtle rounded-xl p-4 px-5">
                <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-3">
                  All Companies ({companies.length})
                </div>
                {companies.length === 0 ? (
                  <span className="text-[11px] text-text-dim/50 italic">No companies yet</span>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-bg-card">
                    {companies.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-bg-primary/20 transition-colors">
                        <span className="text-xs font-medium text-text-secondary flex-1">{c.name}</span>
                        <div className="flex items-center gap-1 text-[9px]">
                          {c.greenhouse_slug && <span className="bg-green-900/40 text-green-400 px-1 py-0.5 rounded">GH</span>}
                          {c.lever_slug && <span className="bg-blue-900/40 text-blue-400 px-1 py-0.5 rounded">LV</span>}
                          {(c as any).source && (
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold ${
                              (c as any).source === 'seed' ? 'bg-gray-700 text-gray-300'
                              : (c as any).source === 'manual' ? 'bg-green-900/50 text-green-300'
                              : (c as any).source === 'discovered' ? 'bg-purple-900/50 text-purple-300'
                              : (c as any).source === 'ai-suggested' ? 'bg-orange-900/50 text-orange-300'
                              : 'bg-gray-700 text-gray-300'
                            }`}>
                              {(c as any).source}
                            </span>
                          )}
                          {c.active ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" title="Active" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-600 inline-block" title="Inactive" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
