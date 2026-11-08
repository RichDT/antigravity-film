// Foliated initial for Rich's reviews, after the decorated initials of late-medieval and Renaissance
// manuscripts: the letter itself is the main form (Newsreader, the review font), gilded on a ground in
// the page's own muted reds, inside a tall ruled frame, with a laurel vine (the logo's leaf) that is
// planned around each letter's shape — through its counter where it has one, otherwise across its
// strokes — passing alternately in front of and behind the letter. Geometry: initials-data.ts.
import { INITIALS } from './initials-data';

const W = 120, H = 160;

// Small white dot-triads in the corners, a common filler in manuscript grounds
const TRIADS: [number, number][] = [[15, 15], [W - 15, 15], [15, H - 15], [W - 15, H - 15]];

export function ReviewInitial({ letter }: { letter: string }) {
  const key = letter.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const g = INITIALS[key];
  const id = `ini-${key}`;
  return (
    <span className="float-left mr-3.5 md:mr-4 mt-1.5 mb-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-[5.7rem] h-[7.6rem] md:w-[6.75rem] md:h-[9rem]" aria-hidden="true"
        style={{ ['--ini-gold' as string]: 'var(--primary)', ['--ini-ground' as string]: '#4a3a3a' }}>
        <defs>
          <radialGradient id={`${id}-ground`} cx="50%" cy="45%" r="75%">
            <stop offset="0%" stopColor="var(--secondary)" />
            <stop offset="65%" stopColor="#4a3a3a" />
            <stop offset="100%" stopColor="var(--card)" />
          </radialGradient>
          <linearGradient id={`${id}-gilt`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor="#ecd37a" />
            <stop offset="45%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="#a8862a" />
          </linearGradient>
        </defs>
        {/* ground, gilt outer rule, white inner hairline */}
        <rect x="1" y="1" width={W - 2} height={H - 2} rx="3" fill={`url(#${id}-ground)`} stroke="var(--primary)" strokeWidth="1.8" />
        <rect x="5.5" y="5.5" width={W - 11} height={H - 11} rx="1.5" fill="none" stroke="var(--foreground)" strokeOpacity=".28" strokeWidth=".7" />
        {TRIADS.map(([x, y], i) => (
          <g key={i} fill="var(--foreground)" fillOpacity=".4">
            <circle cx={x} cy={y - 2} r=".95" /><circle cx={x - 1.8} cy={y + 1.1} r=".95" /><circle cx={x + 1.8} cy={y + 1.1} r=".95" />
          </g>
        ))}
        {g ? (
          <>
            <g dangerouslySetInnerHTML={{ __html: g.back }} />
            {/* the letter: gilded, edged in the ground colour so the vine reads as passing behind it */}
            <path d={g.d} fill={`url(#${id}-gilt)`} stroke="#4a3a3a" strokeWidth="4" paintOrder="stroke" strokeLinejoin="round" />
            <path d={g.d} fill="none" stroke="var(--foreground)" strokeOpacity=".22" strokeWidth=".6" />
            <g dangerouslySetInnerHTML={{ __html: g.front }} />
          </>
        ) : (
          <text x={W / 2} y={H / 2 + 6} textAnchor="middle" dominantBaseline="central" fill={`url(#${id}-gilt)`}
            style={{ fontFamily: 'var(--font-newsreader), Georgia, serif', fontWeight: 600, fontSize: 120 }}>{letter}</text>
        )}
      </svg>
      <span className="sr-only">{letter}</span>
    </span>
  );
}
