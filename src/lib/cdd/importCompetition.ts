import { adminDb } from "@/lib/firebase/admin";
import { parseCddPayload } from "@/lib/cdd/adapter";
import type { CddCompetitionPayload } from "@/lib/cdd/types";
import { DANCE_STYLES, danceOrder } from "@/lib/dances";
import { listDivisions, listHeats, listSessions, rebuildSessionLive } from "@/lib/store/competitions";
import { competitionRef, divisionPath, heatPath, sessionPath } from "@/lib/store/paths";
import { findUserByUsername } from "@/lib/store/users";
import type {
  CompetitionDoc,
  DivisionDoc,
  HeatDoc,
  HeatEntryEmbedded,
  SessionDoc,
} from "@/lib/store/types";
import type { Scale } from "@/lib/scoring";

function styleName(abbrev: string) {
  return DANCE_STYLES.find((item) => item.abbrev === abbrev)?.name ?? abbrev;
}

/**
 * Import structure from CDD exchange JSON.
 * Never deletes or overwrites existing judgeSheets.
 */
export async function importCddCompetition(raw: unknown) {
  const parsed = parseCddPayload(raw);
  if (!parsed.ok) return parsed;

  const data: CddCompetitionPayload = parsed.data;
  const heatingNotes = [...parsed.heatingWarnings];
  const existingSnap = data.competition.cddId
    ? await adminDb
        .collection("competitions")
        .where("cddId", "==", data.competition.cddId)
        .limit(1)
        .get()
    : await adminDb
        .collection("competitions")
        .where("name", "==", data.competition.name)
        .limit(1)
        .get();

  const competitionId = existingSnap.empty ? adminDb.collection("competitions").doc().id : existingSnap.docs[0]!.id;
  const competition: CompetitionDoc = {
    name: data.competition.name,
    dateLabel: data.competition.dateLabel ?? "",
    location: data.competition.location ?? "",
    status: data.competition.status ?? "Imported",
    active: data.competition.active ?? false,
    cddId: data.competition.cddId ?? null,
    cddData: data.competition.cddData ?? null,
  };
  await adminDb.doc(competitionRef(competitionId)).set(competition, { merge: true });

  const divisionIds = new Map<string, string>();
  const danceIds = new Map<string, string>();
  const competitorIds = new Map<string, string>();
  const divisionDocs = new Map<string, DivisionDoc & { id: string }>();
  const existingDivisions = await listDivisions(competitionId);
  const existingSessions = await listSessions(competitionId);

  for (const div of data.divisions) {
    const prior =
      existingDivisions.find((item) => div.cddId && item.cddId === div.cddId) ??
      existingDivisions.find((item) => item.name === div.name);
    const divisionId = prior?.id ?? adminDb.collection("x").doc().id;
    const dances = [...div.dances]
      .map((dance, index) => {
        const priorDance = prior?.dances.find((item) => item.abbrev === dance.abbrev);
        const id = priorDance?.id ?? `${divisionId}_d_${dance.abbrev}`;
        danceIds.set(`${div.name}:${dance.abbrev}`, id);
        return {
          id,
          name: dance.name,
          abbrev: dance.abbrev,
          sortOrder: dance.sortOrder ?? (danceOrder(dance.abbrev) || index + 1),
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const competitors = div.competitors.map((couple) => {
      const priorCouple =
        prior?.competitors.find((item) => couple.cddId && item.cddId === couple.cddId) ??
        prior?.competitors.find((item) => item.bib === couple.bib);
      const id = priorCouple?.id ?? couple.cddId ?? `${divisionId}_c_${couple.bib}`;
      competitorIds.set(`${div.name}:${couple.bib}`, id);
      return {
        id,
        bib: couple.bib,
        name: couple.name,
        cddId: couple.cddId ?? null,
        cddData: couple.cddData ?? null,
      };
    });
    const doc: DivisionDoc = {
      name: div.name,
      scale: div.scale as Scale,
      rule9Count: div.rule9Count,
      cddId: div.cddId ?? null,
      cddData: div.cddData ?? null,
      dances,
      competitors,
    };
    await adminDb.doc(divisionPath(competitionId, divisionId)).set(doc);
    divisionIds.set(div.name, divisionId);
    divisionDocs.set(divisionId, { id: divisionId, ...doc });
  }

  for (const sess of data.sessions) {
    const priorSession =
      existingSessions.find((item) => sess.cddId && item.cddId === sess.cddId) ??
      existingSessions.find((item) => item.name === sess.name);
    const sessionId = priorSession?.id ?? sess.cddId ?? adminDb.collection("x").doc().id;
    const existingHeats = priorSession ? await listHeats(competitionId, sessionId) : [];
    const judgeIds: string[] = [];
    const missingJudges: string[] = [];
    for (const username of sess.judgeUsernames) {
      const user = await findUserByUsername(username);
      if (user) judgeIds.push(user.id);
      else missingJudges.push(username);
    }
    if (missingJudges.length > 0) {
      heatingNotes.push(
        `Session ${sess.name}: unknown judge usernames skipped (${missingJudges.join(", ")}).`,
      );
    }

    const heatIndex: SessionDoc["heatIndex"] = [];
    for (const heat of sess.heats) {
      const priorHeat =
        existingHeats.find((item) => heat.cddId && item.cddId === heat.cddId) ??
        existingHeats.find((item) => item.number === heat.number);
      const heatId = priorHeat?.id ?? heat.cddId ?? adminDb.collection("x").doc().id;
      const entries: HeatEntryEmbedded[] = [];
      for (const entry of heat.entries) {
        const divisionId = divisionIds.get(entry.divisionName);
        const division = divisionId ? divisionDocs.get(divisionId) : null;
        if (!division || !divisionId) continue;
        const competitorId = competitorIds.get(`${entry.divisionName}:${entry.bib}`);
        const competitor = division.competitors.find((item) => item.id === competitorId);
        const dance = division.dances.find((item) => item.abbrev === heat.styleAbbrev);
        if (!competitor || !dance) continue;
        entries.push({
          id: `${heatId}_${competitor.id}_${dance.id}`,
          competitorId: competitor.id,
          bib: competitor.bib,
          name: competitor.name,
          divisionId,
          divisionName: division.name,
          scale: division.scale,
          danceId: dance.id,
          danceName: dance.name,
          danceAbbrev: dance.abbrev,
        });
      }
      const heatDoc: HeatDoc = {
        number: heat.number,
        styleAbbrev: heat.styleAbbrev,
        styleName: styleName(heat.styleAbbrev),
        entries,
        confirmedJudgeIds: [],
        confirmCount: 0,
        cddId: heat.cddId ?? null,
        cddData: heat.cddData ?? null,
      };
      // Preserve existing confirmations if heat already exists
      const existingHeat = await adminDb.doc(heatPath(competitionId, sessionId, heatId)).get();
      if (existingHeat.exists) {
        const prev = existingHeat.data() as HeatDoc;
        heatDoc.confirmedJudgeIds = prev.confirmedJudgeIds ?? [];
        heatDoc.confirmCount = prev.confirmCount ?? heatDoc.confirmedJudgeIds.length;
      }
      await adminDb.doc(heatPath(competitionId, sessionId, heatId)).set(heatDoc, { merge: true });
      heatIndex.push({
        id: heatId,
        number: heat.number,
        styleAbbrev: heat.styleAbbrev,
        styleName: styleName(heat.styleAbbrev),
        divisionIds: [...new Set(entries.map((entry) => entry.divisionId))],
      });
    }

    const sessionDoc: SessionDoc = {
      name: sess.name,
      sortOrder: sess.sortOrder,
      judgeIds,
      heatIndex,
      cddId: sess.cddId ?? null,
      cddData: sess.cddData ?? null,
    };
    await adminDb.doc(sessionPath(competitionId, sessionId)).set(sessionDoc, { merge: true });
    await rebuildSessionLive(competitionId, sessionId);
  }

  return { ok: true as const, competitionId, heatingWarnings: heatingNotes };
}
