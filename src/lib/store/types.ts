import type { Scale } from "@/lib/scoring";

export type Role = "ADMIN" | "JUDGE" | "SCRUTINEER";

export type UserDoc = {
  username: string;
  displayName: string;
  role: Role;
};

export type CompetitionDoc = {
  name: string;
  dateLabel: string;
  location: string;
  status: string;
  active: boolean;
  cddId?: string | null;
  cddData?: Record<string, unknown> | null;
};

export type DanceEmbedded = {
  id: string;
  name: string;
  abbrev: string;
  sortOrder: number;
};

export type CompetitorEmbedded = {
  id: string;
  bib: number;
  name: string;
  cddId?: string | null;
  cddData?: Record<string, unknown> | null;
};

export type DivisionDoc = {
  name: string;
  scale: Scale;
  rule9Count: number;
  cddId?: string | null;
  cddData?: Record<string, unknown> | null;
  dances: DanceEmbedded[];
  competitors: CompetitorEmbedded[];
};

export type HeatIndexItem = {
  id: string;
  number: number;
  styleAbbrev: string;
  styleName: string;
  divisionIds: string[];
};

export type SessionDoc = {
  name: string;
  sortOrder: number;
  judgeIds: string[];
  heatIndex: HeatIndexItem[];
  cddId?: string | null;
  cddData?: Record<string, unknown> | null;
};

export type HeatEntryEmbedded = {
  id: string;
  competitorId: string;
  bib: number;
  name: string;
  divisionId: string;
  divisionName: string;
  scale: Scale;
  danceId: string;
  danceName: string;
  danceAbbrev: string;
};

export type HeatDoc = {
  number: number;
  styleAbbrev: string;
  styleName: string;
  entries: HeatEntryEmbedded[];
  confirmedJudgeIds: string[];
  confirmCount: number;
  cddId?: string | null;
  cddData?: Record<string, unknown> | null;
};

/** Judge's confirmed mark snapshot — kept when a scrutineer overrides so restore is possible. */
export type MarkOriginal = {
  medal: string | null;
  placement: number | null;
  notes: string;
  scratched: boolean;
};

export type MarkEmbedded = {
  medal: string | null;
  placement: number | null;
  notes: string;
  scratched: boolean;
  overridden: boolean;
  /** Set on first scrutineer edit; unchanged by later edits. */
  original?: MarkOriginal | null;
};

export type JudgeSheetDoc = {
  marks: Record<string, MarkEmbedded>;
  confirmedAt: string | null;
  clientRequestId?: string | null;
};

export type LiveHeatStatus = {
  id: string;
  number: number;
  label: string;
  confirmed: number;
  judges: number;
  complete: boolean;
  /** Display names of panel judges who have not confirmed this heat. */
  pendingJudges?: string[];
};

export type SessionLiveDoc = {
  heats: LiveHeatStatus[];
  updatedAt: string;
};

export type AuditDoc = {
  at: string;
  actorId: string;
  actorName: string;
  bib: number;
  dance: string;
  judgeId: string;
  judgeName: string;
  before: string;
  after: string;
  scoreKey: string;
};
