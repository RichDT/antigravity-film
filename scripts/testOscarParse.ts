import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.migration') });

// Copy the key functions from importOscarsAllYears for testing
function ordinal(n: number): string {
    const mod100 = n % 100;
    const suffix = (mod100 >= 11 && mod100 <= 13) ? 'th' :
        n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
    return `${n}${suffix}`;
}

async function fetchWikitext(ceremony: number): Promise<string | null> {
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&redirects=1&titles=${encodeURIComponent(ordinal(ceremony)+'_Academy_Awards')}`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'OscarTest/1.0' } });
    if (!resp.ok) return null;
    const json = await resp.json() as any;
    const pages = json?.query?.pages ?? {};
    const page = Object.values(pages)[0] as any;
    if (!page || page.missing !== undefined) return null;
    return page?.revisions?.[0]?.slots?.main?.['*'] ?? null;
}

function stripRefs(s: string): string {
    return s.replace(/<ref\b[^>]*\/>/gi,'').replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi,'');
}
function stripWikiLinks(s: string): string {
    return s.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g,(_,_t,d)=>d)
        .replace(/\[\[([^\]]+)\]\]/g,(_,t)=>t.replace(/\s*\([^)]+\)\s*$/,'').trim());
}
function stripMarkup(s: string): string {
    return s.replace(/'{2,3}/g,'').replace(/\{\{[^}]*\}\}/g,'').replace(/<[^>]+>/g,'')
        .replace(/&ndash;/g,'–').replace(/&mdash;/g,'—').replace(/&amp;/g,'&')
        .replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').trim();
}
function cleanText(s: string): string { return stripMarkup(stripWikiLinks(stripRefs(s))).trim(); }

function cleanPersonName(name: string): string {
    return name.replace(/,?\s*\(.*?\)\s*$/,'').replace(/,?\s+(?:producer|director|screenplay|writer|composer)s?\s*$/i,'').replace(/\s+for\s+.+$/i,'').trim();
}

function splitPeople(raw: string): string[] {
    return raw.split(/[,;]\s*(?:and\s+)?|\s+and\s+/i).map(s=>cleanPersonName(s.trim())).filter(s=>s.length>1&&s.length<80&&!/^\d{4}$/.test(s));
}

function isPersonPrimaryCategory(catName: string): boolean {
    return /actor|actress|directing|director|writing|screenplay/i.test(catName);
}

function isSongCategory(catName: string): boolean {
    return /original song|best song/i.test(catName);
}

function parseLine(rawLine: string, catName: string): { film: string; people: string[]; songTitle?: string } | null {
    const t = cleanText(rawLine.replace(/^[*#:;\s]+/,'')).trim();
    if (!t || t.length<2) return null;
    const isSong = isSongCategory(catName);
    const isPersonPri = isPersonPrimaryCategory(catName);
    if (isSong) {
        const sq = t.match(/^[""""](.+?)[""""]\s+(?:from\s+)?(.+?)(?:\s*[-–—]\s*(.+))?$/i);
        if (sq) {
            const songTitle = sq[1].trim();
            const filmRaw = sq[2].replace(/\s*[-–—]\s*.+$/,'').trim();
            const film = filmRaw.replace(/\s*\([^)]{1,30}\)\s*$/,'').trim();
            const people = sq[3] ? splitPeople(sq[3]) : [];
            if (!film) return null;
            return { film, people, songTitle };
        }
    }
    const dm = t.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    if (dm) {
        const left=dm[1].trim(), right=dm[2].trim();
        if (isPersonPri) {
            const film = right.replace(/\s+as\s+.+$/i,'').replace(/\s*\([^)]{1,30}\)\s*$/,'').replace(/^[""""]|[""""]\s*$/g,'').trim();
            const people = splitPeople(left);
            if (!film) return null;
            return { film, people };
        } else {
            const film = left.replace(/\s*\([^)]{1,30}\)\s*$/,'').trim();
            const people = splitPeople(right);
            if (!film) return null;
            return { film, people };
        }
    }
    if (isPersonPri) return null;
    const film = t.replace(/\s*\([^)]{1,30}\)\s*$/,'').trim();
    if (!film) return null;
    return { film, people: [] };
}

// Minimal CATEGORY_MAP for test
const CATEGORY_MAP: Record<string,string> = {
    'Best Picture':'Best Picture','Best Directing':'Directing',
    'Best Actor in a Leading Role':'Actor in a Leading Role',
    'Best Actress in a Leading Role':'Actress in a Leading Role',
    'Best Actor in a Supporting Role':'Actor in a Supporting Role',
    'Best Actress in a Supporting Role':'Actress in a Supporting Role',
    'Best Writing (Original Screenplay)':'Writing (Original Screenplay)',
    'Best Writing (Adapted Screenplay)':'Writing (Adapted Screenplay)',
    'Best Animated Feature Film':'Animated Feature Film',
    'Best Foreign Language Film':'Foreign Language Film',
    'Best Documentary (Feature)':'Documentary Feature Film',
    'Best Documentary (Short Subject)':'Documentary Short Film',
    'Best Short Film (Live Action)':'Live Action Short Film',
    'Best Short Film (Animated)':'Animated Short Film',
    'Best Music (Original Score)':'Music (Original Score)',
    'Best Music (Original Song)':'Music (Original Song)',
    'Best Sound Editing':'Sound Editing','Best Sound Mixing':'Sound Mixing',
    'Best Art Direction':'Production Design','Best Cinematography':'Cinematography',
    'Best Makeup':'Makeup and Hairstyling','Best Costume Design':'Costume Design',
    'Best Film Editing':'Film Editing','Best Visual Effects':'Visual Effects',
};
function lookupCategory(h: string): string|undefined {
    const t=h.trim(); if(t in CATEGORY_MAP) return CATEGORY_MAP[t];
    const l=t.toLowerCase(); for(const[k,v] of Object.entries(CATEGORY_MAP)) if(k.toLowerCase()===l) return v;
    return undefined;
}

async function parseAndShow(ceremony: number) {
    const wt = await fetchWikitext(ceremony);
    if (!wt) { console.log(`${ordinal(ceremony)}: NOT FOUND`); return; }
    const text = stripRefs(wt);
    const awardCatRe = /\{\{Award category\|[^|{}]+\|\[\[(?:[^\]|]+\|)?([^\]]+)\]\]\}\}/g;
    const markers: Array<{catName:string;pos:number}> = [];
    let m;
    while ((m=awardCatRe.exec(text))!==null) {
        const display = m[1].trim().replace(/\s*\([^)]+\)\s*$/,'');
        const catName = lookupCategory(display);
        if (catName) markers.push({catName,pos:m.index+m[0].length});
    }
    console.log(`\n${ordinal(ceremony)} Academy Awards: ${markers.length} categories found`);
    const noms: {category:string;film:string;people:string[];win:boolean;songTitle?:string}[] = [];
    for (let i=0;i<markers.length;i++) {
        const {catName,pos:startPos}=markers[i];
        const endPos=i+1<markers.length?markers[i+1].pos:text.length;
        const segment=text.substring(startPos,endPos);
        const lines=segment.split('\n');
        for (const line of lines) {
            const lTrim=line.trim();
            if (!lTrim.startsWith('*')) continue;
            const isDouble=lTrim.startsWith('**');
            const isBold=/'''/.test(lTrim);
            const hasDagger=lTrim.includes('{{double-dagger}}')||lTrim.includes('‡');
            const isWin=hasDagger||(!isDouble&&isBold);
            const parsed=parseLine(lTrim,catName);
            if (!parsed||!parsed.film) continue;
            noms.push({category:catName,film:parsed.film,people:parsed.people,win:isWin,songTitle:parsed.songTitle});
        }
    }
    // Print sample of results
    for (const n of noms.slice(0,50)) {
        const win = n.win ? '[WIN]' : '     ';
        const song = n.songTitle ? ` (song: "${n.songTitle}")` : '';
        const people = n.people.length>0 ? ` / ${n.people.join(', ')}` : '';
        console.log(`  ${win} ${n.category}: "${n.film}"${people}${song}`);
    }
    console.log(`  ... total ${noms.length} nominations`);
}

async function main() {
    await parseAndShow(77);
    await new Promise(r=>setTimeout(r,500));
    await parseAndShow(30);
    await new Promise(r=>setTimeout(r,500));
    await parseAndShow(5);
}
main().catch(console.error);
