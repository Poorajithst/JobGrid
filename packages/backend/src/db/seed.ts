import 'dotenv/config';
import { db } from './index.js';
import { createQueries } from './queries.js';

const queries = createQueries(db);

const companies = [
  { name: 'MathWorks', greenhouseSlug: 'mathworks' },
  { name: 'Infosys BPM', greenhouseSlug: 'infosysbpm' },
  { name: 'Abiomed', greenhouseSlug: 'abiomed' },
  { name: 'HubSpot', greenhouseSlug: 'hubspot' },
  { name: 'Wayfair', greenhouseSlug: 'wayfair' },
  { name: 'Toast', greenhouseSlug: 'toast' },
  { name: 'Klaviyo', greenhouseSlug: 'klaviyo' },
  { name: 'Rapid7', greenhouseSlug: 'rapid7' },
  { name: 'Moderna', greenhouseSlug: 'moderna' },
  { name: 'Vanderhoof & Assoc', leverSlug: 'vanderhoof' },
  { name: 'Datto', greenhouseSlug: 'datto' },
  { name: 'Allegro MicroSystems', greenhouseSlug: 'allegromicrosystems' },
  { name: 'Insulet Corporation', greenhouseSlug: 'insulet' },
];

let inserted = 0;
for (const c of companies) {
  queries.insertCompany(c);
  inserted++;
}

console.log(`Seeded ${inserted} companies.`);
