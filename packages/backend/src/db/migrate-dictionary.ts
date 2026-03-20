import { db } from './index.js';
import { users, userDictionary, companies, documents } from './schema.js';
import { eq } from 'drizzle-orm';
import { hydrateUserDictionary, loadSeedCompanies } from './bootstrap.js';
import { extractProfileData } from '../documents/extractor.js';

/**
 * One-time migration for existing databases.
 * Runs on startup if users exist but user_dictionary is empty.
 */
export function runExistingDbMigration(): void {
  const allUsers = db.select().from(users).all();
  if (allUsers.length === 0) return; // Fresh install — bootstrap wizard handles this

  const dictRows = db.select().from(userDictionary).all();
  if (dictRows.length > 0) return; // Already migrated

  console.log('[migration] Existing DB detected — running one-time dictionary backfill...');

  for (const user of allUsers) {
    // Default archetype for existing PM/TPM user
    const termCount = hydrateUserDictionary(user.id, 'pm-tpm');
    console.log(`[migration] Loaded ${termCount} template terms for user ${user.name} (id=${user.id})`);

    // Re-extract terms from existing uploaded documents
    const docs = db.select().from(documents).where(eq(documents.userId, user.id)).all();
    for (const doc of docs) {
      if (!doc.rawText) continue;
      const extracted = extractProfileData(doc.rawText); // No userId — uses template fallback
      const categories = [
        { cat: 'technical', terms: extracted.skills },
        { cat: 'certifications', terms: extracted.certs },
        { cat: 'tools', terms: extracted.tools },
      ];
      for (const { cat, terms } of categories) {
        for (const term of terms) {
          db.insert(userDictionary).values({
            userId: user.id, category: cat, term, source: 'resume',
          }).onConflictDoNothing().run();
        }
      }
    }
    console.log(`[migration] Re-extracted resume terms for user ${user.name}`);
  }

  // Load seed companies if no 'seed' source companies exist
  const seedCompanies = db.select().from(companies).where(eq(companies.source, 'seed')).all();
  if (seedCompanies.length === 0) {
    const inserted = loadSeedCompanies();
    console.log(`[migration] Loaded ${inserted} seed companies`);
  }

  console.log('[migration] One-time migration complete');
}
