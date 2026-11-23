import assert from "node:assert/strict";
import { test } from "node:test";
import { DANCES, DIVISION, JUDGES, MARKS } from "./sampleData";
import { heatingWarnings } from "./dances";
import {
  assignPlacesWithRule6,
  dash,
  lossPercentage,
  medalPlacementConflict,
  rankDance,
  medalBandPlacements,
  rankOverall,
  rankTotals,
  rule10Compare,
  rule9Total,
  type CoupleInput,
} from "./scoring";

function couplesFor(abbrev: string): CoupleInput[] {
  const byBib = MARKS[abbrev] ?? {};
  return Object.entries(byBib).map(([bib, marks]) => ({
    id: bib,
    marks: marks.map((mark, index) => ({
      judgeId: JUDGES[index],
      medal: mark[0],
      placement: mark[1],
    })),
  }));
}

function byId(abbrev: string) {
  const rows = rankDance(couplesFor(abbrev), DIVISION.scale);
  return new Map(rows.map((row) => [row.id, row]));
}

test("Division III dance columns match the score sheet", () => {
  const tr2 = byId("TR2");
  assert.equal(dash(tr2.get("306")!.ordered), "1-1-1-1-2");
  assert.deepEqual(
    [tr2.get("306")!.mark, tr2.get("306")!.size, tr2.get("306")!.sum, dash(tr2.get("306")!.lookAhead), dash(tr2.get("306")!.lookBack), tr2.get("306")!.place],
    [1, 1, 2, "1-2", "1-1", 1],
  );
  assert.deepEqual(
    [dash(tr2.get("279")!.ordered), tr2.get("279")!.mark, tr2.get("279")!.size, tr2.get("279")!.sum, tr2.get("279")!.place],
    ["1-2-2-2-2", 2, 0, 3, 2],
  );

  const waltz = byId("WLZ");
  assert.equal(dash(waltz.get("306")!.ordered), "1-1-1-1-3");
  assert.equal(waltz.get("306")!.place, 1);
  assert.deepEqual(
    [dash(waltz.get("279")!.ordered), waltz.get("279")!.mark, waltz.get("279")!.size, waltz.get("279")!.sum, dash(waltz.get("279")!.lookAhead), dash(waltz.get("279")!.lookBack), waltz.get("279")!.place],
    ["2-2-2-2-3", 2, 1, 4, "2-3", "2-2", 2],
  );
  assert.deepEqual(
    [dash(waltz.get("283")!.ordered), waltz.get("283")!.mark, waltz.get("283")!.size, waltz.get("283")!.sum, dash(waltz.get("283")!.lookAhead), dash(waltz.get("283")!.lookBack), waltz.get("283")!.place],
    ["1-2-3-3-3", 3, 0, 3, "3-3", "1-2", 3],
  );

  const ecs = byId("ECS");
  assert.equal(ecs.get("283")!.place, 1);
  assert.equal(ecs.get("306")!.place, 2);
  assert.equal(dash(ecs.get("283")!.ordered), "1-1-1-2-2");
  assert.equal(ecs.get("283")!.size, 2);

  const two = byId("2ST");
  assert.deepEqual([two.get("306")!.place, two.get("283")!.place, two.get("279")!.place], [1, 2, 3]);
  assert.equal(two.get("279")!.sum, 5);

  const wcs = byId("WCS");
  assert.deepEqual([wcs.get("279")!.place, wcs.get("306")!.place, wcs.get("283")!.place], [1, 2, 3]);

  assert.equal(byId("PLK").get("283")!.place, 1);
  assert.equal(dash(byId("PLK").get("283")!.ordered), "1-1-1-1-1");
  assert.equal(byId("CHA").get("283")!.place, 1);
  assert.equal(byId("NC2").get("306")!.place, 1);
  assert.equal(byId("NC2").get("279")!.place, 2);
});

test("medal placement rule: better medal must place higher", () => {
  assert.equal(
    medalPlacementConflict(
      [
        { bib: 1, medal: "GG", placement: 2 },
        { bib: 2, medal: "H", placement: 1 },
      ],
      "COUPLES",
    ),
    "Bib 1 (GG 2) cannot place behind bib 2 (H 1). Higher medals must place higher.",
  );
  assert.equal(
    medalPlacementConflict(
      [
        { bib: 1, medal: "H", placement: 1 },
        { bib: 2, medal: "H", placement: 2 },
      ],
      "COUPLES",
    ),
    null,
  );
  assert.equal(
    medalPlacementConflict(
      [
        { bib: 1, medal: "GG", placement: 1 },
        { bib: 2, medal: "H", placement: 2 },
      ],
      "COUPLES",
    ),
    null,
  );
});

test("Rule 9 totals and overall places match Division III", () => {
  const placeByBib = new Map<string, Array<number | null>>();
  for (const bib of ["306", "283", "279"]) placeByBib.set(bib, []);

  for (const dance of DANCES) {
    const ranked = byId(dance.abbrev);
    for (const bib of ["306", "283", "279"]) {
      placeByBib.get(bib)!.push(ranked.get(bib)?.place ?? null);
    }
  }

  assert.deepEqual(placeByBib.get("306"), [1, null, 1, null, null, 1, 1, 2, 2]);
  assert.deepEqual(placeByBib.get("283"), [null, 1, null, 1, null, 3, 2, 1, 3]);
  assert.deepEqual(placeByBib.get("279"), [2, null, 2, null, null, 2, 3, null, 1]);

  const totals = ["306", "283", "279"].map((id) => ({
    id,
    total: rule9Total(placeByBib.get(id)!, DIVISION.rule9Count),
  }));
  assert.deepEqual(
    rankTotals(totals).map((row) => [row.id, row.total, row.place]),
    [
      ["306", 6, 1],
      ["283", 8, 2],
      ["279", 10, 3],
    ],
  );
});

test("Rule 10 breaks Rule 9 ties by head-to-head dance places", () => {
  assert.ok(rule10Compare([1, 2, 1], [2, 1, 2]) < 0);
  assert.equal(rule10Compare([1, 2], [1, 2]), 0);

  const ranked = rankOverall([
    { id: "a", total: 4, dancePlaces: [1, 1], judgePlaces: [1, 1, 2, 3, 3] },
    { id: "b", total: 4, dancePlaces: [2, 2], judgePlaces: [2, 2, 1, 1, 2] },
    { id: "c", total: 6, dancePlaces: [3, 3], judgePlaces: [3, 3, 3, 2, 1] },
  ]);
  assert.equal(ranked.find((row) => row.id === "a")!.place, 1);
  assert.equal(ranked.find((row) => row.id === "b")!.place, 2);
  assert.equal(ranked.find((row) => row.id === "c")!.place, 3);
  assert.notEqual(ranked.find((row) => row.id === "a")!.rule10Place, "--");
});

test("Rule 6 breaks Rules 1–5 ties by loss%; identical loss% shares average place", () => {
  // Same ordered marks (1-2-3) so Rules 1–5 tie; head-to-head favors b.
  const tiedGroup: CoupleInput[] = [
    {
      id: "a",
      marks: [
        { judgeId: "j1", medal: "H", placement: 1 },
        { judgeId: "j2", medal: "H", placement: 2 },
        { judgeId: "j3", medal: "H", placement: 3 },
      ],
    },
    {
      id: "b",
      marks: [
        { judgeId: "j1", medal: "H", placement: 3 },
        { judgeId: "j2", medal: "H", placement: 1 },
        { judgeId: "j3", medal: "H", placement: 2 },
      ],
    },
  ];
  assert.ok(lossPercentage("b", tiedGroup) < lossPercentage("a", tiedGroup));
  const broken = rankDance(tiedGroup, "COUPLES");
  assert.equal(broken.find((row) => row.id === "b")!.place, 1);
  assert.equal(broken.find((row) => row.id === "a")!.place, 2);

  const identical: CoupleInput[] = [
    {
      id: "x",
      marks: [
        { judgeId: "j1", medal: "H", placement: 1 },
        { judgeId: "j2", medal: "H", placement: 2 },
        { judgeId: "j3", medal: "H", placement: 3 },
      ],
    },
    {
      id: "y",
      marks: [
        { judgeId: "j1", medal: "H", placement: 1 },
        { judgeId: "j2", medal: "H", placement: 2 },
        { judgeId: "j3", medal: "H", placement: 3 },
      ],
    },
  ];
  assert.equal(lossPercentage("x", identical), lossPercentage("y", identical));
  const shared = assignPlacesWithRule6(identical, 2);
  assert.equal(shared.get("x"), 2.5);
  assert.equal(shared.get("y"), 2.5);
  assert.equal(rule9Total([2.5, 1], 2), 3.5);
});

test("heatingWarnings flags non-contiguous multi-heats only within the same dance", () => {
  const notes = heatingWarnings([
    { number: 1, divisionIds: ["Open"], size: 4, styleAbbrev: "WLZ" },
    { number: 3, divisionIds: ["Open"], size: 2, styleAbbrev: "WLZ" },
  ]);
  assert.ok(notes.some((note) => note.includes("contiguous")));
  assert.ok(notes.some((note) => note.includes("more than 1")));

  // Same division across different dances is normal floor order — not a multi-heat round.
  const acrossDances = heatingWarnings([
    { number: 1, divisionIds: ["Open"], size: 4, styleAbbrev: "TR2" },
    { number: 52, divisionIds: ["Open"], size: 4, styleAbbrev: "WLZ" },
    { number: 103, divisionIds: ["Open"], size: 4, styleAbbrev: "2ST" },
  ]);
  assert.equal(acrossDances.length, 0);
});

test("medalBandPlacements auto-fills uniques and clears ties with skipped places", () => {
  const bands = medalBandPlacements(
    [
      { id: "gg", medal: "GG" },
      { id: "h1", medal: "H" },
      { id: "h2", medal: "H" },
      { id: "g", medal: "G" },
      { id: "s", medal: "S" },
    ],
    "COUPLES",
  );
  assert.deepEqual(bands.get("gg"), {
    placement: 1,
    tied: false,
    bandStart: 1,
    bandSize: 1,
    bandPlaces: [1],
  });
  assert.equal(bands.get("h1")!.placement, null);
  assert.equal(bands.get("h1")!.tied, true);
  assert.deepEqual(bands.get("h1")!.bandPlaces, [2, 3]);
  assert.deepEqual(bands.get("h2")!.bandPlaces, [2, 3]);
  assert.equal(bands.get("g")!.placement, 4);
  assert.equal(bands.get("s")!.placement, 5);
});
