import { useState, useEffect, useCallback } from 'react';
import { statsApi } from '../api/client';
import type { Stats, IpeStats } from '../api/types';

export function useStats(profileId?: number | null) {
  const [stats, setStats] = useState<(Stats & Partial<IpeStats>) | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const result = await statsApi.get(profileId ?? undefined);
      setStats(result);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
