import 'dotenv/config';
import { db } from './index.js';
import { createQueries } from './queries.js';
import { jobs } from './schema.js';

const queries = createQueries(db);

// Step 1: Create "Legacy PM" profile from hardcoded profile data
console.log('Creating Legacy PM profile...');
const profile = queries.insertProfile({
  name: 'Legacy PM',
  targetTitles: JSON.stringify(['Project Manager', 'Program Manager', 'Technical Program Manager', 'Infrastructure PM']),
  targetSkills: JSON.stringify(['agile', 'scrum', 'python', 'sql', 'power bi', 'jira', 'safe']),
  targetCerts: JSON.stringify(['capm', 'pmi-acp', 'safe']),
  targetLocations: JSON.stringify(['Worcester, MA', 'Boston, MA', 'Remote']),
  searchQueries: JSON.stringify([
    '"project manager" Worcester MA',
    '"program manager" Worcester MA',
    '"technical program manager" Boston MA',
    '"infrastructure PM" remote',
  ]),
});
console.log(`Created profile: ${profile.name} (id: ${profile.id})`);

// Step 2: Migrate existing scores from jobs to job_scores
// Note: Most jobs may be unscored (fit_score is null) since scoring was only partially wired
const allJobs = db.select().from(jobs).all();
let migrated = 0;

for (const job of allJobs) {
  // Only migrate jobs that have a fit_score
  if (job.fitScore !== null) {
    const competitionScore = job.competition === 'low' ? 85 : job.competition === 'medium' ? 50 : job.competition === 'high' ? 20 : 50;

    queries.upsertJobScore({
      jobId: job.id,
      profileId: profile.id,
      ipeScore: job.fitScore, // Use old AI score as temporary IPE score
      freshnessScore: 0,
      skillMatchScore: 0,
      titleAlignmentScore: 0,
      certMatchScore: 0,
      competitionScore,
      locationMatchScore: 0,
      experienceAlignScore: 0,
      matchedSkills: null,
    });
    migrated++;
  }
}

console.log(`Migrated ${migrated} scored jobs to job_scores table.`);
console.log(`${allJobs.length - migrated} unscored jobs will be scored by IPE on next run.`);
console.log('Migration complete. Old scoring columns can be dropped in a future schema migration.');
