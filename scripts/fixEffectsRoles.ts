import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const EXACT_ROLES: Record<string, string> = {
  // Avatar: Fire and Ash
  'Joe Letteri': 'Visual Effects Supervisor',
  'Richard Baneham': 'Visual Effects Supervisor',
  'Eric Saindon': 'Visual Effects Supervisor',
  'Daniel Barrett': 'Animation Supervisor',

  // The Lost Bus
  'Charlie Noble': 'Visual Effects Supervisor',
  'David Zaretti': 'Visual Effects Supervisor',
  'Russell Bowen': 'Visual Effects Supervisor',
  'Brandon K. McLaughlin': 'Special Effects Coordinator',

  // Tron: Ares
  'Cody Gramstad': 'Visual Effects Art Director',

  // Warfare
  'Simon Stanley-Clamp': 'Visual Effects Supervisor',

  // Wicked: For Good
  'David Shirk': 'Animation Supervisor',
  'Pablo Helman': 'Visual Effects Supervisor',
  'Robert Weaver': 'Visual Effects Supervisor'
};

const FILM_TEAMS: Record<string, string[]> = {
  'Avatar: Fire and Ash': ['Joe Letteri', 'Richard Baneham', 'Eric Saindon', 'Daniel Barrett'],
  'The Lost Bus': ['Charlie Noble', 'David Zaretti', 'Russell Bowen', 'Brandon K. McLaughlin'],
  'Tron: Ares': ['Cody Gramstad'],
  'Warfare': ['Simon Stanley-Clamp'],
  'Wicked: For Good': ['David Shirk', 'Pablo Helman', 'Robert Weaver']
};

async function ensurePerson(name: string): Promise<number> {
  const result = await pool.query('SELECT person_id FROM people WHERE name = $1', [name]);
  if (result.rows.length > 0) return result.rows[0].person_id;
  const ins = await pool.query('INSERT INTO people (name) VALUES ($1) RETURNING person_id', [name]);
  return ins.rows[0].person_id;
}

async function ensureRole(roleName: string): Promise<number> {
  const result = await pool.query('SELECT role_id FROM roles WHERE role_name = $1', [roleName]);
  if (result.rows.length > 0) return result.rows[0].role_id;
  const ins = await pool.query('INSERT INTO roles (role_name) VALUES ($1) RETURNING role_id', [roleName]);
  return ins.rows[0].role_id;
}

async function run() {
  const roleCache: Record<string, number> = {};
  for (const roleStr of Object.values(EXACT_ROLES)) {
     if (!roleCache[roleStr]) {
         roleCache[roleStr] = await ensureRole(roleStr);
     }
  }

  const personCache: Record<string, number> = {};
  for (const p of Object.keys(EXACT_ROLES)) {
     personCache[p] = await ensurePerson(p);
  }

  for (const title of Object.keys(FILM_TEAMS)) {
    // Find all nominations in 2025 effects category for this film
    const nomResult = await pool.query(`
      SELECT n.nomination_id
      FROM nominations n
      JOIN films f ON n.film_id = f.film_id
      JOIN categories cat ON n.category_id = cat.category_id
      JOIN ceremonies ce ON n.ceremony_id = ce.ceremony_id
      WHERE f.title = $1
        AND (cat.name ILIKE '%Effects%')
        AND ce.year = 2025
    `, [title]);

    const validPersonIds = FILM_TEAMS[title].map(name => personCache[name]);

    for (const nom of nomResult.rows) {
       for (const name of FILM_TEAMS[title]) {
           const pId = personCache[name];
           const rId = roleCache[EXACT_ROLES[name]];

           const check = await pool.query('SELECT nomination_person_id FROM nomination_people WHERE nomination_id = $1 AND person_id = $2', [nom.nomination_id, pId]);
           if (check.rows.length > 0) {
             await pool.query('UPDATE nomination_people SET role_id = $1 WHERE nomination_person_id = $2', [rId, check.rows[0].nomination_person_id]);
           } else {
             await pool.query('INSERT INTO nomination_people (nomination_id, person_id, role_id) VALUES ($1, $2, $3)', [nom.nomination_id, pId, rId]);
           }
       }
       
       // Clean up stale or partial entries from earlier data
       await pool.query(`
          DELETE FROM nomination_people 
          WHERE nomination_id = $1 
            AND person_id NOT IN (${validPersonIds.join(',')})
       `, [nom.nomination_id]);
    }
    
    console.log(`Updated robust specific VFX granular roles for ${title}.`);
  }

  await pool.end();
}

run().catch(console.error);
