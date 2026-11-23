/** Floor order: one heat = one song = one style. Multiple divisions may share a heat. */
export const DANCE_STYLES = [
  { name: "Triple Two", abbrev: "TR2" },
  { name: "Nightclub", abbrev: "NC2" },
  { name: "Viennese Waltz", abbrev: "VWZ" },
  { name: "Waltz", abbrev: "WLZ" },
  { name: "Polka", abbrev: "PLK" },
  { name: "Cha Cha", abbrev: "CHA" },
  { name: "East Coast Swing", abbrev: "ECS" },
  { name: "Two Step", abbrev: "2ST" },
  { name: "West Coast Swing", abbrev: "WCS" },
] as const;

export type DanceAbbrev = (typeof DANCE_STYLES)[number]["abbrev"];

const byAbbrev = new Map(
  DANCE_STYLES.map((dance, index) => [dance.abbrev, { ...dance, order: index + 1 }]),
);

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

export type HeatComposition = {
  number: number;
  /** Stable division ids (or names) on this heat. */
  divisionIds: string[];
  /** Entrant count for balancing checks. */
  size: number;
};

/**
 * ACDA heating guidance as warnings (not hard blocks — co-mingling is allowed when needed).
 * - Prefer one division per heat
 * - Multi-heat divisions: contiguous, sizes differ by ≤1, smaller heat first when sizes differ
 */
export function heatingWarnings(heats: HeatComposition[]): string[] {
  const warnings: string[] = [];
  const sorted = [...heats].sort((a, b) => a.number - b.number);

  for (const heat of sorted) {
    const divisions = [...new Set(heat.divisionIds.filter(Boolean))];
    if (divisions.length > 1) {
      warnings.push(
        `Heat ${heat.number} co-mingles ${divisions.length} divisions (allowed only when time requires).`,
      );
    }
  }

  const byDivision = new Map<string, HeatComposition[]>();
  for (const heat of sorted) {
    for (const divisionId of new Set(heat.divisionIds.filter(Boolean))) {
      const list = byDivision.get(divisionId) ?? [];
      list.push(heat);
      byDivision.set(divisionId, list);
    }
  }

  for (const [divisionId, divisionHeats] of byDivision) {
    if (divisionHeats.length < 2) continue;
    const numbers = divisionHeats.map((heat) => heat.number).sort((a, b) => a - b);
    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] !== numbers[i - 1] + 1) {
        warnings.push(
          `Division ${divisionId}: multi-heat rounds should be contiguous (found heats ${numbers.join(", ")}).`,
        );
        break;
      }
    }

    const sizes = divisionHeats.map((heat) => heat.size);
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    if (max - min > 1) {
      warnings.push(
        `Division ${divisionId}: heat sizes differ by more than 1 (${sizes.join(", ")}).`,
      );
    }

    const ordered = [...divisionHeats].sort((a, b) => a.number - b.number);
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i].size < ordered[i - 1].size) {
        warnings.push(
          `Division ${divisionId}: when sizes differ, the smaller heat should run first (heat ${ordered[i - 1].number} has ${ordered[i - 1].size}, heat ${ordered[i].number} has ${ordered[i].size}).`,
        );
        break;
      }
    }
  }

  return warnings;
}
