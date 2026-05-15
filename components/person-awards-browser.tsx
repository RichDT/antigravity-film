'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { OtherAwardsRow, RichPicksHexBadge } from "@/components/award-icons";

function slugify(text: string) {
  return text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

export function formatNamesList(people: { name: string, lastName?: string }[]): string {
    if (!people || people.length === 0) return "";
    const uniquePeopleMap = new Map<string, any>();
    people.forEach(p => uniquePeopleMap.set(p.name, p));
    const uniquePeople = Array.from(uniquePeopleMap.values());
    const sortedPeople = [...uniquePeople].sort((a, b) => {
        const aLast = (a.lastName || a.name.trim().split(/\s+/).pop() || '').toLowerCase();
        const bLast = (b.lastName || b.name.trim().split(/\s+/).pop() || '').toLowerCase();
        return aLast.localeCompare(bLast);
    });
    const names = sortedPeople.map(p => p.name);
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

type GroupedNom = {
  id: string;
  label: string;
  noms: any[];
};

type Props = {
  groupedNoms: GroupedNom[];
};

export function PersonAwardsBrowser({ groupedNoms }: Props) {
  const [showOnlyRichPicks, setShowOnlyRichPicks] = useState(false);

  // Filter logic
  const displayedGroups = groupedNoms.map(group => {
    return {
      ...group,
      noms: showOnlyRichPicks 
        ? group.noms.filter(nom => nom.hasRichPick)
        : group.noms
    };
  }).filter(group => group.noms.length > 0);

  return (
    <div>
      {/* Toggle Controls */}
      <div className="flex items-center justify-end mb-6">
        <label className="flex items-center gap-2 cursor-pointer group">
          <span className={`text-sm font-medium transition-colors ${showOnlyRichPicks ? 'text-muted-foreground' : 'text-foreground'}`}>All Guilds</span>
          <div className="relative inline-flex items-center h-6 rounded-full w-11 bg-secondary border border-border shadow-inner transition-colors focus-within:ring-2 focus-within:ring-accent/50">
            <input 
              type="checkbox" 
              className="sr-only peer"
              checked={showOnlyRichPicks}
              onChange={(e) => setShowOnlyRichPicks(e.target.checked)}
            />
            <span className={`inline-block w-4 h-4 transform bg-accent rounded-full transition-transform duration-200 ease-in-out ${showOnlyRichPicks ? 'translate-x-6' : 'translate-x-1'}`} />
          </div>
          <span className={`text-sm font-medium transition-colors ${showOnlyRichPicks ? 'text-foreground' : 'text-muted-foreground'}`}>Rich Picks Only</span>
        </label>
      </div>

      {displayedGroups.length === 0 ? (
        <p className="text-muted-foreground italic bg-secondary/20 p-6 rounded-2xl border border-border">
          {showOnlyRichPicks ? "No Rich Picks nominations found." : "No nominations found."}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
          {displayedGroups.map((group, groupIdx) => (
            <div 
              key={group.id} 
              className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col hover:border-accent/40 transition-colors animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
              style={{ animationDelay: `${groupIdx * 100}ms` }}
            >
              {/* Group Header */}
              <div className="p-5 border-b border-border/50 flex items-center gap-3 bg-secondary/30">
                <h3 className="font-serif font-bold text-lg text-foreground/90">{group.label}</h3>
              </div>

              {/* Nominees List */}
              <div className="divide-y divide-border/30">
                {group.noms.map((nom: any) => {
                  const badges = nom.badges || {};
                  const isWon = nom.win;
                  const isFaint = !nom.hasRichPick;

                  return (
                    <div 
                      key={nom.nomination_id || nom.film_id + nom.category_name} 
                      className={`p-5 group/item transition-all duration-300 ${isWon ? 'bg-accent/10' : 'hover:bg-secondary/20'} ${isFaint ? 'opacity-60 hover:opacity-100 saturate-[0.6] hover:saturate-100' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Link href={`/year/${nom.year}`} className="text-[10px] font-bold tracking-widest uppercase text-accent/80 hover:underline">
                              {nom.year}
                            </Link>
                          </div>
                          <h4 className={`font-serif text-lg leading-tight transition-colors ${isWon ? 'text-accent font-bold' : 'text-foreground font-medium'}`}>
                            {nom.hasRichPick ? (
                              <Link href={`/categories/${slugify(nom.category_name)}`} className="hover:underline">
                                {nom.category_name}
                              </Link>
                            ) : nom.category_name}
                          </h4>
                        </div>
                        <div className="flex-shrink-0">
                          {nom.hasRichPick && (
                            <RichPicksHexBadge
                              isWon={isWon}
                              rpContext={nom.rpContext}
                              categoryName={nom.category_name}
                              currentFilm={nom.currentFilm}
                              peopleIds={nom.peopleIds}
                            />
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        {nom.song_title && (
                          <p className="text-base text-foreground font-serif italic mb-2">
                            "{nom.song_title}"
                          </p>
                        )}
                        
                        <div className="text-[13px] leading-snug">
                          <Link href={`/film/${nom.film_id}`} className="text-foreground/90 font-medium hover:text-accent transition-colors block">
                            {nom.film_title}
                          </Link>
                          {nom.character_role && (
                            <span className="text-muted-foreground block mt-1">as {nom.character_role}</span>
                          )}
                        </div>

                        {nom.sourcedFromSagCast && (
                          <p className="text-[11px] text-muted-foreground italic">
                            Appears due to SAG Cast in a Motion Picture nomination
                          </p>
                        )}

                        <div className="flex items-center justify-end pt-3 mt-1 border-t border-border/20">
                          <OtherAwardsRow
                            awards={badges}
                            categoryName={nom.category_name}
                            categoryGroup={group.id}
                            awardContexts={nom.awardContexts}
                            currentFilm={nom.currentFilm}
                            peopleIds={nom.peopleIds}
                          />
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
