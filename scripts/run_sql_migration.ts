/**
 * Runs a SQL file against the database.
 * Usage: npx tsx scripts/run_sql_migration.ts <path-to-sql-file>
 */
import { readFileSync } from 'fs';
import { query } from '../lib/db';

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: npx tsx scripts/run_sql_migration.ts <path-to-sql-file>');
  process.exit(1);
}

const sql = readFileSync(sqlFile, 'utf8');

// Strip comments and split on semicolons, skip empty statements
async function main() {
  // Strip single-line comments first, then split on semicolons
  const stripped = sql.replace(/--[^\n]*/g, '');
  const statements = stripped
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    await query(stmt);
    console.log('✓', stmt.slice(0, 60).replace(/\s+/g, ' '), '…');
  }

  console.log('\nMigration complete.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
