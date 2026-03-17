import { useState, useEffect, useCallback, useRef } from 'react';
import { jobsApi } from '../api/client';
import type { JobFilters, JobsResponse } from '../api/types';

export function useJobs(filters: JobFilters = {}) {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchJobs = useCallback(async (f: JobFilters) => {
    setLoading(true);
    setError(null);
    try {
      const result = await jobsApi.list(f);
      setData(result);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchJobs(filters), filters.search ? 300 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [
    filters.source, filters.status, filters.competition,
    filters.minScore, filters.search, filters.sort,
    filters.order, filters.page, filters.limit,
    filters.profileId, filters.scoreTier, fetchJobs,
  ]);

  const refetch = useCallback(() => fetchJobs(filters), [fetchJobs, filters]);

  return {
    jobs: data?.jobs ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    totalPages: data?.totalPages ?? 1,
    hasMore: data?.hasMore ?? false,
    loading,
    error,
    refetch,
  };
}
