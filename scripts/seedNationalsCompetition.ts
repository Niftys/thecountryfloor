/**
 * Seed helper: ACDA Nationals–style mega competition with scores.
 * Used by seed-firestore.ts.
 */
import { danceName } from "../src/lib/dances";
import {
  MAX_HEAT_SIZE,
  NATIONALS_DIVISIONS,
  SESSION_META,
  coupleName,
  fakeMarks,
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

export async function seedAcdaNationalsCompetition(judgeIds: string[]) {
  const competitionId = adminDb.collection("competitions").doc().id;
  const competition: CompetitionDoc = {
    name: "ACDA National Championships 2026",
    dateLabel: "November 19–22, 2026",
    location: "Dallas, TX",
    status: "Seeded from Country Scores nationals profile",
    active: true,
    cddId: "countryscores:E4IPWuo9G8JDP5kwmiOk",
  };
  await adminDb.doc(competitionRef(competitionId)).set(competition);

  const divisionByName = new Map<string, { id: string; doc: DivisionDoc }>();
  let bib = 100;

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
      const row = {
        id,
        bib: bib++,
        name: coupleName(plan.ageRank * 1000 + i * 17 + plan.name.length),
      };
      return row;
    });
    const doc: DivisionDoc = {
      name: plan.name,
      scale: plan.scale,
      rule9Count: plan.scale === "COUPLES" ? 5 : 3,
      dances,
      competitors,
      cddId: `nationals:${plan.name}`,
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
      const div = divisionByName.get(heat.divisionName);
      if (!div) continue;
      const dance = div.doc.dances.find((d) => d.abbrev === heat.styleAbbrev);
      if (!dance) continue;

      const heatId = adminDb.collection("x").doc().id;
      const entries: HeatEntryEmbedded[] = heat.coupleIndexes.map((idx) => {
        const couple = div.doc.competitors[idx]!;
        return {
          id: `${heatId}_${couple.id}_${dance.id}`,
          competitorId: couple.id,
          bib: couple.bib,
          name: couple.name,
          divisionId: div.id,
          divisionName: div.doc.name,
          scale: div.doc.scale,
          danceId: dance.id,
          danceName: dance.name,
          danceAbbrev: dance.abbrev,
        };
      });

      if (entries.length > MAX_HEAT_SIZE) {
        throw new Error(`Heat ${heat.number} has ${entries.length} > ${MAX_HEAT_SIZE}`);
      }

      const heatDoc: HeatDoc = {
        number: heat.number,
        styleAbbrev: heat.styleAbbrev,
        styleName: danceName(heat.styleAbbrev),
        entries,
        confirmedJudgeIds: [...judgeIds],
        confirmCount: judgeIds.length,
        cddId: `nationals:${sessionKey}:h${heat.number}`,
      };

      writeOps.push((batch) => {
        batch.set(adminDb.doc(heatPath(competitionId, sessionId, heatId)), heatDoc);
      });

      for (const [judgeIndex, judgeId] of judgeIds.entries()) {
        const sheetMarks: JudgeSheetDoc["marks"] = {};
        entries.forEach((entry, placeAmong) => {
          const marks = fakeMarks(heat.scale, placeAmong + 1, entries.length, judgeIds.length);
          const mark = marks[judgeIndex]!;
          // Ensure Couples places unique per judge within heat
          sheetMarks[entry.id] = {
            medal: mark.medal,
            placement:
              heat.scale === "COUPLES"
                ? placeAmong + 1 // stable unique places; majority still works
                : null,
            notes: "",
            scratched: false,
            overridden: false,
          };
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
        divisionIds: [div.id],
      });
    }

    await commitInBatches(writeOps);

    const sessionDoc: SessionDoc = {
      name: meta.name,
      sortOrder: meta.sortOrder,
      judgeIds,
      heatIndex,
      cddId: `nationals:${sessionKey}`,
    };
    await adminDb.doc(sessionPath(competitionId, sessionId)).set(sessionDoc);
    await rebuildSessionLive(competitionId, sessionId);
  }

  return { competitionId, sessionHeatCounts };
}
