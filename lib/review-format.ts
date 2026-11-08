// Turns Rich's plain-text reviews into styled segments for the film page:
//   • *asterisks* mark italics explicitly (pasting from Substack converts its italics to this)
//   • film/TV titles are found from Rich's citation format and italicized:
//       Director's (2002) The Hours          → title after a possessive + (year)
//       Veneno (2020) / Drag Race España (Charles [creator], 2021-present) → title before (…year…)
//     and linked when the film is in the database (matched by title and year ±1)
//   • the reviewed film's own title is italicized wherever it appears
//   • people's names are linked when they match a person in the database
//   • common foreign-language borrowings (début, magnum opus…) are italicized
import { queryCached as query } from '@/lib/db'

export type ReviewSegment = { text: string; italic?: boolean; href?: string }

type Range = { start: number; end: number; italic: boolean; href?: string; priority: number; replace?: string }

export type ReviewFormatResult = {
  segments: ReviewSegment[]
  /** The raw text with spellings and cited years corrected to the database's official versions */
  correctedRaw: string
  corrections: { from: string; to: string }[]
}

const LOANWORDS = [
  'début', 'débuts', 'magnum opus', 'magna opera', 'oeuvre', 'œuvre', 'auteur', 'auteurs', 'auteurist',
  'mise-en-scène', 'mise en scène', 'raison d’être', "raison d'être", 'tour de force', 'tours de force',
  'cause célèbre', 'coup de grâce', 'déjà vu', 'enfant terrible', 'enfants terribles', 'fait accompli',
  'femme fatale', 'femmes fatales', 'film noir', 'films noirs', 'joie de vivre', 'je ne sais quoi',
  'belle époque', 'avant-garde', 'cinéma vérité', 'cinéma-vérité', 'vérité', 'nouvelle vague',
  'pièce de résistance', 'savoir-faire', 'sui generis', 'ad nauseam', 'bona fide', 'de rigueur',
  'deus ex machina', 'in medias res', 'non sequitur', 'non sequiturs', 'persona non grata', 'per se',
  'vis-à-vis', 'zeitgeist', 'schadenfreude', 'gesamtkunstwerk', 'doppelgänger', 'doppelgängers',
  'wunderkind', 'leitmotif', 'leitmotifs', 'mélange', 'ingénue', 'ingénues', 'soupçon', 'tableau vivant',
  'tableaux vivants', 'trompe l’oeil', "trompe l'oeil", 'trompe-l’oeil', "trompe-l'oeil", 'et al.',
  'a priori', 'a posteriori', 'carte blanche', 'en masse', 'faux pas', 'nom de plume', 'tête-à-tête',
  'cri de coeur', 'cri de cœur', 'roman à clef', 'roman à clé', 'bildungsroman', 'bildungsromans',
  'telenovela', 'telenovelas', 'film à clef', 'grand guignol', 'grand-guignol', 'giallo', 'gialli',
  'kammerspiel', 'cinéaste', 'cinéastes', 'cinéphile', 'cinéphiles', 'mise-en-abyme', 'mise en abyme',
  'l’art pour l’art', 'idée fixe', 'bête noire', 'esprit de corps', 'fin de siècle', 'fin-de-siècle',
  'haute couture', 'nouveau riche', 'objet d’art', 'par excellence', 'succès de scandale',
  'succès d’estime', 'sotto voce', 'chiaroscuro', 'pastiche', 'hommage', 'mutatis mutandis',
  'ex nihilo', 'in toto', 'quid pro quo', 'status quo ante', 'vox populi', 'ars poetica', 'memento mori',
  'tabula rasa', 'terra incognita', 'ad infinitum', 'mea culpa', 'opus', 'corpus',
]
// Words that are already ordinary English and should never be auto-italicized, even if listed above
const NOT_ITALIC = new Set(['opus', 'corpus', 'pastiche'])

const MINOR = new Set(['a', 'an', 'the', 'of', 'and', 'in', 'on', 'to', 'for', 'at', 'by', 'or', 'with', 'from',
  'de', 'la', 'le', 'les', 'el', 'los', 'las', 'del', 'des', 'du', 'di', 'da', 'y', 'e', 'et', 'und', 'der', 'die', 'das'])
const NAME_PARTICLES = new Set(['de', 'da', 'das', 'do', 'dos', 'del', 'della', 'di', 'du', 'van', 'von', 'der', 'den', 'le', 'la', 'y', 'bin', 'al', 'ter'])

const WORD = /[\p{L}\p{N}][\p{L}\p{M}\p{N}'’\-]*/gu
type Tok = { s: number; e: number; w: string }

// Accent-insensitive match key (JS side mirrors FOLD_SQL)
const ACC_FROM = 'áàâäãåāąéèêëēęěíìîïīóòôöõøōőúùûüūůűñńňçćčýÿłśšşżźžřďť'
const ACC_TO   = 'aaaaaaaaeeeeeeeiiiiioooooooouuuuuuunnncccyylssszzzrdt'
const fold = (s: string) => [...s.toLowerCase()].map(ch => { const k = ACC_FROM.indexOf(ch); return k >= 0 ? ACC_TO[k] : ch }).join('')
const FOLD_SQL = (col: string) => `translate(lower(${col}), '${ACC_FROM}', '${ACC_TO}')`

const isCap = (w: string) => /^\p{Lu}/u.test(w) || /^\d/.test(w)
const stripPossessive = (w: string) => w.replace(/['’]s$/u, '').replace(/(s)['’]$/u, '$1')
const hasPossessive = (w: string) => /['’]s$/u.test(w) || /s['’]$/u.test(w)

function tokenize(text: string): Tok[] {
  const out: Tok[] = []
  for (const m of text.matchAll(WORD)) out.push({ s: m.index!, e: m.index! + m[0].length, w: m[0] })
  return out
}

/** Strip *asterisk* markup, returning plain text and the explicit italic ranges. */
function parseMarkup(raw: string): { text: string; em: { start: number; end: number }[]; map: number[] } {
  let text = ''
  const em: { start: number; end: number }[] = []
  const map: number[] = [] // plain-text index → raw index
  let i = 0
  while (i < raw.length) {
    if (raw[i] === '*') {
      const close = raw.indexOf('*', i + 1)
      const inner = close > i + 1 ? raw.slice(i + 1, close) : ''
      if (close > i + 1 && !inner.includes('\n')) {
        em.push({ start: text.length, end: text.length + inner.length })
        for (let k = 0; k < inner.length; k++) map.push(i + 1 + k)
        text += inner
        i = close + 1
        continue
      }
    }
    map.push(i)
    text += raw[i++]
  }
  map.push(raw.length)
  return { text, em, map }
}

export async function formatReview(raw: string, opts: { filmTitle: string }): Promise<ReviewFormatResult> {
  const { text, em, map } = parseMarkup(raw)
  const toks = tokenize(text)
  const ranges: Range[] = []
  const lower = (s: string) => s.toLowerCase()

  // Token index lookup helpers
  const tokIndexAtOrAfter = (pos: number) => toks.findIndex(t => t.s >= pos)
  const tokIndexBefore = (pos: number) => { let k = -1; for (let j = 0; j < toks.length && toks[j].e <= pos; j++) k = j; return k }
  const sepOk = (a: Tok, b: Tok) => /^[\s:,&!?–—-]*$/u.test(text.slice(a.e, b.s)) && !/[()\n]/.test(text.slice(a.e, b.s))
  const plainSep = (a: Tok, b: Tok) => /^[ \t]+$/.test(text.slice(a.e, b.s)) || /^[ \t]*:[ \t]+$/.test(text.slice(a.e, b.s))

  // ── 1. Year-anchored title candidates ──────────────────────────────────────
  type Anchor = { year: number; yearStart: number; dir: 'fwd' | 'back'; startTok: number; candidates: { s: number; e: number }[]; fallback: { s: number; e: number } | null }
  const anchors: Anchor[] = []
  // Year markers: (2002) / (Creator [creator], 2021-present), [2015] inside parentheses,
  // and "Title, 2023)" closing a parenthetical
  const YEAR = '(1[89]\\d\\d|20\\d\\d)'
  const marks: { open: number; close: number; year: number; yearStart: number; backOnly: boolean }[] = []
  for (const m of text.matchAll(new RegExp(`\\(([^()\\n]*?\\b${YEAR}\\b[^()\\n]*)\\)`, 'g')))
    marks.push({ open: m.index!, close: m.index! + m[0].length, year: parseInt(m[2], 10), yearStart: m.index! + 1 + m[1].search(new RegExp(`\\b${m[2]}\\b`)), backOnly: false })
  for (const m of text.matchAll(new RegExp(`\\[${YEAR}(?:[–-](?:\\d{4}|present))?\\]`, 'g')))
    marks.push({ open: m.index!, close: m.index! + m[0].length, year: parseInt(m[1], 10), yearStart: m.index! + 1, backOnly: false })
  for (const m of text.matchAll(new RegExp(`,[ \\t]*${YEAR}(?:[–-](?:\\d{4}|present))?[ \\t]*\\)`, 'g')))
    marks.push({ open: m.index!, close: m.index! + m[0].length, year: parseInt(m[1], 10), yearStart: m.index! + m[0].indexOf(m[1]), backOnly: true })
  for (const { open, close, year, yearStart, backOnly } of marks) {
    const prev = tokIndexBefore(open)
    const prevTok = prev >= 0 ? toks[prev] : null
    const touchesPrev = prevTok && /^[ \t]*$/.test(text.slice(prevTok.e, open))
    if (prevTok && touchesPrev && !backOnly && hasPossessive(prevTok.w)) {
      // Director's (Year) Title — title follows
      const first = tokIndexAtOrAfter(close)
      if (first < 0 || !/^[ \t]*$/.test(text.slice(close, toks[first].s))) continue
      const candidates: { s: number; e: number }[] = []
      for (let j = first; j < Math.min(toks.length, first + 10); j++) {
        if (j > first && !sepOk(toks[j - 1], toks[j])) break
        candidates.push({ s: toks[first].s, e: toks[j].e })
      }
      // Fallback: capitalized run (minor words allowed between capitals)
      let end = -1
      if (isCap(toks[first].w)) {
        end = first
        for (let j = first + 1; j < toks.length && plainSep(toks[j - 1], toks[j]); j++) {
          if (isCap(toks[j].w)) end = j
          else if (!MINOR.has(lower(toks[j].w))) break
        }
      }
      anchors.push({ year, yearStart, dir: 'fwd', startTok: first, candidates, fallback: end >= 0 ? { s: toks[first].s, e: toks[end].e } : null })
    } else if (prevTok && touchesPrev) {
      // Title (Year) / Title (Creator [creator], Years) — title precedes
      const last = prev
      const candidates: { s: number; e: number }[] = []
      for (let j = last; j >= Math.max(0, last - 9); j--) {
        if (j < last && !sepOk(toks[j], toks[j + 1])) break
        candidates.push({ s: toks[j].s, e: toks[last].e })
      }
      let start = -1
      if (isCap(toks[last].w)) {
        start = last
        for (let j = last - 1; j >= 0 && plainSep(toks[j], toks[j + 1]); j--) {
          if (isCap(toks[j].w)) start = j
          else if (!MINOR.has(lower(toks[j].w))) break
        }
        // A run can't open on a lowercase minor word
        while (start < last && !isCap(toks[start].w)) start++
      }
      anchors.push({ year, yearStart, dir: 'back', startTok: last, candidates, fallback: start >= 0 ? { s: toks[start].s, e: toks[last].e } : null })
    }
  }

  // ── 2. Person-name candidates (2–5 word capitalized runs) ─────────────────
  const nameCands: { s: number; e: number; key: string }[] = []
  for (let i = 0; i < toks.length; i++) {
    if (!/^\p{Lu}/u.test(toks[i].w)) continue
    for (let j = i + 1; j < Math.min(toks.length, i + 5); j++) {
      if (!plainSep(toks[j - 1], toks[j]) || /:/.test(text.slice(toks[j - 1].e, toks[j].s))) break
      if (hasPossessive(toks[j - 1].w)) break
      const w = toks[j].w
      if (!/^\p{Lu}/u.test(w) && !NAME_PARTICLES.has(lower(w))) break
      if (!/^\p{Lu}/u.test(w)) continue
      const e = toks[j].e - (hasPossessive(w) ? (w.length - stripPossessive(w).length) : 0)
      nameCands.push({ s: toks[i].s, e, key: fold(text.slice(toks[i].s, e)) })
    }
  }

  // ── 3. Database lookups ───────────────────────────────────────────────────
  const titleKeys = new Set<string>()
  for (const a of anchors) for (const c of a.candidates) titleKeys.add(fold(text.slice(c.s, c.e)))
  for (const r of em) titleKeys.add(fold(text.slice(r.start, r.end)))
  const [filmRes, peopleRes] = await Promise.all([
    titleKeys.size
      ? query(`SELECT film_id, title, release_year FROM films WHERE ${FOLD_SQL('title')} = ANY($1)`, [[...titleKeys]])
      : Promise.resolve({ rows: [] as any[] }),
    nameCands.length
      ? query(`SELECT DISTINCT ON (${FOLD_SQL('p.name')}) p.person_id, p.name, ${FOLD_SQL('p.name')} AS lname
               FROM people p LEFT JOIN nomination_people np USING (person_id)
               WHERE ${FOLD_SQL('p.name')} = ANY($1)
               GROUP BY p.person_id, p.name
               ORDER BY ${FOLD_SQL('p.name')}, count(np.nomination_id) DESC, p.person_id`, [[...new Set(nameCands.map(c => c.key))]])
      : Promise.resolve({ rows: [] as any[] }),
  ])
  const filmsByTitle = new Map<string, { id: number; year: number; title: string }[]>()
  for (const f of filmRes.rows as any[]) {
    const k = fold(f.title)
    if (!filmsByTitle.has(k)) filmsByTitle.set(k, [])
    filmsByTitle.get(k)!.push({ id: f.film_id, year: f.release_year, title: f.title })
  }
  const personByName = new Map<string, { id: number; name: string }>()
  for (const p of peopleRes.rows as any[]) personByName.set(p.lname, { id: p.person_id, name: p.name })

  const findFilm = (title: string, year?: number) => {
    const list = filmsByTitle.get(fold(title)) ?? []
    if (year == null) return list.length === 1 ? list[0] : undefined
    return list.filter(f => f.year != null && Math.abs(f.year - year) <= 1).sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year))[0]
  }

  // ── 4. Build ranges ───────────────────────────────────────────────────────
  // exact title text as written → link and the database's official spelling
  const knownTitles = new Map<string, { href?: string; official?: string }>()
  for (const a of anchors) {
    let best: { s: number; e: number; href: string; official: string; year: number } | null = null
    for (const c of a.candidates) {
      const f = findFilm(text.slice(c.s, c.e), a.year)
      if (f && (!best || c.e - c.s > best.e - best.s)) best = { ...c, href: `/film/${f.id}`, official: f.title, year: f.year }
    }
    if (best) {
      ranges.push({ start: best.s, end: best.e, italic: true, href: best.href, priority: 3, replace: best.official })
      knownTitles.set(text.slice(best.s, best.e), { href: best.href, official: best.official })
      // The cited year must match the film's year in the database
      if (best.year !== a.year) ranges.push({ start: a.yearStart, end: a.yearStart + 4, italic: false, priority: 5, replace: String(best.year) })
    } else if (a.fallback) {
      ranges.push({ start: a.fallback.s, end: a.fallback.e, italic: true, priority: 3 })
      knownTitles.set(text.slice(a.fallback.s, a.fallback.e), {})
    }
  }
  for (const r of em) {
    const t = text.slice(r.start, r.end)
    // year from an adjacent parenthetical, if any
    const near = text.slice(Math.max(0, r.start - 12), r.start) + text.slice(r.end, r.end + 40)
    const y = near.match(/\((?:[^()]*?)\b(1[89]\d\d|20\d\d)\b/)?.[1]
    const f = findFilm(t, y ? parseInt(y, 10) : undefined)
    ranges.push({ start: r.start, end: r.end, italic: true, href: f ? `/film/${f.id}` : undefined, priority: 4, replace: f?.title })
    if (f) knownTitles.set(t, { href: `/film/${f.id}`, official: f.title })
  }
  // Repeat mentions of titles already identified, plus the reviewed film's own title
  if (opts.filmTitle && !knownTitles.has(opts.filmTitle)) knownTitles.set(opts.filmTitle, {})
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (const [t, { href, official }] of knownTitles) {
    if (t.length < 3) continue
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escape(t)}(?![\\p{L}\\p{N}])`, 'gu')
    for (const m of text.matchAll(re)) {
      const isOwn = t === opts.filmTitle
      ranges.push({ start: m.index!, end: m.index! + t.length, italic: true, href: isOwn ? undefined : href, priority: 2, replace: official })
    }
  }
  // People
  const sortedNames = nameCands.filter(c => personByName.has(c.key)).sort((a, b) => (b.e - b.s) - (a.e - a.s))
  for (const c of sortedNames) { const p = personByName.get(c.key)!; ranges.push({ start: c.s, end: c.e, italic: false, href: `/person/${p.id}`, priority: 1, replace: p.name }) }
  // Loanwords
  for (const w of LOANWORDS) {
    if (NOT_ITALIC.has(w)) continue
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escape(w)}(?![\\p{L}\\p{N}])`, 'giu')
    for (const m of text.matchAll(re)) ranges.push({ start: m.index!, end: m.index! + m[0].length, italic: true, priority: 0 })
  }

  // ── 5. Resolve overlaps (higher priority, then longer, wins) and emit ─────
  ranges.sort((a, b) => b.priority - a.priority || (b.end - b.start) - (a.end - a.start) || a.start - b.start)
  const placed: Range[] = []
  for (const r of ranges) {
    if (placed.some(p => r.start < p.end && p.start < r.end)) continue
    placed.push(r)
  }
  placed.sort((a, b) => a.start - b.start)
  const out: ReviewSegment[] = []
  let pos = 0
  for (const r of placed) {
    if (r.start > pos) out.push({ text: text.slice(pos, r.start) })
    out.push({ text: r.replace ?? text.slice(r.start, r.end), italic: r.italic || undefined, href: r.href })
    pos = r.end
  }
  if (pos < text.length) out.push({ text: text.slice(pos) })

  // Apply the same corrections to the raw text (asterisks kept), last first so positions hold
  const corrections: { from: string; to: string }[] = []
  let correctedRaw = raw
  for (const r of [...placed].reverse()) {
    const from = text.slice(r.start, r.end)
    if (r.replace == null || r.replace === from) continue
    const rs = map[r.start], re = map[r.end - 1] + 1
    if (raw.slice(rs, re) !== from) continue // markup inside the span; leave it alone
    correctedRaw = correctedRaw.slice(0, rs) + r.replace + correctedRaw.slice(re)
    corrections.unshift({ from, to: r.replace })
  }
  return { segments: out, correctedRaw, corrections }
}
