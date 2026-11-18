/**
 * U.S. festival premiere: the fallback date shown when a film has no U.S. theatrical or streaming release date.
 * Practice: prefer the U.S. release (films.us_release_date); failing that, use the film's first U.S. festival
 * screening (Sundance, Frameline, Tribeca, Telluride…). When only the festival is known, not the day, store that
 * festival's opening date with us_festival_date_exact = false, and only the festival and year are shown.
 */
export interface FestivalPremiere {
  us_festival_date?: string | null;
  us_festival?: string | null;
  us_festival_date_exact?: boolean | null;
}

/** SQL select list for the festival fallback (films aliased as f). */
export const FESTIVAL_COLUMNS = `to_char(f.us_festival_date, 'YYYY-MM-DD') AS us_festival_date, f.us_festival, f.us_festival_date_exact`;

/** "Premiered Jan 23, 2025 at Sundance", or "Premiered at Telluride 2024" when the day isn't known; null if none. */
export function festivalPremiereLabel(f: FestivalPremiere, formatDay: (iso: string) => string): string | null {
  if (!f.us_festival_date || !f.us_festival) return null;
  return f.us_festival_date_exact === false
    ? `Premiered at ${f.us_festival} ${f.us_festival_date.slice(0, 4)}`
    : `Premiered ${formatDay(f.us_festival_date)} at ${f.us_festival}`;
}
