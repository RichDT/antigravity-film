// Foliated initial for Rich's reviews, after the decorated initials of late-medieval and Renaissance
// manuscripts: the letter itself is the main form (set in the review font, Newsreader), gilded, inside
// a tall ruled frame, with a laurel vine (the logo's leaf shape) winding up through the frame —
// behind the letter for most of its course and over it once, so it reads as woven through.

const W = 120, H = 160
const GOLD = 'currentColor'
const GROUND = '#211a16'
const r = (n: number) => Math.round(n * 10) / 10

type Pt = [number, number]
type Seg = [Pt, Pt, Pt, Pt]
// Left laurel branch: from past the bottom centre (where the two stems cross), out and up the left
// side of the frame, curving in over the top. The right branch mirrors it.
const LEFT: Seg[] = [
  [[84, 126], [30, 158], [8, 114], [14, 72]],
  [[14, 72], [18, 40], [30, 22], [50, 14]],
]
const mirror = (segs: Seg[]): Seg[] => segs.map(seg => seg.map(([x, y]) => [W - x, y]) as Seg)
// Arc-length fraction of each branch drawn in front of the letter: the crossed stems at its foot
const FRONT_UNTIL = 0.2

function bez([a, b, c, d]: Seg, t: number) {
  const u = 1 - t
  const x = u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0]
  const y = u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]
  const dx = 3 * u * u * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t * t * (d[0] - c[0])
  const dy = 3 * u * u * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t * t * (d[1] - c[1])
  const l = Math.hypot(dx, dy) || 1
  return { x, y, tx: dx / l, ty: dy / l }
}

// Laurel leaf (same profile as the logo's), base at the origin pointing up
const leafPath = (L: number) => {
  const w = L * 0.24
  return `M0 0C${r(w * 1.5)} ${r(-L * 0.22)} ${r(w * 1.1)} ${r(-L * 0.78)} 0 ${r(-L)}C${r(-w * 1.1)} ${r(-L * 0.78)} ${r(-w * 1.5)} ${r(-L * 0.22)} 0 0Z`
}

function branch(segs: Seg[]) {
  const pts: { x: number; y: number; tx: number; ty: number; f: number }[] = []
  let s = 0, prev: { x: number; y: number } | null = null
  const raw: { x: number; y: number; tx: number; ty: number; s: number }[] = []
  for (const seg of segs) for (let i = 0; i <= 200; i++) {
    const p = bez(seg, i / 200)
    if (prev) s += Math.hypot(p.x - prev.x, p.y - prev.y)
    raw.push({ ...p, s }); prev = p
  }
  for (const p of raw) pts.push({ ...p, f: p.s / s })
  const at = (f: number) => pts.find(p => p.f >= f) ?? pts[pts.length - 1]
  const stem = (f0: number, f1: number) => 'M' + pts.filter(p => p.f >= f0 && p.f <= f1).map(p => `${r(p.x)} ${r(p.y)}`).join('L')

  const back: string[] = [], front: string[] = []
  back.push(`<path d="${stem(0, 1)}" fill="none" stroke="${GOLD}" stroke-width="2.2" stroke-linecap="round"/>`)
  front.push(`<path d="${stem(0, FRONT_UNTIL)}" fill="none" stroke="${GROUND}" stroke-width="5.4" stroke-linecap="round"/>`,
             `<path d="${stem(0, FRONT_UNTIL)}" fill="none" stroke="${GOLD}" stroke-width="2.2" stroke-linecap="round"/>`)
  const n = 10
  for (let i = 0; i < n; i++) {
    const f = 0.24 + (i / (n - 1)) * 0.68
    const L = 15 - 6 * (i / (n - 1))
    for (const side of ['out', 'in'] as const) {
      const p = at(Math.min(0.96, f + (side === 'in' ? 0.035 : 0)))
      // outward normal = away from the frame's centre
      let nx = -p.ty, ny = p.tx
      if ((p.x - W / 2) * nx + (p.y - H / 2) * ny < 0) { nx = -nx; ny = -ny }
      if (side === 'in') { nx = -nx; ny = -ny }
      const k = side === 'in' ? 0.75 : 1
      const dx = Math.cos(0.85) * p.tx + Math.sin(0.85) * nx * k
      const dy = Math.cos(0.85) * p.ty + Math.sin(0.85) * ny * k
      const rot = Math.atan2(dx, -dy) * 180 / Math.PI
      const len = side === 'in' ? L * 0.85 : L
      back.push(`<g transform="translate(${r(p.x)} ${r(p.y)}) rotate(${r(rot)})"><path d="${leafPath(len)}" fill="${GOLD}" fill-opacity="${side === 'in' ? 0.85 : 1}" stroke="${GROUND}" stroke-width=".9"/><path d="M0 ${r(-len * 0.12)}L0 ${r(-len * 0.8)}" stroke="${GROUND}" stroke-opacity=".5" stroke-width=".75" stroke-linecap="round"/></g>`)
      if (side === 'out' && i % 3 === 1 && i < n - 2)
        back.push(`<circle cx="${r(p.x + nx * 6.5)}" cy="${r(p.y + ny * 6.5)}" r="2.1" fill="${GOLD}" stroke="${GROUND}" stroke-width=".7"/>`)
    }
  }
  // terminal leaf continuing the stem
  const tip = at(1)
  back.push(`<g transform="translate(${r(tip.x)} ${r(tip.y)}) rotate(${r(Math.atan2(tip.tx, -tip.ty) * 180 / Math.PI)})"><path d="${leafPath(9)}" fill="${GOLD}" stroke="${GROUND}" stroke-width=".8"/></g>`)
  return { back: back.join(''), front: front.join('') }
}

// where the two stems cross the centre line
const CROSS_Y = (() => { for (let t = 0; t <= 1; t += 0.002) { const p = bez(LEFT[0], t); if (p.x <= W / 2) return p.y } return H - 10 })()
const L_BRANCH = branch(LEFT), R_BRANCH = branch(mirror(LEFT))
const BACK_SVG = L_BRANCH.back + R_BRANCH.back
const FRONT_SVG = L_BRANCH.front + R_BRANCH.front +
  // small gilt boss where the stems cross, as on a tied wreath
  `<circle cx="${W / 2}" cy="${r(CROSS_Y)}" r="3.2" fill="${GOLD}" stroke="${GROUND}" stroke-width="1"/>`

// Wide capitals need a smaller size to stay inside the frame
const SIZE: Record<string, number> = { M: 106, W: 100, Q: 118, O: 118, C: 122, G: 118, D: 120, H: 118, N: 116, U: 116, A: 120, V: 120 }

export function ReviewInitial({ letter }: { letter: string }) {
  const size = SIZE[letter] ?? 128
  return (
    <span className="float-left mr-3.5 md:mr-4 mt-1.5 mb-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-[5.4rem] h-[7.2rem] md:w-[6rem] md:h-[8rem] text-primary" aria-hidden="true">
        {/* ground and double gilt rule */}
        <rect x="1" y="1" width={W - 2} height={H - 2} rx="3" fill={GROUND} stroke="currentColor" strokeWidth="1.6" />
        <rect x="5.5" y="5.5" width={W - 11} height={H - 11} rx="1.5" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth=".8" />
        <g dangerouslySetInnerHTML={{ __html: BACK_SVG }} />
        {/* the letter: gilded, with a ground-coloured outline so the vine reads as passing behind it */}
        <text x={W / 2} y={H / 2 + 6} textAnchor="middle" dominantBaseline="central" fill="currentColor"
          stroke={GROUND} strokeWidth="5" paintOrder="stroke" strokeLinejoin="round"
          style={{ fontFamily: 'var(--font-newsreader), Georgia, serif', fontWeight: 600, fontSize: size }}>
          {letter}
        </text>
        <g dangerouslySetInnerHTML={{ __html: FRONT_SVG }} />
      </svg>
      <span className="sr-only">{letter}</span>
    </span>
  );
}
