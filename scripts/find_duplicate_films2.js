import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

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
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function normalize(s) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function findDuplicates() {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();

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

                const t1 = f1.title;
                const t2 = f2.title;
                const n1 = normalize(t1);
                const n2 = normalize(t2);

                if (n1 === n2) {
                    possibleDuplicates.push({ year, f1, f2, reason: 'Exact match (ignoring punctuation/case)' });
                    continue;
                }

                // Parentheses check: "Mar adentro (The Sea Inside)" vs "The Sea Inside"
                if (t1.includes(t2) && t1.includes('(') && t1.includes(')')) {
                    possibleDuplicates.push({ year, f1, f2, reason: 'Parentheses translated match' });
                    continue;
                }
                if (t2.includes(t1) && t2.includes('(') && t2.includes(')')) {
                    possibleDuplicates.push({ year, f1, f2, reason: 'Parentheses translated match' });
                    continue;
                }

                if (n1.length > 5 && n2.length > 5) {
                    const dist = levenshteinDistance(n1, n2);
                    if (dist <= 2) {
                        possibleDuplicates.push({ year, f1, f2, reason: `Levenshtein distance ${dist}` });
                        continue;
                    }
                }
            }
        }
    }

    // Filter out same pairs
    const uniquePairs = [];
    const seen = new Set();
    for (const p of possibleDuplicates) {
        const key = p.f1.id < p.f2.id ? `${p.f1.id}-${p.f2.id}` : `${p.f2.id}-${p.f1.id}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniquePairs.push(p);
        }
    }

    fs.mkdirSync('/Users/richtruncellito/.gemini/antigravity/brain/d5ac39f9-c58d-4ea7-99fb-ae3d8f201e6f/scratch', { recursive: true });
    fs.writeFileSync('/Users/richtruncellito/.gemini/antigravity/brain/d5ac39f9-c58d-4ea7-99fb-ae3d8f201e6f/scratch/duplicates.json', JSON.stringify(uniquePairs, null, 2));

    console.log(`Saved ${uniquePairs.length} high-confidence duplicate pairs to scratch/duplicates.json`);

    await client.end();
}

findDuplicates();
