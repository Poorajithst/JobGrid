import { useState, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { JobList } from './components/JobList';
import { DetailPanel } from './components/DetailPanel';
import { DocumentUpload } from './components/DocumentUpload';
import { ProfileManager } from './components/ProfileManager';
import { useJobs } from './hooks/useJobs';
import { useStats } from './hooks/useStats';
import { useJob } from './hooks/useJob';
import type { JobFilters } from './api/types';

type View = 'dashboard' | 'documents' | 'profiles';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [filters, setFilters] = useState<JobFilters>({ sort: 'fit_score', order: 'desc' });
  const [selectedId, setSelectedId] = useState<number | null>(null);

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

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar
        stats={stats}
        onScrapeComplete={handleRefresh}
        activeProfileId={activeProfileId}
        onProfileChange={setActiveProfileId}
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
