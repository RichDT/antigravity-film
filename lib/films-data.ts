/**
 * Shared, pre-filtered view of films.json for use across all pages.
 *
 * Two transforms are applied at module load time:
 *
 * 1. TV-only entries are removed — the source CSVs include Golden Globes and
 *    SAG nominations for television, so TV shows (Frasier, The Sopranos, etc.)
 *    ended up in the data.  We strip any entry whose every award detail falls
 *    in a TV-specific category.
 *
 * 2. Near-duplicate entries are collapsed — the same film sometimes appears
 *    twice under slightly different title spellings (e.g. different
 *    capitalisation, dropped leading "The", punctuation variants).  The entry
 *    with a Rich Picks grade is kept as canonical; its award-detail list is
 *    extended with any nominations that only existed on the duplicate.
 */

import rawFilmsData from "@/data/films.json";

// ---------------------------------------------------------------------------
// 1. TV filter
// ---------------------------------------------------------------------------

const TV_CATEGORY_KEYWORDS = [
  "television", "drama series", "comedy series", "limited series",
  "mini-series", "miniseries",
];

const isTvCategory = (cat: string) =>
  TV_CATEGORY_KEYWORDS.some(kw => cat.toLowerCase().includes(kw));

// ---------------------------------------------------------------------------
// 2. Duplicate-collapsing helpers
// ---------------------------------------------------------------------------

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type RawFilm = {
  id: string;
  title: string;
  year: string | number;
  grade: string;
  country: string;
  languages: string;
  score: number;
  awards: {
    nominations: number;
    wins: number;
    details: { award: string; category: string; won: boolean; nominee: string }[];
  };
};

function mergeInto(canonical: RawFilm, duplicate: RawFilm): void {
  const seen = new Set(
    canonical.awards.details.map(d => `${d.award}|${d.category}|${d.nominee}`)
  );
  for (const d of duplicate.awards.details) {
    const key = `${d.award}|${d.category}|${d.nominee}`;
    if (!seen.has(key)) {
      seen.add(key);
      canonical.awards.details.push(d);
    }
  }
  canonical.awards.nominations = canonical.awards.details.length;
  canonical.awards.wins = canonical.awards.details.filter(d => d.won).length;
}

// ---------------------------------------------------------------------------
// Build the filtered + de-duplicated list
// ---------------------------------------------------------------------------

const withoutTv = (rawFilmsData as unknown as RawFilm[]).filter(f => {
  const details = f.awards?.details ?? [];
  return details.length === 0 || !details.every(d => isTvCategory(d.category));
});

// Map: "year|normalizedTitle" → canonical entry (deep-cloned so we can mutate)
const byKey = new Map<string, RawFilm>();

for (const film of withoutTv) {
  const key = `${film.year}|${normalizeTitle(film.title)}`;
  const clone: RawFilm = {
    ...film,
    awards: { ...film.awards, details: [...(film.awards?.details ?? [])] },
  };

  if (!byKey.has(key)) {
    byKey.set(key, clone);
  } else {
    const existing = byKey.get(key)!;
    if (!existing.grade && clone.grade) {
      // Incoming entry has the grade → it becomes the canonical
      mergeInto(clone, existing);
      byKey.set(key, clone);
    } else {
      // Keep existing as canonical, absorb the new entry's details
      mergeInto(existing, clone);
    }
  }
}

// Explicit title overrides keyed by "year|normalizedTitle".
// Applied after dedup to correct titles regardless of which variant was canonical.
const TITLE_OVERRIDES: Record<string, string> = {
  "2008|wall e":                                          "WALL·E",
  "2005|good night and good luck":                        "good night, and good luck.",
  "2003|lord of the rings the return of the king":        "The Lord of the Rings: The Return of the King",
  "2002|lord of the rings the two towers":                "The Lord of the Rings: The Two Towers",
  "2001|lord of the rings the fellowship of the ring":    "The Lord of the Rings: The Fellowship of the Ring",
  "2025|f1 the movie":                                    "F1",
  "2025|jurassic world rebirth":                          "Jurassic World: Rebirth",
  "2025|little amelie or the character of rain":          "Little Amélie, or the Character of Rain",
  "2005|mrs henderson presents":                          "Mrs. Henderson Presents",
};

for (const [key, film] of byKey) {
  if (TITLE_OVERRIDES[key]) film.title = TITLE_OVERRIDES[key];
}

// Second dedup pass: overrides can cause entries to share a normalized title.
// Re-collapse those using the same canonical-selection logic as above.
const byKey2 = new Map<string, RawFilm>();
for (const film of byKey.values()) {
  const key = `${film.year}|${normalizeTitle(film.title)}`;
  if (!byKey2.has(key)) {
    byKey2.set(key, film);
  } else {
    const existing = byKey2.get(key)!;
    if (!existing.grade && film.grade) {
      mergeInto(film, existing);
      byKey2.set(key, film);
    } else {
      mergeInto(existing, film);
    }
  }
}

export const filmsData: RawFilm[] = Array.from(byKey2.values());
