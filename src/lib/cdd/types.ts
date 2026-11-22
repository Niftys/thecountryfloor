/**
 * Internal CDD exchange shape. Real Country Dance Director files map into this
 * in adapter.ts only — screens and Prisma never speak CDD field names.
 */
export type CddCompetitionPayload = {
  format: "countryfloor.cdd.v1";
  competition: {
    cddId?: string;
    name: string;
    dateLabel?: string;
    location?: string;
    status?: string;
    active?: boolean;
    cddData?: Record<string, unknown>;
  };
  divisions: {
    cddId?: string;
    name: string;
    scale: "COUPLES" | "PROAM";
    rule9Count: number;
    cddData?: Record<string, unknown>;
    dances: { name: string; abbrev: string; sortOrder: number }[];
    competitors: {
      cddId?: string;
      bib: number;
      name: string;
      cddData?: Record<string, unknown>;
    }[];
  }[];
  sessions: {
    cddId?: string;
    name: string;
    sortOrder: number;
    judgeUsernames: string[];
    cddData?: Record<string, unknown>;
    heats: {
      cddId?: string;
      number: number;
      /** One style per heat (abbrev). */
      styleAbbrev: string;
      entries: { bib: number; divisionName: string }[];
      cddData?: Record<string, unknown>;
    }[];
  }[];
  /** Optional results — Countryfloor owns live scores; import never overwrites confirmed marks. */
  results?: unknown;
};
