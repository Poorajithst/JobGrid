import { useState, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { JobList } from './components/JobList';
import { DetailPanel } from './components/DetailPanel';
import { useJobs } from './hooks/useJobs';
import { useStats } from './hooks/useStats';
import { useJob } from './hooks/useJob';
import type { JobFilters } from './api/types';

export default function App() {
  const [filters, setFilters] = useState<JobFilters>({ sort: 'fit_score', order: 'desc' });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { jobs, loading, refetch: refetchJobs } = useJobs(filters);
  const { stats, refetch: refetchStats } = useStats();
  const { job: selectedJob, updateStatus, updateNotes } = useJob(selectedId);

  const handleScrapeComplete = useCallback(() => {
    refetchJobs();
    refetchStats();
  }, [refetchJobs, refetchStats]);

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
      <TopBar stats={stats} onScrapeComplete={handleScrapeComplete} />
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
            />
          ) : (
            <div className="flex items-center justify-center h-full text-text-dim text-sm">
              {loading ? 'Loading...' : 'Select a job to view details'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
