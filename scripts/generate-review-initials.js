// Usage: npm i --no-save fontkit@2.0.4 && curl -L -o /tmp/newsreader.ttf "https://github.com/google/fonts/raw/main/ofl/newsreader/Newsreader%5Bopsz%2Cwght%5D.ttf"
//        node scripts/generate-review-initials.js /tmp/newsreader.ttf components/film/initials-data.ts
// Generates per-letter foliated initials: Newsreader SemiBold (display optical size) glyph outlines
// plus a laurel vine planned around each letter's own shape. Output: components/film/initials-data.ts
const fs = require('fs');
const fontkit = require('fontkit');

const W = 120, H = 160, PAD = 9;               // frame and inner margin
const CELL = 1.5;                               // planning grid resolution
const GX = Math.round(W / CELL), GY = Math.round(H / CELL);
const r = n => Math.round(n * 10) / 10;

const base = fontkit.openSync(process.argv[2]);
const font = base.getVariation({ wght: 600, opsz: 72 });
const CAP = font.capHeight;

// ── glyph geometry ─────────────────────────────────────────────────────────
function glyphFor(ch) {
  const g = font.layout(ch).glyphs[0];
  const bb = g.path.bbox;
  let s = 92 / CAP;                                   // cap height ≈ 92 units in a 160-tall frame
  const maxW = W - 2 * PAD - 14;
  if ((bb.maxX - bb.minX) * s > maxW) s = maxW / (bb.maxX - bb.minX);
  const baseY = 128 - (92 - CAP * s) / 2;             // keep it optically centred when shrunk
  const ox = W / 2 - ((bb.minX + bb.maxX) / 2) * s;
  const T = (x, y) => [ox + x * s, baseY - y * s];
  // SVG path + flattened polygons for point-in-glyph tests
  let d = '';
  const polys = []; let cur = null, last = null;
  for (const c of g.path.commands) {
    const a = c.args;
    if (c.command === 'moveTo') { const p = T(a[0], a[1]); d += `M${r(p[0])} ${r(p[1])}`; cur = [p]; polys.push(cur); last = p; }
    else if (c.command === 'lineTo') { const p = T(a[0], a[1]); d += `L${r(p[0])} ${r(p[1])}`; cur.push(p); last = p; }
    else if (c.command === 'quadraticCurveTo') {
      const q = T(a[0], a[1]), p = T(a[2], a[3]);
      d += `Q${r(q[0])} ${r(q[1])} ${r(p[0])} ${r(p[1])}`;
      for (let t = 0.125; t <= 1.0001; t += 0.125) { const u = 1 - t; cur.push([u * u * last[0] + 2 * u * t * q[0] + t * t * p[0], u * u * last[1] + 2 * u * t * q[1] + t * t * p[1]]); }
      last = p;
    } else if (c.command === 'bezierCurveTo') {
      const c1 = T(a[0], a[1]), c2 = T(a[2], a[3]), p = T(a[4], a[5]);
      d += `C${r(c1[0])} ${r(c1[1])} ${r(c2[0])} ${r(c2[1])} ${r(p[0])} ${r(p[1])}`;
      for (let t = 0.125; t <= 1.0001; t += 0.125) { const u = 1 - t; cur.push([u*u*u*last[0]+3*u*u*t*c1[0]+3*u*t*t*c2[0]+t*t*t*p[0], u*u*u*last[1]+3*u*u*t*c1[1]+3*u*t*t*c2[1]+t*t*t*p[1]]); }
      last = p;
    } else if (c.command === 'closePath') d += 'Z';
  }
  const inside = (x, y) => { // non-zero winding
    let wn = 0;
    for (const P of polys) for (let i = 0; i < P.length; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length];
      if (y1 <= y) { if (y2 > y && (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1) > 0) wn++; }
      else if (y2 <= y && (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1) < 0) wn--;
    }
    return wn !== 0;
  };
  return { d, inside };
}

// ── planning grid ──────────────────────────────────────────────────────────
function analyse(inside) {
  const solid = new Uint8Array(GX * GY);
  for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) solid[j * GX + i] = inside((i + 0.5) * CELL, (j + 0.5) * CELL) ? 1 : 0;
  // distance (in units) from each cell to the letter, by BFS
  const dist = new Float32Array(GX * GY).fill(1e9); const q = [];
  for (let k = 0; k < GX * GY; k++) if (solid[k]) { dist[k] = 0; q.push(k); }
  for (let h = 0; h < q.length; h++) { const k = q[h], i = k % GX, j = (k / GX) | 0;
    for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= GX || b >= GY) continue;
      const n = b * GX + a; if (dist[n] > dist[k] + CELL) { dist[n] = dist[k] + CELL; q.push(n); } } }
  // counters: empty cells not reachable from the frame edge
  const seen = new Uint8Array(GX * GY); const st = [];
  for (let i = 0; i < GX; i++) { st.push(i, (GY - 1) * GX + i); } for (let j = 0; j < GY; j++) { st.push(j * GX, j * GX + GX - 1); }
  while (st.length) { const k = st.pop(); if (seen[k] || solid[k]) continue; seen[k] = 1; const i = k % GX, j = (k / GX) | 0;
    if (i > 0) st.push(k - 1); if (i < GX - 1) st.push(k + 1); if (j > 0) st.push(k - GX); if (j < GY - 1) st.push(k + GX); }
  const counters = []; const lab = new Int32Array(GX * GY).fill(-1);
  for (let k = 0; k < GX * GY; k++) if (!solid[k] && !seen[k] && lab[k] < 0) {
    const cells = []; const s2 = [k]; lab[k] = counters.length;
    while (s2.length) { const c = s2.pop(); cells.push(c); const i = c % GX, j = (c / GX) | 0;
      for (const n of [i > 0 ? c - 1 : -1, i < GX - 1 ? c + 1 : -1, j > 0 ? c - GX : -1, j < GY - 1 ? c + GX : -1])
        if (n >= 0 && !solid[n] && !seen[n] && lab[n] < 0) { lab[n] = counters.length; s2.push(n); } }
    // the point of the counter farthest from the letter
    let best = cells[0]; for (const c of cells) if (dist[c] > dist[best]) best = c;
    counters.push({ size: cells.length, at: [(best % GX + 0.5) * CELL, (((best / GX) | 0) + 0.5) * CELL] });
  }
  counters.sort((a, b) => b.size - a.size);
  return { solid, dist, counters };
}

// A* through the grid: free space preferred with clearance, crossing the letter allowed but costly
function route(G, from, to) {
  const { dist } = G;
  const key = ([x, y]) => Math.min(GY - 1, Math.max(0, Math.floor(y / CELL))) * GX + Math.min(GX - 1, Math.max(0, Math.floor(x / CELL)));
  const s = key(from), t = key(to);
  const tx = t % GX, ty = (t / GX) | 0;
  const g = new Float32Array(GX * GY).fill(1e9), prev = new Int32Array(GX * GY).fill(-1);
  const open = [[0, s]]; g[s] = 0;
  const lo = Math.floor(PAD / CELL) + 2, hiX = GX - lo - 1, hiY = GY - lo - 1;
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, k] = open.splice(bi, 1)[0];
    if (k === t) break;
    const i = k % GX, j = (k / GX) | 0;
    for (const [di, dj, w] of [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.41],[1,-1,1.41],[-1,1,1.41],[-1,-1,1.41]]) {
      const a = i + di, b = j + dj; if (a < lo || b < lo || a > hiX || b > hiY) continue;
      const n = b * GX + a;
      const dd = dist[n];
      const ex = (a + 0.5) * CELL, ey = (b + 0.5) * CELL;
      const edge = Math.min(ex - PAD, W - PAD - ex, ey - PAD, H - PAD - ey);
      const cost = w * (1 + (dd === 0 ? 3.2 : Math.max(0, 9 - dd) * 0.35) + Math.max(0, 11 - edge) * 0.45);
      if (g[k] + cost < g[n]) { g[n] = g[k] + cost; prev[n] = k; const h = Math.hypot(a - tx, b - ty); open.push([g[n] + h, n]); }
    }
  }
  const out = []; for (let k = t; k >= 0; k = prev[k]) { out.push([(k % GX + 0.5) * CELL, (((k / GX) | 0) + 0.5) * CELL]); if (k === s) break; }
  return out.reverse();
}

const simplify = (pts, eps) => { // Ramer–Douglas–Peucker
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]]; let idx = 0, md = 0;
  for (let i = 1; i < pts.length - 1; i++) { const p = pts[i];
    const d = Math.abs((b[1] - a[1]) * p[0] - (b[0] - a[0]) * p[1] + b[0] * a[1] - b[1] * a[0]) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1);
    if (d > md) { md = d; idx = i; } }
  if (md <= eps) return [a, b];
  return simplify(pts.slice(0, idx + 1), eps).slice(0, -1).concat(simplify(pts.slice(idx), eps));
};
const chaikin = (pts, n) => { for (let k = 0; k < n; k++) { const o = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) { const [a, b] = [pts[i], pts[i + 1]]; o.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]); }
  o.push(pts[pts.length - 1]); pts = o; } return pts; };

// ── the vine ───────────────────────────────────────────────────────────────
const leafD = L => { const w = L * 0.24; return `M0 0C${r(w*1.5)} ${r(-L*0.22)} ${r(w*1.1)} ${r(-L*0.78)} 0 ${r(-L)}C${r(-w*1.1)} ${r(-L*0.78)} ${r(-w*1.5)} ${r(-L*0.22)} 0 0Z`; };

function vine(G) {
  const freeAt = (x0, y0, x1, y1) => { // most open point in a region
    let best = null, bd = -1;
    for (let y = y0; y <= y1; y += CELL) for (let x = x0; x <= x1; x += CELL) {
      const k = Math.floor(y / CELL) * GX + Math.floor(x / CELL); if (G.dist[k] > bd) { bd = G.dist[k]; best = [x, y]; } }
    return best;
  };
  const S = [PAD + 7, H - PAD - 7], E = [W - PAD - 9, PAD + 12];
  // Waypoints that make the vine weave: through the largest counter if the letter has one,
  // otherwise across the letter to its most open flank and back
  const wps = [];
  if (G.counters.length && G.counters[0].size > 40) {
    wps.push(G.counters[0].at);
  } else {
    // a point on the letter's stroke nearest the centre line at a given height — the vine crosses there
    const strokeAt = y => { let best = null, bd = 1e9; const j = Math.floor(y / CELL);
      for (let i = 0; i < GX; i++) if (G.solid[j * GX + i]) { const dx = Math.abs((i + 0.5) * CELL - W / 2); if (dx < bd) { bd = dx; best = [(i + 0.5) * CELL, y]; } }
      return best; };
    const c1 = strokeAt(H * 0.66), c2 = strokeAt(H * 0.4);
    if (c1) wps.push(c1);
    wps.push(freeAt(W * 0.56, H * 0.45, W - PAD - 8, H * 0.72));
    if (c2) wps.push(c2);
    wps.push(freeAt(PAD + 8, H * 0.18, W * 0.44, H * 0.42));
  }
  let pts = [S];
  for (const p of [...wps, E]) pts = pts.concat(route(G, pts[pts.length - 1], p).slice(1));
  pts = chaikin(simplify(pts, 2.2), 4);

  // arc length and letter-overlap along the path
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = L[L.length - 1];
  const dAt = ([x, y]) => G.dist[Math.min(GY - 1, Math.max(0, Math.floor(y / CELL))) * GX + Math.min(GX - 1, Math.max(0, Math.floor(x / CELL)))];
  // crossings: runs of the path over the letter, alternately in front of and behind it
  const runs = []; let inRun = false;
  for (let i = 0; i < pts.length; i++) { const over = dAt(pts[i]) <= 1.6;
    if (over && !inRun) { runs.push([i, i]); inRun = true; } else if (over) runs[runs.length - 1][1] = i; else inRun = false; }
  const frontRuns = runs.filter((_, k) => k % 2 === 0).map(([a, b]) => [Math.max(0, a - 3), Math.min(pts.length - 1, b + 3)]);
  const isFront = i => frontRuns.some(([a, b]) => i >= a && i <= b);
  const poly = (a, b) => 'M' + pts.slice(a, b + 1).map(p => `${r(p[0])} ${r(p[1])}`).join('L');

  const back = [`<path d="${poly(0, pts.length - 1)}" fill="none" stroke="var(--ini-gold)" stroke-width="2.3" stroke-linecap="round"/>`];
  const front = [];
  for (const [a, b] of frontRuns) front.push(
    `<path d="${poly(a, b)}" fill="none" stroke="var(--ini-ground)" stroke-width="5.6" stroke-linecap="round"/>`,
    `<path d="${poly(a, b)}" fill="none" stroke="var(--ini-gold)" stroke-width="2.3" stroke-linecap="round"/>`);

  // leaves: alternate sides, tapering; skipped where they would sit on the letter or leave the frame
  const atS = s => { let i = 1; while (i < L.length - 1 && L[i] < s) i++; const [a, b] = [pts[i - 1], pts[i]]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const t = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, tx: (b[0] - a[0]) / l, ty: (b[1] - a[1]) / l, i }; };
  let side = 1, n = 0;
  for (let s = 7; s < total - 8; s += 6.2, side = -side, n++) {
    const p = atS(s); const t = s / total;
    const Lf = 13.5 - 6 * t;
    const ang = Math.atan2(p.tx, -p.ty) + side * 0.9;
    const tip = [p.x + Math.sin(ang) * Lf, p.y - Math.cos(ang) * Lf], mid = [p.x + Math.sin(ang) * Lf * 0.5, p.y - Math.cos(ang) * Lf * 0.5];
    const inFrame = ([x, y]) => x > PAD + 2 && x < W - PAD - 2 && y > PAD + 2 && y < H - PAD - 2;
    if (dAt(mid) < 2.4 || dAt(tip) < 1.4 || !inFrame(tip)) continue;
    const el = `<g transform="translate(${r(p.x)} ${r(p.y)}) rotate(${r(ang * 180 / Math.PI)})"><path d="${leafD(Lf)}" fill="var(--ini-gold)" fill-opacity="${side > 0 ? 1 : 0.84}" stroke="var(--ini-ground)" stroke-width=".9"/><path d="M0 ${r(-Lf*0.12)}L0 ${r(-Lf*0.8)}" stroke="var(--ini-ground)" stroke-opacity=".5" stroke-width=".75" stroke-linecap="round"/></g>`;
    (isFront(p.i) ? front : back).push(el);
    if (n % 5 === 2) { // berry on the opposite side
      const bx = p.x - Math.sin(ang) * 5.5, by = p.y + Math.cos(ang) * 5.5;
      if (dAt([bx, by]) > 2.5 && inFrame([bx, by])) back.push(`<circle cx="${r(bx)}" cy="${r(by)}" r="2" fill="var(--ini-gold)" stroke="var(--ini-ground)" stroke-width=".7"/>`);
    }
  }
  // tendril curl and terminal leaf at the top
  const e = atS(total - 0.5);
  back.push(`<g transform="translate(${r(e.x)} ${r(e.y)}) rotate(${r(Math.atan2(e.tx, -e.ty) * 180 / Math.PI)})"><path d="${leafD(9)}" fill="var(--ini-gold)" stroke="var(--ini-ground)" stroke-width=".8"/></g>`);
  // root: a small curl where the vine starts
  back.push(`<path d="M${S[0]} ${S[1]}c-1 4 3 7 6 5" fill="none" stroke="var(--ini-gold)" stroke-width="1.6" stroke-linecap="round"/>`);
  return { back: back.join(''), front: front.join(''), crossings: runs.length };
}

const out = {};
for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  const g = glyphFor(ch);
  const G = analyse(g.inside);
  const v = vine(G);
  out[ch] = { d: g.d, back: v.back, front: v.front };
  console.log(ch, 'counters', G.counters.length, 'crossings', v.crossings);
}
fs.writeFileSync(process.argv[3],
  `// Generated by scripts/generate-review-initials.js — Newsreader SemiBold (72pt optical size) capitals with a\n` +
  `// laurel vine planned around each letter's own shape. Coordinates are in a 120×160 frame.\n` +
  `export const INITIALS: Record<string, { d: string; back: string; front: string }> = ${JSON.stringify(out)};\n`);
