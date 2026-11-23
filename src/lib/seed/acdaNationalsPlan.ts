/**
 * Heating plan inspired by ACDA National Championships 2026 on Country Scores.
 *
 * Within each dance: oldest age divisions first. Max 8 couples per heat.
 * Divisions with 6–8 couples get their own heat(s); smaller divisions are
 * co-mingled to fill heats (how most ACDA floors actually run).
 */
import { DANCE_STYLES } from "../dances";
import type { Scale } from "../scoring";

export const MAX_HEAT_SIZE = 8;
/** Own heat when a division has this many (or more) for a dance. */
export const SOLO_MIN = 6;
/** Soft target for Saturday Main Floor heat count. */
export const SATURDAY_HEAT_TARGET = 150;

export type DivisionPlan = {
  name: string;
  scale: Scale;
  ageRank: number;
  coupleCount: number;
  sessions: Array<"saturday" | "sundayAm" | "sundayPm">;
};

/** Nationals-style roster sized so packed Saturday heats land near ~150. */
export const NATIONALS_DIVISIONS: DivisionPlan[] = [
  { name: "Division IV", scale: "COUPLES", ageRank: 48, coupleCount: 6, sessions: ["saturday", "sundayPm"] },
  { name: "Division III", scale: "COUPLES", ageRank: 47, coupleCount: 7, sessions: ["saturday", "sundayPm"] },
  { name: "Division II", scale: "COUPLES", ageRank: 46, coupleCount: 8, sessions: ["saturday", "sundayPm"] },
  { name: "Open Role Division I", scale: "COUPLES", ageRank: 45, coupleCount: 5, sessions: ["saturday", "sundayPm"] },

  { name: "Female Platinum Advanced", scale: "PROAM", ageRank: 100, coupleCount: 2, sessions: ["saturday"] },
  { name: "Female Platinum Intermediate", scale: "PROAM", ageRank: 99, coupleCount: 3, sessions: ["saturday"] },
  { name: "Female Platinum Newcomer", scale: "PROAM", ageRank: 98, coupleCount: 5, sessions: ["saturday"] },
  { name: "Female Pearl Advanced", scale: "PROAM", ageRank: 90, coupleCount: 2, sessions: ["saturday"] },
  { name: "Female Pearl Newcomer", scale: "PROAM", ageRank: 88, coupleCount: 4, sessions: ["saturday"] },
  { name: "Female Gold Advanced", scale: "PROAM", ageRank: 80, coupleCount: 3, sessions: ["saturday"] },
  { name: "Female Gold Intermediate", scale: "PROAM", ageRank: 79, coupleCount: 5, sessions: ["saturday"] },
  { name: "Female Gold Newcomer", scale: "PROAM", ageRank: 78, coupleCount: 7, sessions: ["saturday"] },
  { name: "Female Silver Advanced", scale: "PROAM", ageRank: 70, coupleCount: 3, sessions: ["saturday"] },
  { name: "Female Silver Intermediate", scale: "PROAM", ageRank: 69, coupleCount: 4, sessions: ["saturday"] },
  { name: "Female Silver Newcomer", scale: "PROAM", ageRank: 68, coupleCount: 6, sessions: ["saturday"] },
  { name: "Female Copper Intermediate", scale: "PROAM", ageRank: 60, coupleCount: 3, sessions: ["saturday"] },
  { name: "Female Copper Newcomer", scale: "PROAM", ageRank: 58, coupleCount: 5, sessions: ["saturday"] },
  { name: "Female Bronze Intermediate", scale: "PROAM", ageRank: 49, coupleCount: 4, sessions: ["saturday"] },
  { name: "Female Bronze Newcomer", scale: "PROAM", ageRank: 48.5, coupleCount: 6, sessions: ["saturday"] },
  { name: "Female Open Intermediate", scale: "PROAM", ageRank: 40, coupleCount: 4, sessions: ["saturday", "sundayPm"] },
  { name: "Female Open Newcomer", scale: "PROAM", ageRank: 39, coupleCount: 5, sessions: ["saturday"] },
  { name: "Female Jr Teen Intermediate", scale: "PROAM", ageRank: 30, coupleCount: 3, sessions: ["saturday", "sundayAm"] },
  { name: "Female Jr Youth Newcomer", scale: "PROAM", ageRank: 19, coupleCount: 4, sessions: ["saturday", "sundayAm"] },
  { name: "Female Jr Primary Newcomer", scale: "PROAM", ageRank: 10, coupleCount: 3, sessions: ["sundayAm"] },

  { name: "Male Platinum Advanced", scale: "PROAM", ageRank: 100, coupleCount: 2, sessions: ["saturday"] },
  { name: "Male Platinum Newcomer", scale: "PROAM", ageRank: 98, coupleCount: 3, sessions: ["saturday"] },
  { name: "Male Gold Intermediate", scale: "PROAM", ageRank: 79, coupleCount: 3, sessions: ["saturday"] },
  { name: "Male Gold Newcomer", scale: "PROAM", ageRank: 78, coupleCount: 4, sessions: ["saturday"] },
  { name: "Male Silver Newcomer", scale: "PROAM", ageRank: 68, coupleCount: 4, sessions: ["saturday"] },
  { name: "Male Copper Newcomer", scale: "PROAM", ageRank: 58, coupleCount: 3, sessions: ["saturday"] },
  { name: "Male Open Intermediate", scale: "PROAM", ageRank: 40, coupleCount: 3, sessions: ["saturday", "sundayPm"] },
  { name: "Male Jr Youth Intermediate", scale: "PROAM", ageRank: 20, coupleCount: 3, sessions: ["sundayAm"] },
];

export const SESSION_META = {
  saturday: {
    name: "Saturday Main Floor",
    sortOrder: 1,
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
  const sizes = Array.from({ length: heats }, (_, i) => (i < heats - rem ? base : base + 1));
  return sizes.sort((a, b) => a - b);
}

const COUPLES_MEDALS = ["M", "B", "S", "G", "H", "GG"] as const;
const PROAM_MEDALS = ["M", "B", "S", "S+", "G", "G+", "H", "H+", "GG"] as const;

export function fakeMarks(
  scale: Scale,
  placeAmong: number,
  heatSize: number,
  judgeCount: number,
): Array<{ medal: string; placement: number | null }> {
  const medals = scale === "PROAM" ? PROAM_MEDALS : COUPLES_MEDALS;
  const medalIndex = Math.max(
    0,
    medals.length - 1 - Math.floor(((placeAmong - 1) / Math.max(heatSize, 1)) * (medals.length - 1)),
  );
  return Array.from({ length: judgeCount }, (_, j) => {
    const jitter = (j + placeAmong) % 3 === 0 ? Math.min(medals.length - 1, medalIndex + 1) : medalIndex;
    const medal = medals[jitter]!;
    if (scale === "PROAM") return { medal, placement: null };
    const placement = Math.min(heatSize, Math.max(1, placeAmong + ((j % 3) - 1)));
    return { medal, placement };
  });
}

export type PlannedHeatSlot = {
  divisionName: string;
  scale: Scale;
  ageRank: number;
  coupleIndexes: number[];
};

export type PlannedHeat = {
  number: number;
  styleAbbrev: string;
  styleName: string;
  /** One or more divisions co-mingled on this heat. */
  slots: PlannedHeatSlot[];
};

type Queue = {
  plan: DivisionPlan;
  remaining: number[];
};

function packDanceHeats(
  styleAbbrev: string,
  styleName: string,
  divisions: DivisionPlan[],
  startNumber: number,
): PlannedHeat[] {
  const queues: Queue[] = divisions.map((plan) => ({
    plan,
    remaining: Array.from({ length: plan.coupleCount }, (_, i) => i),
  }));

  const heats: PlannedHeat[] = [];
  let number = startNumber;

  const hasRemaining = () => queues.some((q) => q.remaining.length > 0);
  const firstWithRemaining = () => queues.find((q) => q.remaining.length > 0);

  while (hasRemaining()) {
    const head = firstWithRemaining()!;
    if (head.remaining.length >= SOLO_MIN) {
      const sizes = heatSizes(head.remaining.length, MAX_HEAT_SIZE);
      for (const size of sizes) {
        const coupleIndexes = head.remaining.splice(0, size);
        heats.push({
          number: number++,
          styleAbbrev,
          styleName,
          slots: [
            {
              divisionName: head.plan.name,
              scale: head.plan.scale,
              ageRank: head.plan.ageRank,
              coupleIndexes,
            },
          ],
        });
      }
      continue;
    }

    // Co-mingle small divisions (prefer same scale) until heat is full.
    const slots: PlannedHeatSlot[] = [];
    let filled = 0;
    const preferredScale = head.plan.scale;

    for (const queue of queues) {
      if (filled >= MAX_HEAT_SIZE) break;
      if (queue.remaining.length === 0) continue;
      // Don't pull from a solo-sized block into a mixed heat.
      if (queue.remaining.length >= SOLO_MIN) break;
      if (slots.length > 0 && queue.plan.scale !== preferredScale) continue;

      const take = Math.min(queue.remaining.length, MAX_HEAT_SIZE - filled);
      const coupleIndexes = queue.remaining.splice(0, take);
      slots.push({
        divisionName: queue.plan.name,
        scale: queue.plan.scale,
        ageRank: queue.plan.ageRank,
        coupleIndexes,
      });
      filled += take;
    }

    // If scale preference left the heat tiny, fill from any remaining small queues.
    if (filled < 3) {
      for (const queue of queues) {
        if (filled >= MAX_HEAT_SIZE) break;
        if (queue.remaining.length === 0 || queue.remaining.length >= SOLO_MIN) continue;
        const take = Math.min(queue.remaining.length, MAX_HEAT_SIZE - filled);
        const coupleIndexes = queue.remaining.splice(0, take);
        const existing = slots.find((s) => s.divisionName === queue.plan.name);
        if (existing) existing.coupleIndexes.push(...coupleIndexes);
        else {
          slots.push({
            divisionName: queue.plan.name,
            scale: queue.plan.scale,
            ageRank: queue.plan.ageRank,
            coupleIndexes,
          });
        }
        filled += take;
      }
    }

    if (slots.length === 0) break;
    heats.push({ number: number++, styleAbbrev, styleName, slots });
  }

  return heats;
}

/**
 * Build heat list for a session: dance floor order, age descending within dance,
 * co-mingled fills for small divisions.
 */
export function planSessionHeats(sessionKey: SessionKey): PlannedHeat[] {
  const meta = SESSION_META[sessionKey];
  const divisions = NATIONALS_DIVISIONS.filter((d) => d.sessions.includes(sessionKey)).sort(
    (a, b) => b.ageRank - a.ageRank || a.name.localeCompare(b.name),
  );

  const heats: PlannedHeat[] = [];
  for (const style of meta.dances) {
    const styleName = DANCE_STYLES.find((d) => d.abbrev === style)?.name ?? style;
    const packed = packDanceHeats(style, styleName, divisions, heats.length + 1);
    heats.push(...packed);
  }

  return heats;
}

/** Legacy single-division shape helpers for tests. */
export function heatCoupleCount(heat: PlannedHeat): number {
  return heat.slots.reduce((sum, slot) => sum + slot.coupleIndexes.length, 0);
}
