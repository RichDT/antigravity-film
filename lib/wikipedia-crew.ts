const WIKI_API = 'https://en.wikipedia.org/w/api.php'
const UA = 'RichPicks/1.0 (r.d.truncellito@gmail.com)'

export async function fetchWikitext(pageTitle: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'query',
    titles: pageTitle,
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    format: 'json',
    redirects: '1',
  })
  try {
    const res = await fetch(`${WIKI_API}?${params}`, { headers: { 'User-Agent': UA } })
    const json = await res.json()
    const pages = json.query?.pages
    if (!pages) return null
    const page = Object.values(pages)[0] as any
    if (page.missing !== undefined) return null
    const text: string = page.revisions?.[0]?.slots?.main?.['*'] ?? ''
    return text.includes('{{Infobox film') ? text : null
  } catch {
    return null
  }
}

export async function findFilmWikitext(title: string, year: number): Promise<string | null> {
  const [wt1, wt2] = await Promise.all([
    fetchWikitext(`${title} (${year} film)`),
    fetchWikitext(`${title} (film)`),
  ])
  if (wt1) return wt1
  if (wt2) return wt2

  // Fall back to search
  try {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: `${title} ${year} film`,
      srlimit: '3',
      format: 'json',
    })
    const res = await fetch(`${WIKI_API}?${params}`, { headers: { 'User-Agent': UA } })
    const json = await res.json()
    const hits: { title: string }[] = json.query?.search ?? []
    for (const hit of hits) {
      const wt = await fetchWikitext(hit.title)
      if (wt) return wt
    }
  } catch {}
  return null
}

export function extractInfoboxField(wikitext: string, field: string): string {
  const re = new RegExp(`\\|\\s*${field}\\s*=\\s*`, 'i')
  const m = re.exec(wikitext)
  if (!m) return ''

  let i = m.index + m[0].length
  let depth = 0
  let out = ''

  while (i < wikitext.length) {
    const c = wikitext[i], d = wikitext[i + 1]
    if (c === '{' && d === '{') { depth++; out += '{{'; i += 2 }
    else if (c === '}' && d === '}') {
      if (depth === 0) break
      depth--; out += '}}'; i += 2
    }
    else if (c === '|' && depth === 0) break
    else { out += c; i++ }
  }

  return out.trim()
}

export function parseNames(raw: string): string[] {
  // Strip refs, comments, file links, bold/italic markers
  raw = raw
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref\b[^>]*\/>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[\[(?:File|Image|Category):[^\]]+\]\]/gi, '')
    .replace(/'{2,}/g, '')

  // Separator templates → comma
  raw = raw.replace(/\{\{(?:·|•|middot)\s*\}\}/gi, ',')

  // Resolve interlanguage links {{ill|Name|lang|...}} → Name
  raw = raw.replace(/\{\{(?:ill|illm|interlanguage link)\|([^|}]+)[^}]*\}\}/gi, '$1')

  // Resolve wikilinks [[target|display]] → display, [[target]] → target (before list flattening splits on "|")
  raw = raw
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')

  // Flatten list templates: extract inner content, replace pipe separators with newline
  raw = raw.replace(
    /\{\{(?:plainlist|unbulleted list|ubl|flatlist)\s*\|([^}]*)\}\}/gi,
    (_, inner) => inner.replace(/\|/g, '\n')
  )

  // Drop remaining templates
  raw = raw.replace(/\{\{[^{}]*\}\}/g, ' ')

  // Split on all separators: <br/>, bullets, middot chars, comma, " and "
  const parts = raw.split(/(?:<br\s*\/?>\s*|\n\s*\*?\s*|\s*[·•]\s*|\s*,\s*|\s+and\s+)/i)

  const names: string[] = []
  for (const p of parts) {
    const name = p.replace(/<[^>]+>/g, '').replace(/[*\n]/g, '').replace(/\s+/g, ' ').trim()
    if (name.length > 1 && name.length < 80 && /[a-zA-Z]/.test(name) && !/^\d{4}$/.test(name)) {
      names.push(name)
    }
  }
  return [...new Set(names)]
}

export interface WikiCrew {
  directors: string[]
  writers: string[]
  editors: string[]
  cinematographers: string[]
  composers: string[]
  costumeDesigners: string[]
  producers: string[]
}

export async function fetchWikipediaCrew(title: string, year: number): Promise<WikiCrew> {
  const empty: WikiCrew = { directors: [], writers: [], editors: [], cinematographers: [], composers: [], costumeDesigners: [], producers: [] }
  try {
    const wikitext = await findFilmWikitext(title, year)
    if (!wikitext) return empty

    const directors = parseNames(extractInfoboxField(wikitext, 'director'))

    const screenplayRaw =
      extractInfoboxField(wikitext, 'screenplay') ||
      extractInfoboxField(wikitext, 'writer') ||
      extractInfoboxField(wikitext, 'written_by')
    const writers = parseNames(screenplayRaw)

    const editingRaw =
      extractInfoboxField(wikitext, 'editing') ||
      extractInfoboxField(wikitext, 'editor')
    const editors = parseNames(editingRaw)

    const cinematographyRaw =
      extractInfoboxField(wikitext, 'cinematography') ||
      extractInfoboxField(wikitext, 'director_of_photography')
    const cinematographers = parseNames(cinematographyRaw)

    const musicRaw =
      extractInfoboxField(wikitext, 'music') ||
      extractInfoboxField(wikitext, 'composer')
    const composers = parseNames(musicRaw)

    const costumeRaw =
      extractInfoboxField(wikitext, 'costume_design') ||
      extractInfoboxField(wikitext, 'costumes')
    const costumeDesigners = parseNames(costumeRaw)

    const producers = parseNames(extractInfoboxField(wikitext, 'producer') || extractInfoboxField(wikitext, 'producers'))

    return { directors, writers, editors, cinematographers, composers, costumeDesigners, producers }
  } catch (err) {
    console.error('[wikipedia-crew] failed:', err)
    return empty
  }
}

/** Finds the character an actor plays, from "* Actor as Character" lines in the Cast section. */
export function findCharacter(wikitext: string, actor: string): string | null {
  const flat = (t: string) => t
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/<ref\b[^>]*\/>/gi, '')
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1').replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\{\{[^{}]*\}\}/g, '').replace(/'{2,}/g, '')
  for (const line of wikitext.split('\n')) {
    if (!line.trim().startsWith('*')) continue
    const text = flat(line).replace(/^\*+\s*/, '')
    const m = text.match(/^(.+?)\s+as\s+(.+?)(?:,\s|\s[—–-]\s|:\s|(?<!\b(?:Mr|Mrs|Ms|Dr|St|[A-Z]))\.\s|$)/)
    if (m && m[1].trim().toLowerCase() === actor.toLowerCase()) return m[2].trim().replace(/[.,;]$/, '')
  }
  return null
}

/** Cast list from the article's Cast section: "* Actor as Character" lines, in billing order. */
export function parseCast(wikitext: string): { name: string; character: string | null }[] {
  const section = wikitext.match(/==\s*Cast\s*==([\s\S]*?)(?:\n==[^=]|$)/i)?.[1] ?? ''
  const flat = (t: string) => t
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/<ref\b[^>]*\/>/gi, '')
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1').replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\{\{(?:ill|illm|interlanguage link)\|([^|}]+)[^}]*\}\}/gi, '$1').replace(/\{\{[^{}]*\}\}/g, '').replace(/'{2,}/g, '').replace(/<[^>]+>/g, '')
  const out: { name: string; character: string | null }[] = []
  for (const line of section.split('\n')) {
    if (!/^\*[^*]/.test(line.trim())) continue
    const text = flat(line).replace(/^\*+\s*/, '').trim()
    const m = text.match(/^(.+?)\s+as\s+(.+?)(?:,\s|\s[—–-]\s|:\s|(?<!\b(?:Mr|Mrs|Ms|Dr|St|[A-Z]))\.\s|$)/)
    const name = (m ? m[1] : text.split(/[,:(]/)[0]).replace(/\s*\([^)]*\)\s*$/, '').trim()
    if (name.length < 2 || name.length > 60 || !/[a-zA-Z]/.test(name)) continue
    out.push({ name, character: m ? m[2].trim().replace(/[.,;]$/, '') : null })
  }
  return out
}
