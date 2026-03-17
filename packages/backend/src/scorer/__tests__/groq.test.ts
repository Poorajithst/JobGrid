import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreJob } from '../groq.js';

vi.mock('groq-sdk', () => {
  const mockCreate = vi.fn();
  return {
    default: class Groq {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
      static __mockCreate = mockCreate;
    },
  };
});

// Access mock through the module
import Groq from 'groq-sdk';
const mockCreate = (Groq as any).__mockCreate;

describe('scoreJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scores a job and returns validated response', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            fit_score: 85,
            competition: 'low',
            recommendation: 'apply',
            score_reason: 'Strong PM match',
            pitch: 'Your infra experience aligns perfectly.',
          }),
        },
      }],
    });

    const result = await scoreJob({
      title: 'PM',
      company: 'TestCo',
      source: 'greenhouse',
      description: 'A PM role',
    });

    expect(result).toBeDefined();
    expect(result!.fit_score).toBe(85);
    expect(result!.competition).toBe('low');
  });

  it('returns null on invalid JSON response', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: { content: 'not json' },
      }],
    });

    const result = await scoreJob({
      title: 'PM',
      company: 'TestCo',
      source: 'greenhouse',
      description: 'A PM role',
    });

    expect(result).toBeNull();
  });

  it('returns null on API error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API error'));

    const result = await scoreJob({
      title: 'PM',
      company: 'TestCo',
      source: 'greenhouse',
      description: 'A PM role',
    });

    expect(result).toBeNull();
  });
});
