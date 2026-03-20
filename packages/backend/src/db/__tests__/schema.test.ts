import { describe, it, expect } from 'vitest';
import { companies, jobs, outreach, scrapeRuns, profiles, userDictionary, discoveryRuns } from '../schema.js';
import { getTableColumns } from 'drizzle-orm';

describe('Database Schema', () => {
  it('companies table has required columns', () => {
    const cols = getTableColumns(companies);
    expect(cols.id).toBeDefined();
    expect(cols.name).toBeDefined();
    expect(cols.greenhouseSlug).toBeDefined();
    expect(cols.leverSlug).toBeDefined();
    expect(cols.active).toBeDefined();
    expect(cols.lastChecked).toBeDefined();
    expect(cols.createdAt).toBeDefined();
  });

  it('jobs table has required columns', () => {
    const cols = getTableColumns(jobs);
    expect(cols.id).toBeDefined();
    expect(cols.title).toBeDefined();
    expect(cols.company).toBeDefined();
    expect(cols.link).toBeDefined();
    expect(cols.source).toBeDefined();
    expect(cols.fitScore).toBeDefined();
    expect(cols.competition).toBeDefined();
    expect(cols.recommendation).toBeDefined();
    expect(cols.pitch).toBeDefined();
    expect(cols.status).toBeDefined();
  });

  it('outreach table has required columns', () => {
    const cols = getTableColumns(outreach);
    expect(cols.id).toBeDefined();
    expect(cols.jobId).toBeDefined();
    expect(cols.type).toBeDefined();
    expect(cols.content).toBeDefined();
  });

  it('scrapeRuns table has required columns', () => {
    const cols = getTableColumns(scrapeRuns);
    expect(cols.id).toBeDefined();
    expect(cols.startedAt).toBeDefined();
    expect(cols.status).toBeDefined();
    expect(cols.jobsFound).toBeDefined();
    expect(cols.jobsNew).toBeDefined();
  });

  it('companies table has new columns', () => {
    const cols = getTableColumns(companies);
    expect(cols.ashbySlug).toBeDefined();
    expect(cols.source).toBeDefined();
    expect(cols.discoveredAt).toBeDefined();
    expect(cols.relevanceNote).toBeDefined();
  });

  it('profiles table has new columns', () => {
    const cols = getTableColumns(profiles);
    expect(cols.archetype).toBeDefined();
    expect(cols.excludeTitles).toBeDefined();
    expect(cols.remotePreference).toBeDefined();
  });

  it('userDictionary table has required columns', () => {
    const cols = getTableColumns(userDictionary);
    expect(cols.id).toBeDefined();
    expect(cols.userId).toBeDefined();
    expect(cols.category).toBeDefined();
    expect(cols.term).toBeDefined();
    expect(cols.source).toBeDefined();
    expect(cols.createdAt).toBeDefined();
  });

  it('discoveryRuns table has required columns', () => {
    const cols = getTableColumns(discoveryRuns);
    expect(cols.id).toBeDefined();
    expect(cols.startedAt).toBeDefined();
    expect(cols.finishedAt).toBeDefined();
    expect(cols.companiesFound).toBeDefined();
    expect(cols.companiesNew).toBeDefined();
    expect(cols.status).toBeDefined();
    expect(cols.error).toBeDefined();
    expect(cols.source).toBeDefined();
  });
});
