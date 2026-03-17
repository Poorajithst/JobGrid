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

type View = 'dashboard' | 'documents' | 'profiles';

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
    </div>
  );
}
