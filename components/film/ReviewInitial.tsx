import { LAUREL_SVG, PLAQUE_HEX, PLAQUE_INNER_HEX } from './laurel-geometry';

/** Illuminated (foliated) initial for Rich's reviews: the site logo's hexagonal laurel wreath and
 *  gold plaque, with the review's first letter in place of "RP". */
export function ReviewInitial({ letter }: { letter: string }) {
  return (
    <span className="float-left mr-3 md:mr-4 -mt-1 mb-1 -ml-1">
      <svg viewBox="58 78 396 396" className="block w-[6.75rem] h-[6.75rem] md:w-[8.25rem] md:h-[8.25rem] text-primary" aria-hidden="true">
        <g dangerouslySetInnerHTML={{ __html: LAUREL_SVG }} />
        <polygon points={PLAQUE_HEX} fill="currentColor" stroke="currentColor" strokeWidth="14" strokeLinejoin="round" />
        <polygon points={PLAQUE_INNER_HEX} fill="none" stroke="#1b1613" strokeOpacity=".5" strokeWidth="3" strokeLinejoin="round" />
        <text x="256" y="258" textAnchor="middle" dominantBaseline="central" fill="#1b1613"
          style={{ fontFamily: 'var(--font-playfair), Georgia, serif', fontWeight: 700, fontSize: 168 }}>
          {letter}
        </text>
      </svg>
      <span className="sr-only">{letter}</span>
    </span>
  );
}
