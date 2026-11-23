import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_HEAT_SIZE,
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

test("Saturday Main Floor plans at least 100 heats; age order within a dance", () => {
  const saturday = planSessionHeats("saturday");
  assert.ok(saturday.length >= 100, `expected ≥100 heats, got ${saturday.length}`);
  assert.ok(saturday.every((h) => h.coupleIndexes.length <= MAX_HEAT_SIZE));

  const waltz = saturday.filter((h) => h.styleAbbrev === "WLZ");
  for (let i = 1; i < waltz.length; i++) {
    assert.ok(
      waltz[i]!.ageRank <= waltz[i - 1]!.ageRank,
      "Waltz heats must run oldest age divisions first",
    );
  }

  const sundayAm = planSessionHeats("sundayAm");
  const sundayPm = planSessionHeats("sundayPm");
  assert.ok(sundayAm.length > 0 && sundayAm.length < saturday.length);
  assert.ok(sundayPm.length > 0 && sundayPm.length < saturday.length);
});
