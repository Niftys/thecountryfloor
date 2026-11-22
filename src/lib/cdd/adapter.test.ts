import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { exportDivision, parseCddPayload } from "./adapter";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

test("parseCddPayload accepts countryfloor.cdd.v1 sample", () => {
  const raw = JSON.parse(readFileSync(join(root, "cdd-samples/internal-v1-example.json"), "utf8"));
  const parsed = parseCddPayload(raw);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.data.competition.name, "CDD Import Demo");
    assert.equal(parsed.data.sessions[0].heats[0].styleAbbrev, "WLZ");
  }
});

test("parseCddPayload rejects unknown formats", () => {
  const parsed = parseCddPayload({ format: "vendor.cdd.unknown" });
  assert.equal(parsed.ok, false);
});

test("exportDivision stamps results format", () => {
  const packet = exportDivision({
    competition: "Demo",
    division: "Open",
    scale: "COUPLES",
    rule9Count: 5,
    judges: ["A"],
    summary: [
      {
        bib: 1,
        name: "One",
        dances: [{ abbrev: "WLZ", place: 1 }],
        rule9Total: 1,
        rule10Place: "--",
        rule11Place: "--",
        place: 1,
      },
    ],
    dances: [],
  });
  assert.equal(packet.format, "countryfloor.results.v1");
  assert.equal(packet.summary[0].rule10Place, "--");
});
