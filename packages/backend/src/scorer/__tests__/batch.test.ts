import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreJobs } from '../index.js';

vi.mock('../groq.js', () => ({
  scoreJob: vi.fn(),
}));

import { scoreJob } from '../groq.js';
const mockScoreJob = vi.mocked(scoreJob);

describe('scoreJobs (batch)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('scores jobs in batches of 10 with pauses', async () => {
    mockScoreJob.mockResolvedValue({
      fit_score: 80,
      competition: 'low',
      recommendation: 'apply',
      score_reason: 'Good match',
      pitch: 'Strong fit',
    });

    // Create 12 jobs — should be 2 batches
    const jobs = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      title: `PM ${i}`,
      company: `Co ${i}`,
      source: 'greenhouse',
      description: 'A role',
    }));

    const promise = scoreJobs(jobs);
    // Advance past the 1-second pause between batches
    await vi.advanceTimersByTimeAsync(2000);
    const results = await promise;

    expect(mockScoreJob).toHaveBeenCalledTimes(12);
    expect(results).toHaveLength(12);
  });

  it('skips jobs that fail scoring', async () => {
    mockScoreJob
      .mockResolvedValueOnce({
        fit_score: 90,
        competition: 'low',
        recommendation: 'apply',
        score_reason: 'Great',
        pitch: 'Yes',
      })
      .mockResolvedValueOnce(null); // Failed

    const jobs = [
      { id: 1, title: 'PM1', company: 'Co1', source: 'greenhouse', description: 'Role' },
      { id: 2, title: 'PM2', company: 'Co2', source: 'lever', description: 'Role' },
    ];

    const results = await scoreJobs(jobs);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
  });
});
