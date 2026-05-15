'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { OtherAwardsRow, LinkedNamesList, RichPicksHexBadge } from "@/components/award-icons";
import { formatNamesList } from "@/components/person-awards-browser";
import { ExpandableGuildNominees } from "@/components/expandable-guild-nominees";

function slugify(text: string) {
  return text.toString().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

type GroupedNom = {
  id: string;
  label: string;
  noms: any[];
};

type Props = {
  groupedNoms: GroupedNom[];
};

export function FilmAwardsBrowser({ groupedNoms }: Props) {
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
        <div className="text-center py-20 bg-card/20 rounded-2xl border border-dashed border-border">
          <p className="text-muted-foreground italic font-serif">
            {showOnlyRichPicks ? "No Rich Picks award data recorded for this film." : "No award data recorded for this film."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedGroups.map((group, groupIdx) => (
            <div 
              key={group.id} 
              className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col hover:border-accent/40 transition-colors animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
              style={{ animationDelay: `${groupIdx * 100}ms` }}
            >
              <div className="p-5 border-b border-border/50 flex items-center gap-3 bg-secondary/30">
                <h3 className="font-serif font-bold text-lg text-foreground/90">{group.label}</h3>
              </div>

              <div className="divide-y divide-border/30">
                {group.noms.map((nom: any) => {
                  const badges = nom.badges || {};
                  const isWon = nom.hasRichPick && nom.win;
                  const isFaint = !nom.hasRichPick;

                  return (
                    <div 
                      key={nom.nomination_id || `${nom.category_name}-${nom.year}`} 
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
                            <Link href={`/categories/${slugify(nom.category_name)}`} className="hover:underline">
                              {nom.category_name}
                            </Link>
                          </h4>
                        </div>
                        {nom.hasRichPick && (
                          <div className="flex-shrink-0">
                            <RichPicksHexBadge
                              isWon={isWon}
                              rpContext={nom.rpContext}
                              categoryName={nom.category_name}
                              currentFilm={nom.currentFilm}
                              peopleIds={nom.peopleIds}
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        {nom.song_title && (
                          <p className="text-base text-foreground font-serif italic mb-2">
                            "{nom.song_title}"
                          </p>
                        )}
                        
                        {(() => {
                          if (!nom.people || nom.people.length === 0) return null;
                          const isActingCategory =
                            nom.category_name.toLowerCase().includes('actor') ||
                            nom.category_name.toLowerCase().includes('actress') ||
                            nom.category_name.toLowerCase().includes('performance');

                          if (isActingCategory) {
                            return (
                              <div className="text-[13px] leading-snug">
                                <span className="text-foreground/90 font-medium"><LinkedNamesList people={nom.people} /></span>
                                {nom.people[0]?.role && <span className="text-muted-foreground block mt-1">as {nom.people[0].role}</span>}
                              </div>
                            );
                          }

                          let corePeople = nom.people;
                          let expandedPeople: any[] = [];
                          
                          const isGuildHeavyCategory = ["Effects", "Sound Editing", "Sound Mixing", "Art Direction", "Make-Up & Hairstyling", "Costuming"].includes(nom.category_name);

                          if (isGuildHeavyCategory && nom.people.length > 5) {
                             corePeople = [];
                             for (const p of nom.people) {
                                const hasCoreOrg = p.sources && p.sources.some((s: string) => 
                                    s.startsWith('Oscar:') || s.startsWith('BAFTA:') || s.startsWith('Rich Picks:') || s.startsWith('BFCA:') || s.startsWith('Globe:') ||
                                    s.includes('Outstanding Visual Effects in a ') || s.includes('Outstanding Supporting Visual Effects in a ')
                                );
                                if (hasCoreOrg) corePeople.push(p);
                                else expandedPeople.push(p);
                             }
                          }

                          const hasSomeRole = nom.people.some((p: any) => p.role);
                          if (!hasSomeRole) {
                            return (
                              <div className="flex flex-col gap-3 relative">
                                {corePeople.length > 0 && (
                                  <div className="text-[13px] leading-snug">
                                    <span className="text-foreground/90 font-medium"><LinkedNamesList people={corePeople} /></span>
                                  </div>
                                )}
                                {expandedPeople.length > 0 && (
                                   <ExpandableGuildNominees people={expandedPeople} hasCore={corePeople.length > 0} />
                                )}
                              </div>
                            );
                          }

                          // When no core people exist (e.g. pure guild categories like MPSE/CAS),
                          // use all people for role-based grouping instead of collapsing them.
                          const sourceForRoleGroups = corePeople.length > 0 ? corePeople : nom.people;
                          const remainingForExpand = corePeople.length > 0 ? expandedPeople : [];

                          const personRolesMap = new Map<number, { person: any; roles: string[] }>();
                          for (const p of sourceForRoleGroups as any[]) {
                            if (!personRolesMap.has(p.id)) {
                              personRolesMap.set(p.id, { person: p, roles: [] });
                            }
                            if (p.role && !personRolesMap.get(p.id)!.roles.includes(p.role)) {
                              personRolesMap.get(p.id)!.roles.push(p.role);
                            }
                          }

                          const combinedRoleGroups = new Map<string, any[]>();
                          for (const { person, roles } of Array.from(personRolesMap.values())) {
                            const combinedRole = roles.length > 0 ? roles.join(' & ') : 'Additional Nominees';
                            if (!combinedRoleGroups.has(combinedRole)) combinedRoleGroups.set(combinedRole, []);
                            combinedRoleGroups.get(combinedRole)!.push(person);
                          }

                          const sortedGroups = Array.from(combinedRoleGroups.entries()).sort(([a], [b]) => {
                            if (a === 'Additional Nominees') return 1;
                            if (b === 'Additional Nominees') return -1;
                            const aComplex = a.includes('&');
                            const bComplex = b.includes('&');
                            if (aComplex !== bComplex) return aComplex ? 1 : -1;
                            return a.localeCompare(b);
                          });

                          function pluralizeRole(role: string, count: number): string {
                            if (count <= 1 || role === 'Additional Nominees') return role;
                            if (role.includes(' & ')) {
                              return role.split(' & ').map(p => pluralizeRole(p, count)).join(' & ');
                            }
                            if (role.endsWith('s')) return role;
                            if (role === 'Story') return 'Story by';
                            if (role.endsWith('y') && !role.endsWith('ey')) return role.slice(0, -1) + 'ies';
                            return role + 's';
                          }

                          return (
                            <div className="flex flex-col gap-1.5 relative">
                              {sortedGroups.map(([roleLabel, peopleInGroup]) => (
                                <div key={roleLabel} className="text-[13px] leading-snug">
                                  <span className="text-foreground/70 font-medium mr-1.5">
                                    {pluralizeRole(roleLabel, peopleInGroup.length)}:
                                  </span>
                                  <span className="text-foreground/90 font-medium">
                                    <LinkedNamesList people={peopleInGroup} />
                                  </span>
                                </div>
                              ))}
                              {remainingForExpand.length > 0 && (
                                 <ExpandableGuildNominees people={remainingForExpand} hasCore={sourceForRoleGroups.length > 0} />
                              )}
                            </div>
                          );
                        })()}

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
