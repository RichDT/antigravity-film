import * as cheerio from 'cheerio';
import fs from 'fs';

type Nominee = {
    filmTitle: string | null;
    filmUrl: string | null;
    people: { name: string, url: string | null }[];
    isWinner: boolean;
    role: string | null; // e.g. "as Ray Charles"
};

type Category = {
    name: string;
    nominations: Nominee[];
};

function cleanText(text: string) {
    return text.replace(/\[\d+\]/g, '').trim();
}

function parseLi($: cheerio.CheerioAPI, li: cheerio.Element, isWinner: boolean, categoryName: string): Nominee {
    const $clone = $(li).clone();
    $clone.find('ul').remove(); // remove nested

    let filmTitle: string | null = null;
    let filmUrl: string | null = null;
    let people: { name: string, url: string | null }[] = [];
    let role: string | null = null;

    // 1. Extract Films (they are usually inside <i> tags)
    $clone.find('i').each((_, iElem) => {
        const text = cleanText($(iElem).text());
        if (text) {
            filmTitle = text;
            const a = $(iElem).find('a');
            if (a.length > 0) {
                filmUrl = a.attr('href') || null;
            } else if ($(iElem).parent().is('a')) {
                 filmUrl = $(iElem).parent().attr('href') || null;
            }
        }
    });

    // Remove the <i> tag so we don't parse it as a person
    $clone.find('i').remove();

    // Now extract the remaining text/links as people or role
    // The text might be like: "Jamie Foxx –  as Ray Charles" or "Michael Mann, Sandy Climan and Graham King"
    let remainingText = cleanText($clone.text());

    // Extract role (usually follows " as ")
    const asMatch = remainingText.match(/\s+as\s+(.+)$/);
    if (asMatch) {
        role = cleanText(asMatch[1]);
        remainingText = remainingText.replace(asMatch[0], '');
    }

    // Clean up dashes
    remainingText = remainingText.replace(/^[–-]\s*/, '').replace(/\s*[–-]\s*$/, '').trim();

    // Extract people
    // They are often linked
    const linkedPeople: {name: string, url: string | null}[] = [];
    $clone.find('a').each((_, aElem) => {
        // If it's not the film url
        if ($(aElem).attr('href') !== filmUrl) {
            linkedPeople.push({
                name: cleanText($(aElem).text()),
                url: $(aElem).attr('href') || null
            });
            remainingText = remainingText.replace($(aElem).text(), '').trim();
        }
    });

    // If there are no links but there is remaining text, it might be unlinked people
    if (linkedPeople.length > 0) {
        people = linkedPeople;
    } else {
         // remaining text might be comma/and separated people
         if (remainingText.length > 0 && remainingText !== '–' && remainingText !== '-') {
             // Basic split by comma or 'and'
             let parts = remainingText.split(/,(?![^()]*\))|\s+and\s+/);
             people = parts.map(p => p.trim()).filter(p => p.length > 0).map(p => ({
                 name: cleanText(p),
                 url: null
             }));
         }
    }

    // Heuristic fallbacks for tricky cases where <i> is missing
    if (!filmTitle && categoryName.toLowerCase().includes('film') && people.length === 1 && !people[0].url) {
        // Best Film, but no italics
        filmTitle = people[0].name;
        people = [];
    }

    return {
        filmTitle,
        filmUrl,
        people,
        isWinner,
        role
    };
}

async function run() {
  const url = 'https://en.wikipedia.org/wiki/58th_British_Academy_Film_Awards';
  console.log('Fetching', url);
  const response = await fetch(url);
  const html = await response.text();
  
  const $ = cheerio.load(html);
  
  const categories: Category[] = [];
  
  // 1. Special Awards (H3 followed by UL)
  $('h3').each((_, h3) => {
      const catName = cleanText($(h3).text()).replace('[edit]', '').trim();
      // Check if it's an award (like BAFTA Fellowship)
      if (catName.includes('Fellowship') || catName.includes('Contribution')) {
          const ul = $(h3).nextAll('ul').first();
          if (ul.length > 0) {
              const noms: Nominee[] = [];
              ul.children('li').each((_, li) => {
                  noms.push(parseLi($, li, true, catName));
              });
              if (noms.length > 0) {
                 categories.push({ name: catName, nominations: noms });
              }
          }
      }
  });

  // 2. Main Awards (Wikitables)
  $('table.wikitable').each((i, table) => {
    $(table).find('tr').each((j, row) => {
      $(row).find('td').each((k, cell) => {
        let catName = $(cell).find('div > b').text().trim() || $(cell).find('b').first().text().trim();
        if (!catName) {
            catName = $(cell).contents().filter(function() {
                return this.nodeType === 3 && $(this).text().trim().length > 0;
            }).first().text().trim();
        }
        
        const noms: Nominee[] = [];
        $(cell).children('ul').first().children('li').each((l, li) => {
           const isWinner = $(li).find('b').length > 0;
           
           noms.push(parseLi($, li, isWinner, catName));
           
           // Nested nominees
           $(li).find('ul > li').each((m, nestedLi) => {
               noms.push(parseLi($, nestedLi, false, catName));
           });
        });
        
        if (noms.length > 0 && catName) {
            categories.push({
                name: catName,
                nominations: noms
            });
        }
      });
    });
  });
  
  fs.writeFileSync('scripts/pilot_bafta.json', JSON.stringify(categories, null, 2));
  console.log(`Saved ${categories.length} categories to scripts/pilot_bafta.json`);
}

run().catch(console.error);
