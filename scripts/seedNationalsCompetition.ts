/**
 * Seed helper: ACDA Nationals–sized competition.
 * `judged` writes a confirmed sheet for every judge. Otherwise the floor is
 * the same size and the panel is assigned, with no marks.
 * Used by seed-firestore.ts.
 */
import { danceName } from "../src/lib/dances";
import {
  MAX_HEAT_SIZE,
  NATIONALS_DIVISIONS,
  SESSION_META,
  coupleName,
  fakeMarks,
  heatCoupleCount,
  planSessionHeats,
  type SessionKey,
} from "../src/lib/seed/acdaNationalsPlan";
import { rebuildSessionLive } from "../src/lib/store/competitions";
import {
  competitionRef,
  divisionPath,
  heatPath,
  judgeSheetPath,
  sessionPath,
} from "../src/lib/store/paths";
import type {
  CompetitionDoc,
  DivisionDoc,
  HeatDoc,
  HeatEntryEmbedded,
  JudgeSheetDoc,
  SessionDoc,
} from "../src/lib/store/types";
import { adminDb } from "../src/lib/firebase/admin";
import { DANCE_STYLES } from "../src/lib/dances";
import type { WriteBatch } from "firebase-admin/firestore";

async function commitInBatches(ops: Array<(batch: WriteBatch) => void>) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = adminDb.batch();
    for (const op of ops.slice(i, i + 400)) op(batch);
    await batch.commit();
  }
}

export type MegaCompetitionSeed = {
  name: string;
  dateLabel: string;
  location: string;
  status: string;
  /** Stored on the competition document. */
  cddId: string;
  /** Prefix for division, session, and heat cdd ids. */
  idPrefix: string;
  /** Write a confirmed mark for every judge on every heat. */
  judged: boolean;
  bibStart?: number;
  nameSalt?: number;
};

export async function seedAcdaNationalsCompetition(
  judgeIds: string[],
  options: MegaCompetitionSeed,
) {
  const bibStart = options.bibStart ?? 100;
  const nameSalt = options.nameSalt ?? 0;
  const competitionId = adminDb.collection("competitions").doc().id;
  const competition: CompetitionDoc = {
    name: options.name,
    dateLabel: options.dateLabel,
    location: options.location,
    status: options.status,
    active: true,
    cddId: options.cddId,
  };
  await adminDb.doc(competitionRef(competitionId)).set(competition);

  const divisionByName = new Map<string, { id: string; doc: DivisionDoc }>();
  let bib = bibStart;

  for (const plan of NATIONALS_DIVISIONS) {
    const divisionId = adminDb.collection("x").doc().id;
    const dances = DANCE_STYLES.map((dance, index) => ({
      id: `${divisionId}_${dance.abbrev}`,
      name: dance.name,
      abbrev: dance.abbrev,
      sortOrder: index + 1,
    }));
    const competitors = Array.from({ length: plan.coupleCount }, (_, i) => {
      const id = `${divisionId}_c_${i}`;
      return {
        id,
        bib: bib++,
        name: coupleName(plan.ageRank * 1000 + i * 17 + plan.name.length + nameSalt),
      };
    });
    const doc: DivisionDoc = {
      name: plan.name,
      scale: plan.scale,
      rule9Count: plan.scale === "COUPLES" ? 5 : 3,
      dances,
      competitors,
      cddId: `${options.idPrefix}:${plan.name}`,
    };
    await adminDb.doc(divisionPath(competitionId, divisionId)).set(doc);
    divisionByName.set(plan.name, { id: divisionId, doc });
  }

  const now = new Date().toISOString();
  const sessionHeatCounts: Record<string, number> = {};

  for (const sessionKey of Object.keys(SESSION_META) as SessionKey[]) {
    const meta = SESSION_META[sessionKey];
    const sessionId = adminDb.collection("x").doc().id;
    const planned = planSessionHeats(sessionKey);
    sessionHeatCounts[meta.name] = planned.length;

    const heatIndex: SessionDoc["heatIndex"] = [];
    const writeOps: Array<(batch: WriteBatch) => void> = [];

    for (const heat of planned) {
      const entries: HeatEntryEmbedded[] = [];
      const divisionIds = new Set<string>();

      for (const slot of heat.slots) {
        const div = divisionByName.get(slot.divisionName);
        if (!div) continue;
        const dance = div.doc.dances.find((d) => d.abbrev === heat.styleAbbrev);
        if (!dance) continue;
        divisionIds.add(div.id);

        for (const idx of slot.coupleIndexes) {
          const couple = div.doc.competitors[idx];
          if (!couple) continue;
          const heatIdPlaceholder = "HEAT";
          entries.push({
            id: `${heatIdPlaceholder}_${couple.id}_${dance.id}`,
            competitorId: couple.id,
            bib: couple.bib,
            name: couple.name,
            divisionId: div.id,
            divisionName: div.doc.name,
            scale: div.doc.scale,
            danceId: dance.id,
            danceName: dance.name,
            danceAbbrev: dance.abbrev,
          });
        }
      }

      if (entries.length === 0) continue;
      if (entries.length > MAX_HEAT_SIZE) {
        throw new Error(`Heat ${heat.number} has ${entries.length} > ${MAX_HEAT_SIZE}`);
      }
      if (heatCoupleCount(heat) !== entries.length) {
        throw new Error(`Heat ${heat.number} slot/entry mismatch`);
      }

      const heatId = adminDb.collection("x").doc().id;
      const finalized = entries.map((entry) => ({
        ...entry,
        id: entry.id.replace("HEAT", heatId),
      }));

      const heatDoc: HeatDoc = {
        number: heat.number,
        styleAbbrev: heat.styleAbbrev,
        styleName: danceName(heat.styleAbbrev),
        entries: finalized,
        confirmedJudgeIds: options.judged ? [...judgeIds] : [],
        confirmCount: options.judged ? judgeIds.length : 0,
        cddId: `${options.idPrefix}:${sessionKey}:h${heat.number}`,
      };

      writeOps.push((batch) => {
        batch.set(adminDb.doc(heatPath(competitionId, sessionId, heatId)), heatDoc);
      });

      if (!options.judged) {
        heatIndex.push({
          id: heatId,
          number: heat.number,
          styleAbbrev: heat.styleAbbrev,
          styleName: danceName(heat.styleAbbrev),
          divisionIds: [...divisionIds],
        });
        continue;
      }

      for (const [judgeIndex, judgeId] of judgeIds.entries()) {
        const sheetMarks: JudgeSheetDoc["marks"] = {};
        let couplesPlace = 0;
        finalized.forEach((entry, index) => {
          const marks = fakeMarks(entry.scale, index + 1, finalized.length, judgeIds.length);
          const mark = marks[judgeIndex]!;
          if (entry.scale === "COUPLES") {
            couplesPlace += 1;
            sheetMarks[entry.id] = {
              medal: mark.medal,
              placement: couplesPlace,
              notes: "",
              scratched: false,
              overridden: false,
            };
          } else {
            sheetMarks[entry.id] = {
              medal: mark.medal,
              placement: null,
              notes: "",
              scratched: false,
              overridden: false,
            };
          }
        });
        writeOps.push((batch) => {
          batch.set(adminDb.doc(judgeSheetPath(competitionId, sessionId, heatId, judgeId)), {
            marks: sheetMarks,
            confirmedAt: now,
          } satisfies JudgeSheetDoc);
        });
      }

      heatIndex.push({
        id: heatId,
        number: heat.number,
        styleAbbrev: heat.styleAbbrev,
        styleName: danceName(heat.styleAbbrev),
        divisionIds: [...divisionIds],
      });
    }

    await commitInBatches(writeOps);

    const sessionDoc: SessionDoc = {
      name: meta.name,
      sortOrder: meta.sortOrder,
      judgeIds,
      heatIndex,
      cddId: `${options.idPrefix}:${sessionKey}`,
    };
    await adminDb.doc(sessionPath(competitionId, sessionId)).set(sessionDoc);
    await rebuildSessionLive(competitionId, sessionId);
  }

  return { competitionId, sessionHeatCounts };
}
