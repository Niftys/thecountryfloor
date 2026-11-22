/** Floor order: one heat = one song = one style. Multiple divisions may share a heat. */
export const DANCE_STYLES = [
  { name: "Triple Two", abbrev: "TR2" },
  { name: "Nightclub", abbrev: "NC2" },
  { name: "Waltz", abbrev: "WLZ" },
  { name: "Polka", abbrev: "PLK" },
  { name: "Cha Cha", abbrev: "CHA" },
  { name: "East Coast Swing", abbrev: "ECS" },
  { name: "Two Step", abbrev: "2ST" },
  { name: "West Coast Swing", abbrev: "WCS" },
] as const;

export type DanceAbbrev = (typeof DANCE_STYLES)[number]["abbrev"];

const byAbbrev = new Map(DANCE_STYLES.map((dance, index) => [dance.abbrev, { ...dance, order: index + 1 }]));

export function danceOrder(abbrev: string): number {
  return byAbbrev.get(abbrev as DanceAbbrev)?.order ?? 999;
}

export function danceName(abbrev: string): string {
  return byAbbrev.get(abbrev as DanceAbbrev)?.name ?? abbrev;
}

/** Every entry in a heat must be the same style (abbrev). */
export function heatStyleConflict(abbrevs: string[]): string | null {
  const unique = [...new Set(abbrevs.filter(Boolean))];
  if (unique.length <= 1) return null;
  return `A heat is one song. Mixed styles are not allowed: ${unique.join(", ")}.`;
}
