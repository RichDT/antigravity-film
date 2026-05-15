/**
 * Test scraper for early BAFTA pages (h3-based format).
 * Dry run: parse the 11th BAFTAs (film year 1957) and print results.
 */

import * as cheerio from 'cheerio';

type Nominee = {
    filmTitle: string | null;
    people: { name: string }[];
    isWinner: boolean;
    role: string | null;
};

type Category = {
    name: string;
    nominations: Nominee[];
};

function cleanText(text: string) {
    return text.replace(/\[\d+\]/g, '').replace(/\[edit\]/g, '').trim();
}

/**
 * Parse an acting-format line like "Henry Fonda in 12 Angry Men"
 * or a film-only line like "The Bridge on the River Kwai"
 * or a screenplay-format line like "The Bridge on the River Kwai - Pierre Boulle"
 */
function parseEntry($: cheerio.CheerioAPI, el: cheerio.Cheerio<cheerio.Element>, categoryName: string): Nominee {
    const catLower = categoryName.toLowerCase();
    const isActing = catLower.includes('actor') || catLower.includes('actress');
    const isScreenplay = catLower.includes('screenplay') || catLower.includes('screenwriter');

    // Extract italic text as film title
    let filmTitle: string | null = null;
    const italics = el.find('i');
    if (italics.length > 0) {
        filmTitle = cleanText(italics.first().text());
    }

    // Remove italic elements and get remaining text
    const clone = el.clone();
    clone.find('i').remove();
    let remainingText = cleanText(clone.text());

    // Remove leading/trailing dashes
    remainingText = remainingText.replace(/^[\s–-]+/, '').replace(/[\s–-]+$/, '').trim();
    // Remove "in " prefix for acting categories
    remainingText = remainingText.replace(/\s+in\s*$/, '').trim();

    const people: { name: string }[] = [];

    if (isActing && remainingText) {
        // For acting: remaining text is the person name
        people.push({ name: remainingText });
    } else if (isScreenplay && remainingText) {
        // For screenplay: remaining text after removing film title might be writer names
        // Format: "Film Title - Writer Name" or "Film Title – Writer Name"
        const parts = remainingText.split(/\s*[-–]\s*/);
        for (const p of parts) {
            const trimmed = p.trim();
            if (trimmed && trimmed !== filmTitle) {
                people.push({ name: trimmed });
            }
        }
    }

    // If no film title found but this is a film category, treat the whole text as film title
    if (!filmTitle && (catLower.includes('film') || catLower.includes('documentary'))) {
        filmTitle = cleanText(el.text());
    }

    return {
        filmTitle,
        people,
        isWinner: false,
        role: null,
    };
}

async function scrapeH3Format(url: string): Promise<Category[]> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    const html = await response.text();
    const $ = cheerio.load(html);
    const categories: Category[] = [];

    // Find all h3 elements (they may be inside .mw-heading3 divs or standalone)
    const headings: cheerio.Cheerio<cheerio.Element>[] = [];
    
    // Try .mw-heading3 > h3 first (newer Wikipedia format)
    $('.mw-heading3').each((_, div) => {
        headings.push($(div));
    });
    
    // If none found, fall back to bare h3
    if (headings.length === 0) {
        $('h3').each((_, h3) => {
            headings.push($(h3));
        });
    }

    for (const heading of headings) {
        const h3El = heading.is('h3') ? heading : heading.find('h3');
        const catName = cleanText(h3El.text());
        if (!catName || ['References', 'External links', 'See also', 'Notes', 'Winners and nominees'].includes(catName)) continue;

        const nominations: Nominee[] = [];

        // Walk siblings after the heading div
        let next = heading.next();
        while (next.length > 0 && !next.hasClass('mw-heading3') && !next.hasClass('mw-heading2') && !next.is('h2') && !next.is('h3')) {
            const tag = next.prop('tagName')?.toUpperCase();

            if (tag === 'P') {
                // Winner paragraph — bold content
                const boldEl = next.find('b');
                if (boldEl.length > 0) {
                    const winner = parseEntry($, boldEl, catName);
                    winner.isWinner = true;
                    nominations.push(winner);
                }
            } else if (tag === 'UL') {
                // Nominee list
                next.children('li').each((_, li) => {
                    const nominee = parseEntry($, $(li), catName);
                    nominations.push(nominee);
                });
            }

            next = next.next();
        }

        if (nominations.length > 0) {
            categories.push({ name: catName, nominations });
        }
    }

    return categories;
}

async function main() {
    const url = 'https://en.wikipedia.org/wiki/11th_British_Academy_Film_Awards';
    console.log(`Scraping: ${url}\n`);
    
    const categories = await scrapeH3Format(url);
    
    for (const cat of categories) {
        console.log(`\n=== ${cat.name} (${cat.nominations.length} nominations) ===`);
        for (const nom of cat.nominations) {
            const status = nom.isWinner ? '🏆' : '  •';
            const film = nom.filmTitle || '(no film)';
            const people = nom.people.length > 0 ? nom.people.map(p => p.name).join(', ') : '';
            if (people) {
                console.log(`  ${status} ${people} — ${film}`);
            } else {
                console.log(`  ${status} ${film}`);
            }
        }
    }
    
    console.log(`\n\nTotal: ${categories.length} categories, ${categories.reduce((s, c) => s + c.nominations.length, 0)} nominations`);
}

main().catch(console.error);
