/**
 * Heating plan inspired by ACDA National Championships 2026 on Country Scores
 * (countrydancescores.com — 115 divisions / 2,147 entries).
 *
 * Floor order follows DANCE_STYLES. Within each dance style, heats run
 * oldest → youngest age divisions. Max 8 couples per heat.
 */
import { DANCE_STYLES } from "../dances";
import type { Scale } from "../scoring";

export const MAX_HEAT_SIZE = 8;

/** Higher = older; heats within a dance sort by this descending. */
export type DivisionPlan = {
  name: string;
  scale: Scale;
  /** Age rank: Platinum oldest … Jr Primary youngest. Couples Div use mid adult ranks. */
  ageRank: number;
  /** How many couples dance this division (will be split into ≤8 per heat). */
  coupleCount: number;
  /** Which session keys include this division. */
  sessions: Array<"saturday" | "sundayAm" | "sundayPm">;
};

/**
 * Subset of Country Scores ACDA Nationals division names, skewed to Couples + ProAm
 * that use our medal scales (line / showcase heavy divisions omitted from floor sessions).
 */
export const NATIONALS_DIVISIONS: DivisionPlan[] = [
  // Couples skill ladder (treated as adult-band ages for ordering among themselves)
  { name: "Division IV", scale: "COUPLES", ageRank: 48, coupleCount: 10, sessions: ["saturday", "sundayPm"] },
  { name: "Division III", scale: "COUPLES", ageRank: 47, coupleCount: 12, sessions: ["saturday", "sundayPm"] },
  { name: "Division II", scale: "COUPLES", ageRank: 46, coupleCount: 14, sessions: ["saturday", "sundayPm"] },
  { name: "Open Role Division I", scale: "COUPLES", ageRank: 45, coupleCount: 8, sessions: ["saturday", "sundayPm"] },

  // ProAm Female — oldest ages first
  { name: "Female Platinum Advanced", scale: "PROAM", ageRank: 100, coupleCount: 6, sessions: ["saturday"] },
  { name: "Female Platinum Intermediate", scale: "PROAM", ageRank: 99, coupleCount: 8, sessions: ["saturday"] },
  { name: "Female Platinum Newcomer", scale: "PROAM", ageRank: 98, coupleCount: 16, sessions: ["saturday"] },
  { name: "Female Pearl Advanced", scale: "PROAM", ageRank: 90, coupleCount: 5, sessions: ["saturday"] },
  { name: "Female Pearl Newcomer", scale: "PROAM", ageRank: 88, coupleCount: 7, sessions: ["saturday"] },
  { name: "Female Gold Advanced", scale: "PROAM", ageRank: 80, coupleCount: 9, sessions: ["saturday"] },
  { name: "Female Gold Intermediate", scale: "PROAM", ageRank: 79, coupleCount: 11, sessions: ["saturday"] },
  { name: "Female Gold Newcomer", scale: "PROAM", ageRank: 78, coupleCount: 16, sessions: ["saturday"] },
  { name: "Female Silver Advanced", scale: "PROAM", ageRank: 70, coupleCount: 8, sessions: ["saturday"] },
  { name: "Female Silver Intermediate", scale: "PROAM", ageRank: 69, coupleCount: 10, sessions: ["saturday"] },
  { name: "Female Silver Newcomer", scale: "PROAM", ageRank: 68, coupleCount: 14, sessions: ["saturday"] },
  { name: "Female Copper Intermediate", scale: "PROAM", ageRank: 60, coupleCount: 9, sessions: ["saturday"] },
  { name: "Female Copper Newcomer", scale: "PROAM", ageRank: 58, coupleCount: 12, sessions: ["saturday"] },
  { name: "Female Bronze Advanced", scale: "PROAM", ageRank: 50, coupleCount: 7, sessions: ["saturday"] },
  { name: "Female Bronze Intermediate", scale: "PROAM", ageRank: 49, coupleCount: 10, sessions: ["saturday"] },
  { name: "Female Bronze Newcomer", scale: "PROAM", ageRank: 48.5, coupleCount: 15, sessions: ["saturday"] },
  { name: "Female Open Intermediate", scale: "PROAM", ageRank: 40, coupleCount: 8, sessions: ["saturday", "sundayPm"] },
  { name: "Female Open Newcomer", scale: "PROAM", ageRank: 39, coupleCount: 12, sessions: ["saturday"] },
  { name: "Female Jr Teen Intermediate", scale: "PROAM", ageRank: 30, coupleCount: 6, sessions: ["saturday", "sundayAm"] },
  { name: "Female Jr Youth Intermediate", scale: "PROAM", ageRank: 20, coupleCount: 8, sessions: ["saturday", "sundayAm"] },
  { name: "Female Jr Youth Newcomer", scale: "PROAM", ageRank: 19, coupleCount: 10, sessions: ["saturday", "sundayAm"] },
  { name: "Female Jr Primary Newcomer", scale: "PROAM", ageRank: 10, coupleCount: 6, sessions: ["sundayAm"] },

  // ProAm Male — same age ladder
  { name: "Male Platinum Advanced", scale: "PROAM", ageRank: 100, coupleCount: 4, sessions: ["saturday"] },
  { name: "Male Platinum Newcomer", scale: "PROAM", ageRank: 98, coupleCount: 8, sessions: ["saturday"] },
  { name: "Male Gold Intermediate", scale: "PROAM", ageRank: 79, coupleCount: 7, sessions: ["saturday"] },
  { name: "Male Gold Newcomer", scale: "PROAM", ageRank: 78, coupleCount: 11, sessions: ["saturday"] },
  { name: "Male Silver Intermediate", scale: "PROAM", ageRank: 69, coupleCount: 6, sessions: ["saturday"] },
  { name: "Male Silver Newcomer", scale: "PROAM", ageRank: 68, coupleCount: 9, sessions: ["saturday"] },
  { name: "Male Copper Newcomer", scale: "PROAM", ageRank: 58, coupleCount: 8, sessions: ["saturday"] },
  { name: "Male Bronze Intermediate", scale: "PROAM", ageRank: 49, coupleCount: 5, sessions: ["saturday"] },
  { name: "Male Open Intermediate", scale: "PROAM", ageRank: 40, coupleCount: 7, sessions: ["saturday", "sundayPm"] },
  { name: "Male Jr Youth Intermediate", scale: "PROAM", ageRank: 20, coupleCount: 5, sessions: ["sundayAm"] },
];

export const SESSION_META = {
  saturday: {
    name: "Saturday Main Floor",
    sortOrder: 1,
    /** All 9 floor dances */
    dances: DANCE_STYLES.map((d) => d.abbrev),
  },
  sundayAm: {
    name: "Sunday Morning Youth",
    sortOrder: 2,
    dances: ["WLZ", "CHA", "2ST", "WCS"] as const,
  },
  sundayPm: {
    name: "Sunday Afternoon Finals",
    sortOrder: 3,
    dances: ["TR2", "WLZ", "ECS", "2ST", "WCS"] as const,
  },
} as const;

export type SessionKey = keyof typeof SESSION_META;

const FIRST = [
  "Alex", "Blake", "Casey", "Drew", "Eden", "Finley", "Gray", "Harper", "Indigo", "Jordan",
  "Kai", "Logan", "Morgan", "Noel", "Oakley", "Parker", "Quinn", "Reese", "Sage", "Tatum",
  "Uma", "Val", "Winter", "Xander", "Yael", "Zion", "Avery", "Brook", "Cameron", "Dana",
];
const LAST = [
  "Adams", "Baker", "Chen", "Diaz", "Evans", "Foster", "Garcia", "Hayes", "Ito", "Jones",
  "Kim", "Lee", "Morris", "Nguyen", "Ortiz", "Patel", "Quinn", "Rivera", "Singh", "Torres",
  "Underwood", "Vargas", "Walsh", "Xu", "Young", "Zimmerman", "Allen", "Brooks", "Cruz", "Dunn",
];

export function coupleName(seed: number): string {
  const a = FIRST[seed % FIRST.length]!;
  const b = LAST[(seed * 7) % LAST.length]!;
  const c = FIRST[(seed * 3 + 11) % FIRST.length]!;
  const d = LAST[(seed * 13 + 5) % LAST.length]!;
  return `${a.toUpperCase()} ${b.toUpperCase()} & ${c.toUpperCase()} ${d.toUpperCase()}`;
}

/** Split N into heat sizes ≤ max, differ by at most 1, smaller heat first (ACDA). */
export function heatSizes(count: number, max = MAX_HEAT_SIZE): number[] {
  if (count <= 0) return [];
  if (count <= max) return [count];
  const heats = Math.ceil(count / max);
  const base = Math.floor(count / heats);
  const rem = count % heats;
  // Smaller first when sizes differ
  const sizes = Array.from({ length: heats }, (_, i) => (i < heats - rem ? base : base + 1));
  return sizes.sort((a, b) => a - b);
}

const COUPLES_MEDALS = ["M", "B", "S", "G", "H", "GG"] as const;
const PROAM_MEDALS = ["M", "B", "S", "S+", "G", "G+", "H", "H+", "GG"] as const;

/** Deterministic fake marks for a heat entry across 5 judges. */
export function fakeMarks(
  scale: Scale,
  placeAmong: number,
  heatSize: number,
  judgeCount: number,
): Array<{ medal: string; placement: number | null }> {
  const medals = scale === "PROAM" ? PROAM_MEDALS : COUPLES_MEDALS;
  // Better place → higher medal band
  const medalIndex = Math.max(
    0,
    medals.length - 1 - Math.floor(((placeAmong - 1) / Math.max(heatSize, 1)) * (medals.length - 1)),
  );
  return Array.from({ length: judgeCount }, (_, j) => {
    const jitter = (j + placeAmong) % 3 === 0 ? Math.min(medals.length - 1, medalIndex + 1) : medalIndex;
    const medal = medals[jitter]!;
    if (scale === "PROAM") {
      return { medal, placement: null };
    }
    // Couples: slight judge disagreement around true place
    const placement = Math.min(heatSize, Math.max(1, placeAmong + ((j % 3) - 1)));
    return { medal, placement };
  });
}

export type PlannedHeat = {
  number: number;
  styleAbbrev: string;
  styleName: string;
  divisionName: string;
  scale: Scale;
  ageRank: number;
  /** Couple indices 0..coupleCount-1 within that division */
  coupleIndexes: number[];
};

/**
 * Build heat list for a session: by dance floor order, then age descending,
 * splitting large divisions into ≤8-couple heats.
 */
export function planSessionHeats(sessionKey: SessionKey): PlannedHeat[] {
  const meta = SESSION_META[sessionKey];
  const divisions = NATIONALS_DIVISIONS.filter((d) => d.sessions.includes(sessionKey)).sort(
    (a, b) => b.ageRank - a.ageRank || a.name.localeCompare(b.name),
  );

  const heats: PlannedHeat[] = [];
  let number = 1;

  for (const style of meta.dances) {
    const styleName = DANCE_STYLES.find((d) => d.abbrev === style)?.name ?? style;
    for (const div of divisions) {
      const sizes = heatSizes(div.coupleCount, MAX_HEAT_SIZE);
      let offset = 0;
      for (const size of sizes) {
        const coupleIndexes = Array.from({ length: size }, (_, i) => offset + i);
        offset += size;
        heats.push({
          number: number++,
          styleAbbrev: style,
          styleName,
          divisionName: div.name,
          scale: div.scale,
          ageRank: div.ageRank,
          coupleIndexes,
        });
      }
    }
  }

  return heats;
}
