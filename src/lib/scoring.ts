export type Scale = "PROAM" | "COUPLES";

export const PROAM_SCALE = ["M", "B", "S", "S+", "G", "G+", "H", "H+", "GG"] as const;
export const COUPLES_SCALE = ["M", "B", "S", "G", "H", "GG"] as const;

export const OUTLIER_STEPS = 2;

export function scaleMedals(scale: Scale): readonly string[] {
  return scale === "PROAM" ? PROAM_SCALE : COUPLES_SCALE;
}

/** GG is 1. Lower points are better. */
export function medalPoints(medal: string, scale: Scale): number {
  const list = scaleMedals(scale);
  const index = list.indexOf(medal);
  if (index < 0) {
    throw new Error(`Unknown ${scale} medal: ${medal}`);
  }
  return list.length - index;
}

export function medalFromPoints(points: number, scale: Scale): string {
  const list = scaleMedals(scale);
  const medal = list[list.length - points];
  if (!medal) {
    throw new Error(`No ${scale} medal for ${points} points`);
  }
  return medal;
}

export type MarkInput = {
  judgeId: string;
  placement: number;
  medal: string;
};

export type CoupleInput = {
  id: string;
  marks: MarkInput[];
};

export type CoupleBreakdown = {
  id: string;
  ordered: number[];
  mark: number;
  size: number;
  sum: number;
  lookAhead: number[];
  lookBack: number[];
  place: number;
  medal: string;
  medalPoints: number;
};

export function dash(values: number[]): string {
  return values.join("-");
}

/**
 * Middle mark after sorting best to worst.
 * 5 judges → index 2 (3rd). 6 judges → index 3 (4th). 7 judges → index 3 (4th).
 */
export function majorityIndex(count: number): number {
  return Math.floor(count / 2);
}

export function analyze(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b);
  const mid = majorityIndex(ordered.length);
  const mark = ordered[mid];
  const left = ordered.slice(0, mid);
  const right = ordered.slice(mid + 1);
  const size = right.filter((value) => value > mark).length;
  const sum = left.reduce((total, value) => total + value, 0);
  return { ordered, mark, size, sum, lookAhead: right, lookBack: left };
}

function compareSide(a: number[], b: number[]): number {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const av = a[i] ?? Number.POSITIVE_INFINITY;
    const bv = b[i] ?? Number.POSITIVE_INFINITY;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function headToHead(a: MarkInput[], b: MarkInput[]): number {
  const bByJudge = new Map(b.map((mark) => [mark.judgeId, mark.placement]));
  let aWins = 0;
  let bWins = 0;
  for (const mark of a) {
    const other = bByJudge.get(mark.judgeId);
    if (other == null) continue;
    if (mark.placement < other) aWins += 1;
    else if (other < mark.placement) bWins += 1;
  }
  return aWins - bWins;
}

function compareCouples(a: CoupleInput, b: CoupleInput): number {
  const aPlaces = analyze(a.marks.map((mark) => mark.placement));
  const bPlaces = analyze(b.marks.map((mark) => mark.placement));
  if (aPlaces.mark !== bPlaces.mark) return aPlaces.mark - bPlaces.mark;
  if (aPlaces.size !== bPlaces.size) return aPlaces.size - bPlaces.size;
  if (aPlaces.sum !== bPlaces.sum) return aPlaces.sum - bPlaces.sum;
  const ahead = compareSide(aPlaces.lookAhead, bPlaces.lookAhead);
  if (ahead !== 0) return ahead;
  const behind = compareSide(aPlaces.lookBack, bPlaces.lookBack);
  if (behind !== 0) return behind;
  return -headToHead(a.marks, b.marks);
}

export function requiresPlacement(scale: Scale): boolean {
  return scale === "COUPLES";
}

export type MedalPlaceRow = {
  bib: number;
  medal: string;
  placement: number;
};

/**
 * Better medal must get a better (lower) place.
 * Same medal may be split (H 1 and H 2). GG 2 with H 1 is illegal.
 */
export function medalPlacementConflict(
  rows: MedalPlaceRow[],
  scale: Scale,
): string | null {
  if (!requiresPlacement(scale) || rows.length < 2) return null;

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      const aPoints = medalPoints(a.medal, scale);
      const bPoints = medalPoints(b.medal, scale);
      if (aPoints === bPoints) continue;
      if (aPoints < bPoints && a.placement >= b.placement) {
        return `Bib ${a.bib} (${a.medal} ${a.placement}) cannot place behind bib ${b.bib} (${b.medal} ${b.placement}). Higher medals must place higher.`;
      }
      if (bPoints < aPoints && b.placement >= a.placement) {
        return `Bib ${b.bib} (${b.medal} ${b.placement}) cannot place behind bib ${a.bib} (${a.medal} ${a.placement}). Higher medals must place higher.`;
      }
    }
  }
  return null;
}

/** ProAm ranks on medal points; Couples ranks on judge placements. */
export function rankDance(couples: CoupleInput[], scale: Scale): CoupleBreakdown[] {
  const prepared =
    scale === "PROAM"
      ? couples.map((couple) => ({
          id: couple.id,
          marks: couple.marks.map((mark) => ({
            judgeId: mark.judgeId,
            medal: mark.medal,
            placement: medalPoints(mark.medal, scale),
          })),
        }))
      : couples;

  const ranked = prepared.filter((couple) => couple.marks.length > 0);
  ranked.sort((a, b) => compareCouples(a, b) || a.id.localeCompare(b.id));

  const places = new Map<string, number>();
  let place = 1;
  for (let i = 0; i < ranked.length; i++) {
    if (i > 0 && compareCouples(ranked[i - 1], ranked[i]) !== 0) {
      place = i + 1;
    }
    places.set(ranked[i].id, place);
  }

  return ranked.map((couple) => {
    const placements = analyze(couple.marks.map((mark) => mark.placement));
    const medals = analyze(couple.marks.map((mark) => medalPoints(mark.medal, scale)));
    return {
      id: couple.id,
      ordered: placements.ordered,
      mark: placements.mark,
      size: placements.size,
      sum: placements.sum,
      lookAhead: placements.lookAhead,
      lookBack: placements.lookBack,
      place: places.get(couple.id) ?? 0,
      medal: medalFromPoints(medals.mark, scale),
      medalPoints: medals.mark,
    };
  });
}

/** Sum of the best `count` dance places. Missed dances are omitted. */
export function rule9Total(places: Array<number | null>, count: number): number {
  const danced = places.filter((place): place is number => typeof place === "number" && place > 0);
  danced.sort((a, b) => a - b);
  return danced.slice(0, count).reduce((total, place) => total + place, 0);
}

export function rankTotals(rows: { id: string; total: number }[]) {
  const sorted = [...rows].sort((a, b) => a.total - b.total || a.id.localeCompare(b.id));
  let place = 1;
  return sorted.map((row, index) => {
    if (index > 0 && row.total !== sorted[index - 1].total) {
      place = index + 1;
    }
    return { ...row, place };
  });
}

/** Rule 10: among Rule 9 ties, head-to-head on shared dance places. Lower losses win. */
export function rule10Compare(
  aPlaces: Array<number | null>,
  bPlaces: Array<number | null>,
): number {
  let aWins = 0;
  let bWins = 0;
  let ties = 0;
  const n = Math.max(aPlaces.length, bPlaces.length);
  for (let i = 0; i < n; i++) {
    const ap = aPlaces[i];
    const bp = bPlaces[i];
    if (ap == null || ap <= 0 || bp == null || bp <= 0) continue;
    if (ap < bp) aWins += 1;
    else if (bp < ap) bWins += 1;
    else ties += 1;
  }
  const aLoss = bWins + ties * 0.5;
  const bLoss = aWins + ties * 0.5;
  return aLoss - bLoss;
}

/** Rule 11: sum of judge placement marks across shared dances (lower better). */
export function rule11Compare(aJudgePlaces: number[], bJudgePlaces: number[]): number {
  const aSum = aJudgePlaces.reduce((t, v) => t + v, 0);
  const bSum = bJudgePlaces.reduce((t, v) => t + v, 0);
  return aSum - bSum;
}

export type OverallRow = {
  id: string;
  total: number;
  dancePlaces: Array<number | null>;
  judgePlaces: number[];
};

export type OverallRank = OverallRow & {
  place: number;
  rule10Place: string | number;
  rule11Place: string | number;
};

export function rankOverall(rows: OverallRow[]): OverallRank[] {
  const byRule9 = rankTotals(rows.map((row) => ({ id: row.id, total: row.total })));
  const place9 = new Map(byRule9.map((row) => [row.id, row.place]));
  const groups = new Map<number, OverallRow[]>();
  for (const row of rows) {
    const p = place9.get(row.id) ?? 0;
    const list = groups.get(p) ?? [];
    list.push(row);
    groups.set(p, list);
  }

  const result: OverallRank[] = [];
  const sortedGroupKeys = [...groups.keys()].sort((a, b) => a - b);
  for (const key of sortedGroupKeys) {
    const group = groups.get(key)!;
    if (group.length === 1) {
      result.push({
        ...group[0],
        place: key,
        rule10Place: "--",
        rule11Place: "--",
      });
      continue;
    }

    const sorted10 = [...group].sort(
      (a, b) => rule10Compare(a.dancePlaces, b.dancePlaces) || a.id.localeCompare(b.id),
    );
    let r10 = 1;
    const place10 = new Map<string, number>();
    for (let i = 0; i < sorted10.length; i++) {
      if (
        i > 0 &&
        rule10Compare(sorted10[i - 1].dancePlaces, sorted10[i].dancePlaces) !== 0
      ) {
        r10 = i + 1;
      }
      place10.set(sorted10[i].id, r10);
    }

    const stillTied = sorted10.filter(
      (row) => sorted10.filter((other) => place10.get(other.id) === place10.get(row.id)).length > 1,
    );

    const place11 = new Map<string, number>();
    if (stillTied.length > 1) {
      const sorted11 = [...stillTied].sort(
        (a, b) => rule11Compare(a.judgePlaces, b.judgePlaces) || a.id.localeCompare(b.id),
      );
      let r11 = 1;
      for (let i = 0; i < sorted11.length; i++) {
        if (
          i > 0 &&
          rule11Compare(sorted11[i - 1].judgePlaces, sorted11[i].judgePlaces) !== 0
        ) {
          r11 = i + 1;
        }
        place11.set(sorted11[i].id, r11);
      }
    }

    const order = [...group].sort((a, b) => {
      const t10 = (place10.get(a.id) ?? 0) - (place10.get(b.id) ?? 0);
      if (t10 !== 0) return t10;
      const t11 = (place11.get(a.id) ?? 0) - (place11.get(b.id) ?? 0);
      if (t11 !== 0) return t11;
      return a.id.localeCompare(b.id);
    });

    let place = key;
    for (let i = 0; i < order.length; i++) {
      if (i > 0) {
        const prev = order[i - 1];
        const cur = order[i];
        const same10 = place10.get(prev.id) === place10.get(cur.id);
        const same11 =
          !place11.has(cur.id) || place11.get(prev.id) === place11.get(cur.id);
        if (!same10 || !same11) place = key + i;
      }
      const tied10 =
        group.filter((row) => place10.get(row.id) === place10.get(order[i].id)).length > 1;
      const tied11 =
        place11.has(order[i].id) &&
        group.filter((row) => place11.get(row.id) === place11.get(order[i].id)).length > 1;
      result.push({
        ...order[i],
        place,
        rule10Place: tied10 || group.length > 1 ? place10.get(order[i].id) ?? "--" : "--",
        rule11Place: place11.has(order[i].id)
          ? tied11
            ? place11.get(order[i].id)!
            : place11.get(order[i].id)!
          : "--",
      });
    }
  }

  return result.sort((a, b) => a.place - b.place || a.id.localeCompare(b.id));
}

export type MedalBandPlace = {
  /** Auto place when medal is unique in the heat; null when same-medal ties need a judge pick. */
  placement: number | null;
  tied: boolean;
  bandStart: number;
  bandSize: number;
  /** Places reserved for this medal band (e.g. two H's → [2, 3]). */
  bandPlaces: number[];
};

/**
 * Places from medal bands. Unique medals get an automatic place that skips
 * slots reserved for ties above them (GG→1, H/H→blank, G→4, S→5).
 * Tied medals leave placement null for the judge to break.
 */
export function medalBandPlacements(
  rows: { id: string; medal: string; scratched?: boolean }[],
  scale: Scale,
): Map<string, MedalBandPlace> {
  const active = rows.filter((row) => !row.scratched && row.medal);
  const byPoints = new Map<number, typeof active>();
  for (const row of active) {
    const points = medalPoints(row.medal, scale);
    const list = byPoints.get(points) ?? [];
    list.push(row);
    byPoints.set(points, list);
  }

  const result = new Map<string, MedalBandPlace>();
  let nextPlace = 1;
  const sortedPoints = [...byPoints.keys()].sort((a, b) => a - b);
  for (const points of sortedPoints) {
    const group = byPoints.get(points)!;
    const bandSize = group.length;
    const bandStart = nextPlace;
    const bandPlaces = Array.from({ length: bandSize }, (_, index) => bandStart + index);
    const tied = bandSize > 1;
    for (const row of group) {
      result.set(row.id, {
        placement: tied ? null : bandStart,
        tied,
        bandStart,
        bandSize,
        bandPlaces,
      });
    }
    nextPlace += bandSize;
  }
  return result;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}
