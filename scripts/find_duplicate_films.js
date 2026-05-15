import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

// Simple Levenshtein distance
function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(matrix[i][j - 1] + 1, // insertion
                             matrix[i - 1][j] + 1) // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

async function findDuplicates() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();

    // Get all films and the years they have nominations in
    const res = await client.query(`
        SELECT DISTINCT f.film_id, f.title, c.year
        FROM films f
        JOIN nominations n ON f.film_id = n.film_id
        JOIN ceremonies c ON n.ceremony_id = c.ceremony_id
    `);

    const filmsByYear = new Map();
    for (const r of res.rows) {
        if (!filmsByYear.has(r.year)) filmsByYear.set(r.year, []);
        filmsByYear.get(r.year).push({ id: r.film_id, title: r.title });
    }

    const possibleDuplicates = [];

    for (const [year, films] of filmsByYear.entries()) {
        for (let i = 0; i < films.length; i++) {
            for (let j = i + 1; j < films.length; j++) {
                const f1 = films[i];
                const f2 = films[j];

                const t1 = f1.title.toLowerCase();
                const t2 = f2.title.toLowerCase();

                // Check 1: Substring (one contains the other)
                // Need to be careful with short titles, require at least 5 chars
                const isSubstr = (t1.includes(t2) && t2.length > 5) || (t2.includes(t1) && t1.length > 5);

                // Check 2: Levenshtein distance <= 4 (for typos)
                const dist = levenshteinDistance(t1, t2);
                const isTypo = dist <= 4 && t1.length > 4 && t2.length > 4;

                if (isSubstr || isTypo) {
                    // Prevent duplicates if multiple years have the same film pair
                    const pairKey = f1.id < f2.id ? `${f1.id}-${f2.id}` : `${f2.id}-${f1.id}`;
                    if (!possibleDuplicates.some(p => p.key === pairKey)) {
                        possibleDuplicates.push({
                            key: pairKey,
                            year: year,
                            f1: f1,
                            f2: f2,
                            reason: isSubstr ? 'Substring match' : `Levenshtein distance ${dist}`
                        });
                    }
                }
            }
        }
    }

    console.log("Found", possibleDuplicates.length, "possible duplicates:");
    for (const p of possibleDuplicates) {
        console.log(`Year ${p.year}: [${p.f1.id}] "${p.f1.title}" <==> [${p.f2.id}] "${p.f2.title}" (${p.reason})`);
    }

    await client.end();
}

findDuplicates();
