import { useState, useEffect, useCallback } from 'react';
import { jobsApi } from '../api/client';
import type { JobWithOutreach } from '../api/types';

export function useJob(id: number | null) {
  const [job, setJob] = useState<JobWithOutreach | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchJob = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await jobsApi.get(id);
      setJob(result);
    } catch (err) {
      console.error('Failed to fetch job:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  const updateStatus = useCallback(async (status: string) => {
    if (!id) return;
    try {
      const updated = await jobsApi.updateStatus(id, status);
      setJob(prev => prev ? { ...prev, ...updated } : null);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }, [id]);

  const updateNotes = useCallback(async (notes: string, next_action?: string) => {
    if (!id) return;
    try {
      const updated = await jobsApi.updateNotes(id, { notes, next_action });
      setJob(prev => prev ? { ...prev, ...updated } : null);
    } catch (err) {
      console.error('Failed to update notes:', err);
    }
  }, [id]);

  return { job, loading, refetch: fetchJob, updateStatus, updateNotes };
}
