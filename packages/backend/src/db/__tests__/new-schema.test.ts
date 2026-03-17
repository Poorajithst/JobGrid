import { describe, it, expect } from 'vitest';
import { documents, profiles, jobScores, users, outreach } from '../schema.js';
import { getTableColumns } from 'drizzle-orm';

describe('New Tables Schema', () => {
  it('documents table has required columns', () => {
    const cols = getTableColumns(documents);
    expect(cols.id).toBeDefined();
    expect(cols.type).toBeDefined();
    expect(cols.filename).toBeDefined();
    expect(cols.rawText).toBeDefined();
    expect(cols.parsedSkills).toBeDefined();
    expect(cols.parsedTitles).toBeDefined();
    expect(cols.parsedCerts).toBeDefined();
    expect(cols.parsedExperienceYears).toBeDefined();
    expect(cols.parsedLocations).toBeDefined();
    expect(cols.parsedTools).toBeDefined();
    expect(cols.uploadedAt).toBeDefined();
    expect(cols.updatedAt).toBeDefined();
  });

  it('profiles table has required columns', () => {
    const cols = getTableColumns(profiles);
    expect(cols.id).toBeDefined();
    expect(cols.name).toBeDefined();
    expect(cols.targetTitles).toBeDefined();
    expect(cols.targetSkills).toBeDefined();
    expect(cols.targetCerts).toBeDefined();
    expect(cols.targetLocations).toBeDefined();
    expect(cols.searchQueries).toBeDefined();
    expect(cols.freshnessWeight).toBeDefined();
    expect(cols.skillWeight).toBeDefined();
    expect(cols.titleWeight).toBeDefined();
    expect(cols.certWeight).toBeDefined();
    expect(cols.competitionWeight).toBeDefined();
    expect(cols.locationWeight).toBeDefined();
    expect(cols.experienceWeight).toBeDefined();
    expect(cols.analyticTopN).toBeDefined();
    expect(cols.aiTopN).toBeDefined();
    expect(cols.profileHash).toBeDefined();
    expect(cols.isActive).toBeDefined();
    expect(cols.userId).toBeDefined();
  });

  it('jobScores table has required columns', () => {
    const cols = getTableColumns(jobScores);
    expect(cols.id).toBeDefined();
    expect(cols.jobId).toBeDefined();
    expect(cols.profileId).toBeDefined();
    expect(cols.ipeScore).toBeDefined();
    expect(cols.freshnessScore).toBeDefined();
    expect(cols.skillMatchScore).toBeDefined();
    expect(cols.titleAlignmentScore).toBeDefined();
    expect(cols.certMatchScore).toBeDefined();
    expect(cols.competitionScore).toBeDefined();
    expect(cols.locationMatchScore).toBeDefined();
    expect(cols.experienceAlignScore).toBeDefined();
    expect(cols.matchedSkills).toBeDefined();
    expect(cols.aiValidated).toBeDefined();
    expect(cols.aiAgrees).toBeDefined();
    expect(cols.aiPitch).toBeDefined();
    expect(cols.aiFlags).toBeDefined();
    expect(cols.aiFitAssessment).toBeDefined();
  });

  it('users table has required columns', () => {
    const cols = getTableColumns(users);
    expect(cols.id).toBeDefined();
    expect(cols.name).toBeDefined();
    expect(cols.avatarColor).toBeDefined();
    expect(cols.createdAt).toBeDefined();
  });

  it('documents table has userId column', () => {
    const cols = getTableColumns(documents);
    expect(cols.userId).toBeDefined();
  });

  it('outreach table has userId column', () => {
    const cols = getTableColumns(outreach);
    expect(cols.userId).toBeDefined();
  });
});
