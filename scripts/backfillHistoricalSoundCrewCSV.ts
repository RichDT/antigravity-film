import { Pool } from 'pg';
import dotenv from 'dotenv';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import path from 'path';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  idleTimeoutMillis: 0,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Keepalive ping every 30s to prevent Supabase connection timeout
const keepaliveInterval = setInterval(async () => {
  try { await pool.query('SELECT 1'); } catch {}
}, 30000);

// ── Caches ──────────────────────────────────────────────────────────────
const filmCache = new Map<string, number>();       // lowercase title → film_id
const personCache = new Map<string, number>();      // name → person_id
const roleCache = new Map<string, number>();        // lowercase role_name → role_id
const nomCache = new Map<string, number>();         // "orgShort|film_id|year" → nomination_id

async function loadCaches() {
  console.log('Loading caches...');

  // Films
  const films = await pool.query('SELECT film_id, title FROM films');
  for (const f of films.rows) {
    filmCache.set(f.title.toLowerCase(), f.film_id);
  }
  console.log(`  Films: ${filmCache.size}`);

  // People
  const people = await pool.query('SELECT person_id, name FROM people');
  for (const p of people.rows) {
    personCache.set(p.name, p.person_id);
  }
  console.log(`  People: ${personCache.size}`);

  // Roles
  const roles = await pool.query('SELECT role_id, role_name FROM roles');
  for (const r of roles.rows) {
    roleCache.set(r.role_name.toLowerCase(), r.role_id);
  }
  console.log(`  Roles: ${roleCache.size}`);

  // Nominations for CAS and MPSE
  const noms = await pool.query(`
    SELECT n.nomination_id, n.film_id, ce.year, o.short_name
    FROM nominations n
    JOIN ceremonies ce ON n.ceremony_id = ce.ceremony_id
    JOIN awards a ON ce.award_id = a.award_id
    JOIN organizations o ON a.organization_id = o.organization_id
    WHERE o.short_name IN ('CAS', 'MPSE')
  `);
  for (const n of noms.rows) {
    const key = `${n.short_name}|${n.film_id}|${n.year}`;
    nomCache.set(key, n.nomination_id);
  }
  console.log(`  Guild nominations: ${nomCache.size}`);
  console.log('Caches loaded.\n');
}

// ── Helpers ─────────────────────────────────────────────────────────────
function findFilmId(title: string): number | null {
  const lower = title.toLowerCase();
  // Exact match first
  if (filmCache.has(lower)) return filmCache.get(lower)!;
  // Try without common prefixes/suffixes
  for (const [k, v] of filmCache) {
    if (k === lower || k.includes(lower) || lower.includes(k)) return v;
  }
  return null;
}

async function ensurePerson(name: string): Promise<number | null> {
  const clean = name.replace(/:/g, '').trim();
  if (!clean || clean.length < 2) return null;
  if (personCache.has(clean)) return personCache.get(clean)!;
  const ins = await pool.query('INSERT INTO people (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING person_id', [clean]);
  if (ins.rows.length > 0) {
    personCache.set(clean, ins.rows[0].person_id);
    return ins.rows[0].person_id;
  }
  // If conflict, fetch existing
  const existing = await pool.query('SELECT person_id FROM people WHERE name = $1', [clean]);
  if (existing.rows.length > 0) {
    personCache.set(clean, existing.rows[0].person_id);
    return existing.rows[0].person_id;
  }
  return null;
}

async function ensureRole(roleName: string): Promise<number | null> {
  let clean = roleName.replace(/:/g, '').replace(/;/g, '').trim();
  if (!clean) return null;
  // Title case
  clean = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  const lower = clean.toLowerCase();
  if (roleCache.has(lower)) return roleCache.get(lower)!;
  const ins = await pool.query('INSERT INTO roles (role_name) VALUES ($1) RETURNING role_id', [clean]);
  roleCache.set(lower, ins.rows[0].role_id);
  return ins.rows[0].role_id;
}

// ── Main CSV processor ─────────────────────────────────────────────────
interface ParsedRecord {
  year: number;
  film: string;
  nominee: string;
  role: string | null;
}

function parseCasCsv(csvPath: string): ParsedRecord[] {
  // CAS columns: Year, Category, Film, Nominee, Role, Won, Concordance
  const content = fs.readFileSync(path.resolve(csvPath), 'utf-8');
  const rows = parse(content, { columns: true, skip_empty_lines: true });
  return rows.map((r: any) => ({
    year: parseInt(r.Year),
    film: (r.Film || '').trim(),
    nominee: (r.Nominee || '').trim(),
    role: (r.Role || '').trim() || null,
  })).filter((r: ParsedRecord) => r.nominee && r.film && !isNaN(r.year));
}

function parseMpseCsv(csvPath: string): ParsedRecord[] {
  // MPSE columns: Year, Category, Film, Won, Nominee, Role, Supervising, Concordance, Country
  const content = fs.readFileSync(path.resolve(csvPath), 'utf-8');
  const rows = parse(content, { columns: true, skip_empty_lines: true });
  return rows.map((r: any) => ({
    year: parseInt(r.Year),
    film: (r.Film || '').trim(),
    nominee: (r.Nominee || '').trim(),
    role: (r.Role || '').trim() || null,
  })).filter((r: ParsedRecord) => r.nominee && r.film && !isNaN(r.year));
}

async function processRecords(records: ParsedRecord[], orgShortName: string, startFrom = 0) {
  let processed = 0;
  let matched = 0;
  let skippedFilm = 0;
  let skippedNom = 0;

  for (const rec of records) {
    processed++;
    if (processed <= startFrom) continue; // Skip already-processed records
    if (processed % 100 === 0) {
      console.log(`  [${orgShortName}] ${processed}/${records.length} processed (${matched} matched, ${skippedFilm} no film, ${skippedNom} no nomination)`);
    }

    const filmId = findFilmId(rec.film);
    if (filmId === null) {
      skippedFilm++;
      continue;
    }

    const nomKey = `${orgShortName}|${filmId}|${rec.year}`;
    const nomId = nomCache.get(nomKey);
    if (!nomId) {
      skippedNom++;
      continue;
    }

    const pId = await ensurePerson(rec.nominee);
    if (pId === null) continue;

    let rId: number | null = null;
    if (rec.role) rId = await ensureRole(rec.role);

    // Upsert: check if this person is already linked to this nomination
    const existing = await pool.query(
      'SELECT nomination_person_id FROM nomination_people WHERE nomination_id = $1 AND person_id = $2',
      [nomId, pId]
    );
    if (existing.rows.length === 0) {
      await pool.query(
        'INSERT INTO nomination_people (nomination_id, person_id, role_id) VALUES ($1, $2, $3)',
        [nomId, pId, rId]
      );
    } else if (rId !== null) {
      await pool.query(
        'UPDATE nomination_people SET role_id = $1 WHERE nomination_person_id = $2',
        [rId, existing.rows[0].nomination_person_id]
      );
    }
    matched++;
  }

  console.log(`  [${orgShortName}] DONE: ${processed} processed, ${matched} matched, ${skippedFilm} no film, ${skippedNom} no nomination\n`);
}

// ── Sync guild data → Rich Picks ───────────────────────────────────────
async function syncRp(categoryLike: string, orgShortName: string) {
  console.log(`Syncing ${categoryLike} from ${orgShortName} to Rich Picks...`);

  const rpNoms = await pool.query(`
    SELECT n.nomination_id, n.film_id, ce.year
    FROM nominations n
    JOIN ceremonies ce ON n.ceremony_id = ce.ceremony_id
    JOIN awards a ON ce.award_id = a.award_id
    JOIN organizations o ON a.organization_id = o.organization_id
    JOIN categories cat ON cat.category_id = n.category_id
    WHERE o.short_name = 'Rich Picks' AND cat.name ILIKE $1
  `, [`%${categoryLike}%`]);

  let synced = 0;
  let noMatch = 0;

  for (const rp of rpNoms.rows) {
    const guildKey = `${orgShortName}|${rp.film_id}|${rp.year}`;
    const guildNomId = nomCache.get(guildKey);

    if (!guildNomId) {
      noMatch++;
      continue;
    }

    const peopleRes = await pool.query(`
      SELECT np.person_id, np.role_id
      FROM nomination_people np
      WHERE np.nomination_id = $1
    `, [guildNomId]);

    if (peopleRes.rows.length > 0) {
      // Clear existing RP crew and replace with guild data
      await pool.query('DELETE FROM nomination_people WHERE nomination_id = $1', [rp.nomination_id]);
      for (const row of peopleRes.rows) {
        await pool.query(
          'INSERT INTO nomination_people (nomination_id, person_id, role_id) VALUES ($1, $2, $3)',
          [rp.nomination_id, row.person_id, row.role_id]
        );
      }
      synced++;
    }
  }

  console.log(`  ${categoryLike}: ${synced} RP nominations synced, ${noMatch} had no guild match\n`);
}

// ── Main ────────────────────────────────────────────────────────────────
async function run() {
  console.log('=== CSV Sound Crew Backfill (RESUME) ===\n');

  await loadCaches();

  // CAS already fully completed (1007/1013 matched) — skipping
  console.log('Phase 1: CAS already complete, skipping.\n');

  console.log('Phase 2: Import MPSE data from CSV (resuming from record 3300)...');
  const mpseRecords = parseMpseCsv('data/The SpyGlasses Full (2022 Update) - MPSE.csv');
  console.log(`  Parsed ${mpseRecords.length} MPSE records from CSV`);
  await processRecords(mpseRecords, 'MPSE', 3300);

  console.log('Phase 3: Sync to Rich Picks...');
  await syncRp('Sound Mixing', 'CAS');
  await syncRp('Sound Editing', 'MPSE');

  clearInterval(keepaliveInterval);
  console.log('=== Script Complete! ===');
  await pool.end();
}

run().catch(console.error);
