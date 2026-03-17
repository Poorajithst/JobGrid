import 'dotenv/config';
import { db } from './index.js';
import { createQueries } from './queries.js';
import { users, documents, profiles, outreach } from './schema.js';
import { sql, isNull } from 'drizzle-orm';

const queries = createQueries(db);

// Insert default user if not exists
const existing = db.select().from(users).all();
if (existing.length === 0) {
  db.insert(users).values({ id: 1, name: 'Default User', avatarColor: '#6366f1' }).run();
  console.log('Created default user (id=1)');
} else {
  console.log(`Users already exist (${existing.length} found), skipping insert`);
}

// Backfill user_id=1 for all rows that have null user_id
const docResult = db.update(documents).set({ userId: 1 }).where(isNull(documents.userId)).run();
console.log(`Updated ${docResult.changes} documents with userId=1`);

const profileResult = db.update(profiles).set({ userId: 1 }).where(isNull(profiles.userId)).run();
console.log(`Updated ${profileResult.changes} profiles with userId=1`);

const outreachResult = db.update(outreach).set({ userId: 1 }).where(isNull(outreach.userId)).run();
console.log(`Updated ${outreachResult.changes} outreach rows with userId=1`);

console.log('Backfill complete.');
