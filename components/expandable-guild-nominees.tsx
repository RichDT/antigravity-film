'use client';

import React from 'react';
import Link from 'next/link';

function LinkedNamesList({ people }: { people: any[] }) {
  if (!people || people.length === 0) return null;
  return (
    <>
      {people.map((p, i) => {
        const canonicalName = p.is_inverted
          ? `${p.name.split(' ').slice(1).join(' ')} ${p.name.split(' ')[0]}`
          : p.name;
          
        return (
          <React.Fragment key={p.id}>
            <Link 
              href={`/person/${p.id}`} 
              className="hover:text-accent transition-colors hover:underline"
            >
              {canonicalName}
            </Link>
            {i < people.length - 1 ? (i === people.length - 2 ? ', and ' : ', ') : ''}
          </React.Fragment>
        );
      })}
    </>
  );
}

export function ExpandableGuildNominees({ people, hasCore = true }: { people: any[], hasCore?: boolean }) {
  // Group people by their specific Guild categories (sources)
  // A single person might have multiple sources.
  const sourceGroups = new Map<string, any[]>();
  
  for (const person of people) {
    if (person.sources && person.sources.length > 0) {
      for (const source of person.sources) {
        // filter out core orgs from the detailed breakdown if they somehow leaked through
        if (source.startsWith('Oscar:') || source.startsWith('BAFTA:') || source.startsWith('Rich Picks:') || source.startsWith('BFCA:') || source.startsWith('Globe:')) {
          continue;
        }
        if (!sourceGroups.has(source)) sourceGroups.set(source, []);
        // Avoid duplicating the same person in the exact same source
        if (!sourceGroups.get(source)!.some(p => p.id === person.id)) {
           sourceGroups.get(source)!.push(person);
        }
      }
    } else {
      // Fallback if no sources mapped
      const unk = "Additional Guild Nominees";
      if (!sourceGroups.has(unk)) sourceGroups.set(unk, []);
      sourceGroups.get(unk)!.push(person);
    }
  }

  const sortedGroups = Array.from(sourceGroups.entries()).sort(([a], [b]) => a.localeCompare(b));

  // Count unique people
  const uniqueCount = new Set(people.map(p => p.id)).size;

  return (
    <details className="mt-4 group cursor-pointer">
      <summary className="text-[12px] font-semibold text-accent/80 hover:text-accent tracking-wider uppercase list-none flex items-center gap-2 select-none">
        <span className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center transition-transform group-open:rotate-90">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </span>
        {hasCore ? `...and ${uniqueCount} others` : `${uniqueCount} Nominees`}
      </summary>
      
      <div className="pt-4 pl-6 flex flex-col gap-3 border-l-2 border-accent/10 ml-2 mt-2 animate-in fade-in slide-in-from-top-2">
        {sortedGroups.map(([sourceLabel, members]) => {
          // split "VES: Outstanding..." into Org and Category
          const parts = sourceLabel.split(': ');
          const org = parts[0];
          const cat = parts.slice(1).join(': ');
          
          return (
            <div key={sourceLabel} className="text-[13px] leading-snug">
              <span className="text-muted-foreground block mb-0.5 text-[11px] font-semibold uppercase tracking-wider">
                <span className="text-foreground/50">{org} </span>
                {cat}
              </span>
              <span className="text-foreground/80 font-medium">
                <LinkedNamesList people={members} />
              </span>
            </div>
          );
        })}
      </div>
    </details>
  );
}
