import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const text = fs.readFileSync('/tmp/98th_oscars_wiki.txt', 'utf8');
  
  const lines = text.split('\n');
  
  let currentCategory = '';
  const catRegex = /\{\{Award category\|[^\|]+\|\[\[([^\|]+)\|([^\]]+)\]\]\}\}/;
  const catRegex2 = /\{\{Award category\|[^\|]+\|\[\[([^\]]+)\]\]\}\}/;

  const winnersToUpdate: {category: string, nomineeName: string}[] = [];

  for (const line of lines) {
    let m = line.match(catRegex) || line.match(catRegex2);
    if (m) {
      currentCategory = m[1].replace('Academy Award for ', '');
    } else if (line.includes('‡') && currentCategory) {
      let cleaned = line;
      cleaned = cleaned.replace(/<ref[^>]*>.*?<\/ref>/g, '');
      cleaned = cleaned.replace(/<ref[^>]*\/>/g, '');
      
      let titleMatch = cleaned.match(/\*.*?\[\[([^\|\]]+)\|?([^\]]*)\]\]/);
      
      if (titleMatch) {
         winnersToUpdate.push({
           category: currentCategory,
           nomineeName: titleMatch[1]
         });
      }
    }
  }

  // Pre-clean out existing winners for this ceremony
  await pool.query(`UPDATE nominations SET win = false WHERE ceremony_id = 121`);
  console.log('Reset wins to false.');

  const allNoms = await pool.query(`
    SELECT n.nomination_id, f.title as film_title, c.name as category_name, p.name as person_name
    FROM nominations n
    JOIN films f ON n.film_id = f.film_id
    JOIN categories c ON n.category_id = c.category_id
    LEFT JOIN nomination_people np ON n.nomination_id = np.nomination_id
    LEFT JOIN people p ON np.person_id = p.person_id
    WHERE n.ceremony_id = 121
  `);

  let updatedCount = 0;

  for (const winner of winnersToUpdate) {
    // Exact mapping of Wikipedia categories to DB categories
    let dbCategoryMatch = winner.category;
    if (winner.category === 'Best Picture') dbCategoryMatch = 'Best Picture';
    else if (winner.category === 'Best Director') dbCategoryMatch = 'Directing';
    else if (winner.category === 'Best Actor') dbCategoryMatch = 'Actor in a Leading Role';
    else if (winner.category === 'Best Actress') dbCategoryMatch = 'Actress in a Leading Role';
    else if (winner.category === 'Best Supporting Actor') dbCategoryMatch = 'Actor in a Supporting Role';
    else if (winner.category === 'Best Supporting Actress') dbCategoryMatch = 'Actress in a Supporting Role';
    else if (winner.category === 'Best Original Screenplay') dbCategoryMatch = 'Writing (Original Screenplay)';
    else if (winner.category === 'Best Adapted Screenplay') dbCategoryMatch = 'Writing (Adapted Screenplay)';
    else if (winner.category === 'Best Animated Feature') dbCategoryMatch = 'Animated Feature Film';
    else if (winner.category === 'Best International Feature Film') dbCategoryMatch = 'International Feature Film';
    else if (winner.category === 'Best Documentary Feature Film') dbCategoryMatch = 'Documentary Feature Film';
    else if (winner.category === 'Best Documentary Short Film') dbCategoryMatch = 'Documentary Short Film';
    else if (winner.category === 'Best Live Action Short Film') dbCategoryMatch = 'Live Action Short Film';
    else if (winner.category === 'Best Animated Short Film') dbCategoryMatch = 'Animated Short Film';
    else if (winner.category === 'Best Original Score') dbCategoryMatch = 'Music (Original Score)';
    else if (winner.category === 'Best Original Song') dbCategoryMatch = 'Music (Original Song)';
    else if (winner.category === 'Best Sound') dbCategoryMatch = 'Sound';
    else if (winner.category === 'Achievement in Casting') dbCategoryMatch = 'Casting'; 
    else if (winner.category === 'Best Production Design') dbCategoryMatch = 'Production Design';
    else if (winner.category === 'Best Cinematography') dbCategoryMatch = 'Cinematography';
    else if (winner.category === 'Best Makeup and Hairstyling') dbCategoryMatch = 'Makeup and Hairstyling';
    else if (winner.category === 'Best Costume Design') dbCategoryMatch = 'Costume Design';
    else if (winner.category === 'Best Film Editing') dbCategoryMatch = 'Editing';
    else if (winner.category === 'Best Visual Effects') dbCategoryMatch = 'Visual Effects';

    let textMatch = winner.nomineeName.toLowerCase();
    
    // clean text rules
    if (textMatch.includes(' (')) textMatch = textMatch.split(' (')[0];
    textMatch = textMatch.replace('mr nobody against putin', 'mr. nobody against putin');
    textMatch = textMatch.replace(' (2025 film)', '').replace(' (film)', '');

    const matches = allNoms.rows.filter(r => {
      // Must exactly match DB category (or fuzzily if minor difference)
      const catMatch = r.category_name.toLowerCase() === dbCategoryMatch.toLowerCase();
      
      const personMatch = r.person_name && r.person_name.toLowerCase() === textMatch;
      const filmMatch = r.film_title && r.film_title.toLowerCase() === textMatch;

      // special rule for Best Original Song where Wikipedia matched the song title but DB wants the Film
      if (winner.category.includes('Original Song') && textMatch.includes('golden')) {
         return catMatch && r.film_title === 'KPop Demon Hunters';
      }

      return catMatch && (filmMatch || personMatch);
    });
    
    if (matches.length > 0) {
       console.log(`✅ Matched: ${winner.category} -> ${winner.nomineeName} (${matches.length} rows updated)`);
       for (const m of matches) {
          await pool.query(`UPDATE nominations SET win = true WHERE nomination_id = $1`, [m.nomination_id]);
          updatedCount++;
       }
    } else {
       console.log(`❌ Failed:  ${winner.category} -> ${winner.nomineeName} (clean text: ${textMatch}) for cat ${dbCategoryMatch}`);
    }
  }

  console.log('Total updated rows:', updatedCount);
  await pool.end();
}

run().catch(console.error);
