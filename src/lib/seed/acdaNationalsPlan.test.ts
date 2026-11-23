import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_HEAT_SIZE,
  SATURDAY_HEAT_TARGET,
  SOLO_MIN,
  heatCoupleCount,
  heatSizes,
  planSessionHeats,
} from "./acdaNationalsPlan";

test("heatSizes keeps chunks ≤8, differ by ≤1, smaller first", () => {
  assert.deepEqual(heatSizes(8), [8]);
  assert.deepEqual(heatSizes(16), [8, 8]);
  assert.deepEqual(heatSizes(10), [5, 5]);
  assert.deepEqual(heatSizes(11), [5, 6]);
  assert.ok(heatSizes(25).every((n) => n <= MAX_HEAT_SIZE));
});

test("Saturday Main Floor ~150 heats; co-mingled fills; age order within a dance", () => {
  const saturday = planSessionHeats("saturday");
  assert.ok(
    saturday.length >= 100 && saturday.length <= SATURDAY_HEAT_TARGET + 30,
    `expected ~${SATURDAY_HEAT_TARGET} heats (±30), got ${saturday.length}`,
  );
  assert.ok(saturday.every((h) => heatCoupleCount(h) <= MAX_HEAT_SIZE));
  assert.ok(saturday.every((h) => h.slots.length >= 1));

  const mixed = saturday.filter((h) => h.slots.length > 1);
  assert.ok(mixed.length > 0, "expected some co-mingled heats");

  const soloSized = saturday.filter(
    (h) => h.slots.length === 1 && h.slots[0]!.coupleIndexes.length >= SOLO_MIN,
  );
  assert.ok(soloSized.length > 0, "expected some solo division heats");

  // Small divisions should appear in at most one heat per dance (not fragmented).
  const waltzSlots = saturday
    .filter((h) => h.styleAbbrev === "WLZ")
    .flatMap((h) => h.slots.map((s) => s.divisionName));
  const waltzCounts = new Map<string, number>();
  for (const name of waltzSlots) waltzCounts.set(name, (waltzCounts.get(name) ?? 0) + 1);
  for (const [name, count] of waltzCounts) {
    const soloHeats = saturday.filter(
      (h) =>
        h.styleAbbrev === "WLZ" &&
        h.slots.length === 1 &&
        h.slots[0]!.divisionName === name,
    );
    if (soloHeats.length >= 2) continue; // large division legitimately split
    assert.equal(count, 1, `${name} should not be fragmented across Waltz heats`);
  }

  const waltz = saturday.filter((h) => h.styleAbbrev === "WLZ");
  for (let i = 1; i < waltz.length; i++) {
    const prev = Math.max(...waltz[i - 1]!.slots.map((s) => s.ageRank));
    const curr = Math.max(...waltz[i]!.slots.map((s) => s.ageRank));
    assert.ok(curr <= prev, "Waltz heats must run oldest age divisions first");
  }

  const sundayAm = planSessionHeats("sundayAm");
  const sundayPm = planSessionHeats("sundayPm");
  assert.ok(sundayAm.length > 0 && sundayAm.length < saturday.length);
  assert.ok(sundayPm.length > 0 && sundayPm.length < saturday.length);
});
