import { CalendarPlus } from 'lucide-react';

export interface CalendarFilm {
  film_id: number;
  title: string;
  us_release_date: string | null;
  release_venue: string | null;
  trailer_url: string | null;
}

/** "Add to Google Calendar" link and a downloadable .ics file (Apple Calendar, Outlook) for a film's U.S. release day. */
export function CalendarLinks({ film }: { film: CalendarFilm }) {
  if (!film.us_release_date) return <p className="text-xs text-muted-foreground italic">Calendar links appear once a release date is announced.</p>;
  const ymd = film.us_release_date.replace(/-/g, '');
  const next = new Date(film.us_release_date + 'T00:00:00Z'); next.setUTCDate(next.getUTCDate() + 1);
  const ymdNext = next.toISOString().slice(0, 10).replace(/-/g, '');
  const what = `${film.title} — ${film.release_venue === 'Theaters' || !film.release_venue ? 'in theaters' : `on ${film.release_venue}`}`;
  const details = `Anticipated on Rich Picks. ${film.trailer_url ? `Trailer: ${film.trailer_url}` : ''}`;
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(what)}&dates=${ymd}/${ymdNext}&details=${encodeURIComponent(details)}`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rich Picks//Anticipation Board//EN', 'BEGIN:VEVENT',
    `UID:richpicks-${film.film_id}-${ymd}@richpicks`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${ymd}`, `DTEND;VALUE=DATE:${ymdNext}`, `SUMMARY:${what.replace(/[,;]/g, '\\$&')}`,
    `DESCRIPTION:${details.replace(/[,;]/g, '\\$&')}`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  return (
    <div className="flex flex-wrap gap-2">
      <a href={google} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40">
        <CalendarPlus className="w-3.5 h-3.5" /> Google Calendar
      </a>
      <a href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`} download={`${film.title.replace(/[^\w]+/g, '-')}.ics`}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40">
        <CalendarPlus className="w-3.5 h-3.5" /> Apple Calendar (.ics)
      </a>
    </div>
  );
}
