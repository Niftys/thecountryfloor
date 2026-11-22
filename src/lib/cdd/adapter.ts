import { heatStyleConflict } from "../dances";
import { dash, type CoupleBreakdown } from "../scoring";
import type { CddCompetitionPayload } from "./types";

export type PacketSummaryRow = {
  bib: number;
  name: string;
  dances: { abbrev: string; place: number; overridden?: boolean }[];
  rule9Total: number;
  rule10Place: string | number;
  rule11Place: string | number;
  place: number;
};

export type PacketDanceRow = {
  bib: number;
  name: string;
  judges: { judge: string; medal: string; placement: number | null }[];
  ordered: string;
  mark: number;
  size: number;
  sum: number;
  lookAhead: string;
  lookBack: string;
  medal: string;
  place: number;
};

export type DivisionPacket = {
  format: "countryfloor.results.v1";
  competition: string;
  competitionCddId?: string | null;
  division: string;
  divisionCddId?: string | null;
  scale: string;
  rule9Count: number;
  judges: string[];
  summary: PacketSummaryRow[];
  dances: {
    name: string;
    abbrev: string;
    rows: PacketDanceRow[];
  }[];
};

export function exportDivision(packet: Omit<DivisionPacket, "format">): DivisionPacket {
  return { ...packet, format: "countryfloor.results.v1" };
}

export function danceRowFromBreakdown(
  couple: { bib: number; name: string },
  judges: { judge: string; medal: string; placement: number | null }[],
  breakdown: CoupleBreakdown,
): PacketDanceRow {
  return {
    bib: couple.bib,
    name: couple.name,
    judges,
    ordered: dash(breakdown.ordered),
    mark: breakdown.mark,
    size: breakdown.size,
    sum: breakdown.sum,
    lookAhead: dash(breakdown.lookAhead),
    lookBack: dash(breakdown.lookBack),
    medal: breakdown.medal,
    place: breakdown.place,
  };
}

export function parseCddPayload(raw: unknown): { ok: true; data: CddCompetitionPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Payload must be a JSON object." };
  const data = raw as CddCompetitionPayload;
  if (data.format !== "countryfloor.cdd.v1") {
    return {
      ok: false,
      error: "Unknown format. Expected countryfloor.cdd.v1 — map real CDD files in src/lib/cdd/ first.",
    };
  }
  if (!data.competition?.name) return { ok: false, error: "competition.name is required." };
  if (!Array.isArray(data.divisions) || data.divisions.length === 0) {
    return { ok: false, error: "At least one division is required." };
  }
  if (!Array.isArray(data.sessions)) return { ok: false, error: "sessions must be an array." };

  for (const session of data.sessions) {
    for (const heat of session.heats ?? []) {
      const abbrevs = (heat.entries ?? []).map(() => heat.styleAbbrev);
      const conflict = heatStyleConflict(abbrevs.length ? [heat.styleAbbrev] : []);
      if (!heat.styleAbbrev) return { ok: false, error: `Heat ${heat.number} needs styleAbbrev.` };
      void conflict;
    }
  }

  return { ok: true, data };
}

/** Placeholder for vendor CDD binary/XML — replace when you have samples. */
export function mapVendorCddFile(_bytes: ArrayBuffer): { ok: false; error: string } {
  return {
    ok: false,
    error: "Vendor CDD file mapping is not installed yet. Use countryfloor.cdd.v1 JSON or add a mapper.",
  };
}
