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
    const resp = await fetch(url, { headers: { 'User-Agent': 'OscarScan/1.0' } });
    if (!resp.ok) return null;
    const json = await resp.json() as any;
    const pages = json?.query?.pages ?? {};
    const page = Object.values(pages)[0] as any;
    if (page?.missing !== undefined) return null;
    return page?.revisions?.[0]?.slots?.main?.['*'] ?? null;
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
    const allDisplayNames = new Set<string>();
    
    // Sample ceremonies across the full range
    const toCheck = [77, 74, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 7, 5, 3, 2, 1];
    
    for (const n of toCheck) {
        await sleep(400);
        const wt = await fetchWikitext(n);
        if (!wt) { console.log(`${n}: NOT FOUND`); continue; }
        
        // Extract all Award category display names
        const re1 = /\{\{Award category\|[^|]+\|\[\[[^\]|]+\|([^\]]+)\]\]\}\}/g;
        const re2 = /\{\{Award category\|[^|]+\|\[\[([^\]|]+)\]\]\}\}/g;
        
        const names: string[] = [];
        let m;
        while ((m = re1.exec(wt)) !== null) names.push(m[1].trim());
        while ((m = re2.exec(wt)) !== null) {
            const raw = m[1].replace(/\s*\([^)]+\)\s*$/, '').trim();
            names.push(raw);
        }
        
        if (names.length > 0) {
            for (const n2 of names) allDisplayNames.add(n2);
            console.log(`${ordinal(n)}: [${names.join(' | ')}]`);
        } else {
            // Try section headers
            const shRe = /\n={2,4}([^=\n]+)={2,4}/g;
            const headers: string[] = [];
            while ((m = shRe.exec(wt)) !== null) headers.push(m[1].trim());
            console.log(`${ordinal(n)} (sections): [${headers.slice(0,15).join(' | ')}]`);
        }
    }
    
    console.log('\n=== ALL UNIQUE DISPLAY NAMES ===');
    for (const n of [...allDisplayNames].sort()) console.log(' ', n);
}

main().catch(console.error);
