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
  /** Dance style for this heat — multi-heat rules apply per division *within* a style. */
  styleAbbrev?: string;
};

/**
 * ACDA heating guidance as warnings (not hard blocks — co-mingling is allowed when needed).
 * - Prefer one division per heat
 * - When a division needs multiple heats for the *same dance*, those heats must be contiguous,
 *   sizes differ by ≤1, and the smaller heat runs first
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

  // Multi-heat rules only within the same division + same dance style.
  const byDivisionStyle = new Map<string, HeatComposition[]>();
  for (const heat of sorted) {
    const style = heat.styleAbbrev?.trim() || "_";
    for (const divisionId of new Set(heat.divisionIds.filter(Boolean))) {
      const key = `${divisionId}::${style}`;
      const list = byDivisionStyle.get(key) ?? [];
      list.push(heat);
      byDivisionStyle.set(key, list);
    }
  }

  for (const [key, groupHeats] of byDivisionStyle) {
    if (groupHeats.length < 2) continue;
    const [divisionId, style] = key.split("::");
    const styleLabel = style && style !== "_" ? ` ${style}` : "";

    const numbers = groupHeats.map((heat) => heat.number).sort((a, b) => a - b);
    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] !== numbers[i - 1]! + 1) {
        warnings.push(
          `Division ${divisionId}${styleLabel}: multi-heat rounds should be contiguous (found heats ${numbers.join(", ")}).`,
        );
        break;
      }
    }

    const sizes = groupHeats.map((heat) => heat.size);
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    if (max - min > 1) {
      warnings.push(
        `Division ${divisionId}${styleLabel}: heat sizes differ by more than 1 (${sizes.join(", ")}).`,
      );
    }

    const ordered = [...groupHeats].sort((a, b) => a.number - b.number);
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i]!.size < ordered[i - 1]!.size) {
        warnings.push(
          `Division ${divisionId}${styleLabel}: when sizes differ, the smaller heat should run first (heat ${ordered[i - 1]!.number} has ${ordered[i - 1]!.size}, heat ${ordered[i]!.number} has ${ordered[i]!.size}).`,
        );
        break;
      }
    }
  }

  return warnings;
}
