import { useState, useCallback, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { JobList } from './components/JobList';
import { DetailPanel } from './components/DetailPanel';
import { DocumentUpload } from './components/DocumentUpload';
import { ProfileManager } from './components/ProfileManager';
import { UserSwitcher } from './components/UserSwitcher';
import type { AppUser } from './components/UserSwitcher';
import { OnboardingWizard } from './components/OnboardingWizard';
import { useJobs } from './hooks/useJobs';
import { useStats } from './hooks/useStats';
import { useJob } from './hooks/useJob';
import { usersApi, setActiveUserId } from './api/client';
import type { JobFilters } from './api/types';

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
  const [initialized, setInitialized] = useState(false);

  // Settings state
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  // Fetch users and determine initial state
  const fetchUsers = useCallback(async () => {
    try {
      const list = await usersApi.list();
      setUsers(list);
      return list as AppUser[];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    (async () => {
      const list = await fetchUsers();
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

      // No stored user or not found — check if any users exist
      if (list.length === 0) {
        setShowOnboarding(true);
      } else {
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

  const filtersWithProfile = { ...filters, profileId: activeProfileId ?? undefined };
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

  // Show onboarding wizard overlay
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
            <h2 className="text-[22px] font-bold text-[#f1f5f9] tracking-tight mb-6">Settings</h2>

            {/* Current User */}
            <div className="bg-gradient-to-br from-[#0f172a]/70 to-[#0f172a]/30 border border-border-subtle rounded-xl p-5 px-6 mb-4">
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
            <div className="bg-gradient-to-br from-[#0f172a]/70 to-[#0f172a]/30 border border-border-subtle rounded-xl p-5 px-6">
              <div className="text-[9px] font-bold uppercase tracking-[1.2px] text-text-dim mb-3">All Users</div>
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className={`flex items-center gap-3 py-2 px-3 rounded-lg ${u.id === activeUser?.id ? 'bg-accent-indigo/[0.08]' : ''}`}
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
          </div>
        </div>
      )}
    </div>
  );
}
