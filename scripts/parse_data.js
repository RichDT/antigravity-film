import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const dataDir = path.join(process.cwd(), 'data');
const outputFile = path.join(process.cwd(), 'src', 'data', 'films.json');

// Read all CSV files in the data directory
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv'));

const filmsMap = new Map();

// Helper to normalize film title
const normalizeTitle = (title) => {
    if (!title) return '';
    return title.trim();
};

// 1. First read Films.csv
const filmsCsv = files.find(f => f.includes('Films.csv'));
if (filmsCsv) {
    const records = parse(fs.readFileSync(path.join(dataDir, filmsCsv), 'utf8'), {
        columns: true,
        skip_empty_lines: true
    });
    records.forEach(row => {
        const title = normalizeTitle(row.Film);
        if (title) {
            filmsMap.set(title.toLowerCase(), {
                id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                title: title,
                year: row.Year || '',
                grade: row.Grade || '',
                country: row.Country || '',
                languages: row.Languages || '',
                awards: {
                    nominations: 0,
                    wins: 0,
                    details: []
                }
            });
        }
    });
}

// 2. Parse all other award files
const awardFiles = files.filter(f => !f.includes('Films.csv') && !f.includes('Concordance') && !f.includes('People') && !f.includes('Reference'));

for (const file of awardFiles) {
    const records = parse(fs.readFileSync(path.join(dataDir, file), 'utf8'), {
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true
    });

    const awardName = file.replace('The SpyGlasses Full (2022 Update) - ', '').replace('.csv', '');

    records.forEach(row => {
        const filmTitleRaw = row.Film || row.film || '';
        const title = normalizeTitle(filmTitleRaw).toLowerCase();

        if (!title) return;

        // Try to find the film
        let film = filmsMap.get(title);

        // If not found, maybe we should add it? Or ignore? Let's add it just in case, or ignore if it's not in our main list.
        // Actually for now let's just create it if missing, but mark it.
        if (!film) {
            film = {
                id: title.replace(/[^a-z0-9]+/g, '-'),
                title: filmTitleRaw,
                year: row.Year || '',
                grade: '',
                country: '',
                languages: '',
                awards: {
                    nominations: 0,
                    wins: 0,
                    details: []
                }
            };
            filmsMap.set(title, film);
        }

        // Determine if it was a win
        let isWin = false;
        if (row.Win_Oscar === 'TRUE' || row.Win_Globe === 'TRUE' || row.Won === 'TRUE' || row.Win === 'TRUE') {
            isWin = true;
        } else if (row.Outcome === 'Won') {
            isWin = true;
        } else if (row.Nominated === 'TRUE' && row.Outcome !== 'Won' && row.Won !== 'TRUE') {
            // just a nomination
        }

        // If the 'Win' columns don't exist, try looking at other columns or assume true if it's a specific award type? 
        // Some datasets just list winners. 
        if (awardName === 'AFI' || awardName === 'NBR') {
            // Maybe all are wins.
        }

        film.awards.nominations++;
        if (isWin) {
            film.awards.wins++;
        }

        film.awards.details.push({
            award: awardName,
            category: row.Category || row.Category_Oscar || row.Category_Globes || '',
            won: isWin,
            nominee: row.Nominee || row.Role || row.Character || ''
        });
    });
}

// Convert map to array and compute a final score (e.g. wins * 3 + noms)
const filmsArray = Array.from(filmsMap.values()).map(film => {
    // Score based on grade and awards
    let score = 0;
    if (film.grade.includes('A')) score += 50;
    if (film.grade.includes('B')) score += 30;
    if (film.grade.includes('C')) score += 10;

    score += film.awards.wins * 5;
    score += film.awards.nominations * 1;

    // Optional: sort details by award
    film.awards.details.sort((a, b) => a.award.localeCompare(b.award));

    // Deduplicate details if they are perfectly identical
    const uniqueDetails = [];
    const seen = new Set();
    for (const d of film.awards.details) {
        const key = `${d.award}-${d.category}-${d.nominee}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueDetails.push(d);
        }
    }
    film.awards.details = uniqueDetails;

    return {
        ...film,
        score
    };
});

// Sort primarily by score or year
filmsArray.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break by year
    return parseInt(b.year || '0') - parseInt(a.year || '0');
});

fs.writeFileSync(outputFile, JSON.stringify(filmsArray, null, 2));

console.log(`Parsed ${filmsArray.length} films successfully and wrote to ${outputFile}`);
