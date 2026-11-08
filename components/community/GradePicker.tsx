'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getGradeColor } from '@/components/grade-hex';
import { GRADE_SCALE, QUALITY_LEVELS } from '@/lib/community';

const LETTERS = ['A', 'B', 'C', 'D', 'F'] as const;
const letterOf = (g: string) => g[0];
// Fill colours for the rail's SVG markers (match getGradeColor's background classes)
const MARKER: Record<string, string> = { A: '#059669', B: '#0284c7', C: '#f59e0b', D: '#ea580c', F: '#dc2626' };

/** The stops on the refinement rail for a letter: its own grades plus the splits into the neighbouring letters. */
function railFor(letter: string) {
  return GRADE_SCALE.map((g, i) => ({ g, i })).filter(({ g }) => g.split('//').some(p => p[0] === letter));
}

export function GradeHexLarge({ grade, className = 'w-12 h-[3.35rem]' }: { grade: string; className?: string }) {
  const split = grade.includes('//');
  const [hi, lo] = grade.split('//');
  return (
    <div className={`${className} clip-hexagon flex items-center justify-center font-serif font-bold ${getGradeColor(grade)}`} aria-label={`Grade ${grade.replace('//', ' / ')}`}>
      {split ? (
        <span className="flex flex-col items-center leading-none text-[12px]">
          {hi}<span className="w-6 h-px bg-current opacity-80 my-[3px]" />{lo}
        </span>
      ) : <span className="text-[17px]">{grade}</span>}
    </div>
  );
}

/**
 * Grade picker on Rich's full scale (25 steps, including split grades like B//B-):
 * choose a quality level (letter), then refine on an ordered rail, with half-step arrows.
 */
export function GradePicker({ value, onChange, onClear }: { value: string | null; onChange: (grade: string) => void; onClear?: () => void }) {
  const idx = value ? GRADE_SCALE.indexOf(value as (typeof GRADE_SCALE)[number]) : -1;
  const current = idx >= 0 ? GRADE_SCALE[idx] : null;
  const letter = current ? letterOf(current) : null;
  const stops = letter ? railFor(letter) : [];
  const step = (d: number) => { if (idx < 0) return; onChange(GRADE_SCALE[Math.min(GRADE_SCALE.length - 1, Math.max(0, idx + d))]); };
  const X = (j: number) => 12 + (j * 216) / Math.max(1, stops.length - 1);

  return (
    <div className="rounded-lg border border-border bg-background/30 p-3.5 max-w-sm">
      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground mb-2">Quality level</p>
      <div className="flex justify-between" role="radiogroup" aria-label="Quality level">
        {LETTERS.map(L => {
          const on = L === letter;
          return (
            <button key={L} type="button" role="radio" aria-checked={on} aria-label={`${L}, ${QUALITY_LEVELS[L]}`}
              onClick={() => onChange(L)} className="flex flex-col items-center gap-1.5 w-14 group">
              <span className={`w-11 h-12 clip-hexagon flex items-center justify-center font-serif font-bold text-base transition-transform group-hover:scale-105 ${on ? getGradeColor(L) : 'bg-secondary text-foreground/85'}`}>{L}</span>
              <span className={`text-[11px] ${on ? 'text-primary' : 'text-muted-foreground'}`}>{QUALITY_LEVELS[L]}</span>
            </button>
          );
        })}
      </div>

      {current ? (
        <>
          <div className="mt-4 pt-3 border-t border-border/70">
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground mb-2">Refinement</p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => step(-1)} disabled={idx === 0} aria-label="Half step higher"
                className="w-8 h-8 shrink-0 rounded-full border border-border bg-secondary/60 text-foreground/85 hover:border-primary hover:text-primary disabled:opacity-30 flex items-center justify-center">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <svg viewBox="0 0 240 58" className="flex-1 h-[58px] overflow-visible" role="radiogroup" aria-label="Refinement">
                <line x1="12" y1="20" x2="228" y2="20" stroke="var(--border)" strokeWidth="1.2" />
                {stops.map(({ g, i }, j) => {
                  const x = X(j), split = g.includes('//'), on = i === idx, fill = MARKER[letterOf(g)];
                  return (
                    <g key={g} role="radio" aria-checked={on} aria-label={g.replace('//', ' / ')} tabIndex={0} className="cursor-pointer outline-none"
                      onClick={() => onChange(g)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(g); } }}>
                      <rect x={x - 14} y="0" width="28" height="56" fill="transparent" />
                      {on && <rect x={x - 15} y="5" width="30" height="48" rx="9" fill="var(--primary)" fillOpacity=".12" stroke="var(--primary)" strokeOpacity=".75" strokeWidth="1.1" />}
                      {split
                        ? <circle cx={x} cy="20" r={on ? 4 : 3.2} fill={on ? fill : 'var(--card)'} stroke={on ? fill : 'var(--muted-foreground)'} strokeWidth="1" />
                        : <polygon points={`${x},12 ${x + 7},16 ${x + 7},24 ${x},28 ${x - 7},24 ${x - 7},16`} fill={on ? fill : 'var(--secondary)'} stroke={on ? fill : 'var(--muted-foreground)'} strokeWidth=".8" />}
                      <text x={x} y="44" textAnchor="middle" className="font-serif" fontSize={split ? 10 : 12}
                        fill={on ? 'var(--primary)' : split ? 'var(--muted-foreground)' : 'var(--foreground)'} fillOpacity={split && !on ? 0.8 : 1}>
                        {g.replace('//', '/')}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <button type="button" onClick={() => step(1)} disabled={idx === GRADE_SCALE.length - 1} aria-label="Half step lower"
                className="w-8 h-8 shrink-0 rounded-full border border-border bg-secondary/60 text-foreground/85 hover:border-primary hover:text-primary disabled:opacity-30 flex items-center justify-center">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground px-10 -mt-0.5"><span>← higher</span><span>lower →</span></div>
          </div>
          <div className="mt-3.5 pt-3 border-t border-border/70 flex flex-col items-center gap-1.5">
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Your grade</p>
            <GradeHexLarge grade={current} />
            {onClear && <button type="button" onClick={onClear} className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">Clear grade</button>}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground text-center mt-3">Choose a quality level to refine your grade</p>
      )}
    </div>
  );
}
