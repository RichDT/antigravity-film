import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

function ordinal(n: number): string {
    const mod100 = n % 100;
    const suffix = (mod100 >= 11 && mod100 <= 13) ? 'th' :
        n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
    return `${n}${suffix}`;
}

async function fetchWikitext(ceremony: number): Promise<string | null> {
    const title = `${ordinal(ceremony)}_Academy_Awards`;
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&redirects=1&titles=${encodeURIComponent(title)}`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'OscarTest/1.0' } });
    const json = await resp.json() as any;
    const pages = json?.query?.pages ?? {};
    const page = Object.values(pages)[0] as any;
    return page?.revisions?.[0]?.slots?.main?.['*'] ?? null;
}

async function show(ceremony: number) {
    const wt = await fetchWikitext(ceremony);
    if (!wt) { console.log(`${ordinal(ceremony)}: NOT FOUND`); return; }
    console.log(`\n${'='.repeat(60)}\n${ordinal(ceremony)} Academy Awards\n${'='.repeat(60)}`);
    
    // Find where Award category templates start
    const awardCatIdx = wt.indexOf('{{Award category');
    if (awardCatIdx !== -1) {
        console.log('Has {{Award category}} at pos', awardCatIdx);
        console.log(wt.substring(awardCatIdx, awardCatIdx + 500));
    } else {
        console.log('NO {{Award category}} template found');
        // Show first content section
        const firstSection = wt.indexOf('\n==');
        console.log(wt.substring(firstSection, firstSection + 1500));
    }
}

async function main() {
    // Check the ceremonies without Award category and some edge cases
    await show(70);
    await new Promise(r => setTimeout(r, 400));
    await show(2);
    await new Promise(r => setTimeout(r, 400));
    await show(1);
}
main().catch(console.error);
