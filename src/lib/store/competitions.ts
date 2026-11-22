import type { DocumentReference } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import {
  auditsCollection,
  competitionRef,
  divisionPath,
  divisionResultsPath,
  heatPath,
  judgeSheetPath,
  sessionLivePath,
  sessionPath,
} from "@/lib/store/paths";
import type {
  AuditDoc,
  CompetitionDoc,
  DivisionDoc,
  HeatDoc,
  JudgeSheetDoc,
  LiveHeatStatus,
  MarkEmbedded,
  SessionDoc,
  SessionLiveDoc,
  UserDoc,
} from "@/lib/store/types";

export type CompetitionListItem = CompetitionDoc & { id: string };

export async function listCompetitions(options: { activeOnly?: boolean } = {}) {
  const snap = options.activeOnly
    ? await adminDb.collection("competitions").where("active", "==", true).get()
    : await adminDb.collection("competitions").get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as CompetitionDoc) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCompetition(competitionId: string) {
  const doc = await adminDb.doc(competitionRef(competitionId)).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as CompetitionDoc) };
}

export async function setCompetitionActive(competitionId: string, active: boolean) {
  await adminDb.doc(competitionRef(competitionId)).update({ active });
}

export async function listDivisions(competitionId: string) {
  const snap = await adminDb.collection(`${competitionRef(competitionId)}/divisions`).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as DivisionDoc) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getDivision(competitionId: string, divisionId: string) {
  const doc = await adminDb.doc(divisionPath(competitionId, divisionId)).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as DivisionDoc) };
}

export async function listSessions(competitionId: string) {
  const snap = await adminDb.collection(`${competitionRef(competitionId)}/sessions`).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as SessionDoc) }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getSession(competitionId: string, sessionId: string) {
  const doc = await adminDb.doc(sessionPath(competitionId, sessionId)).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as SessionDoc) };
}

export async function getHeat(competitionId: string, sessionId: string, heatId: string) {
  const doc = await adminDb.doc(heatPath(competitionId, sessionId, heatId)).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as HeatDoc) };
}

export async function listHeats(competitionId: string, sessionId: string) {
  const snap = await adminDb.collection(`${sessionPath(competitionId, sessionId)}/heats`).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as HeatDoc) }))
    .sort((a, b) => a.number - b.number);
}

export async function getJudgeSheet(
  competitionId: string,
  sessionId: string,
  heatId: string,
  judgeId: string,
) {
  const doc = await adminDb
    .doc(judgeSheetPath(competitionId, sessionId, heatId, judgeId))
    .get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as JudgeSheetDoc) };
}

export async function getSessionLive(competitionId: string, sessionId: string) {
  const doc = await adminDb.doc(sessionLivePath(competitionId, sessionId)).get();
  if (!doc.exists) return null;
  return doc.data() as SessionLiveDoc;
}

export async function getUsersByIds(ids: string[]) {
  const unique = [...new Set(ids)];
  const users = new Map<string, UserDoc & { id: string }>();
  await Promise.all(
    unique.map(async (id) => {
      const doc = await adminDb.collection("users").doc(id).get();
      if (doc.exists) users.set(id, { id, ...(doc.data() as UserDoc) });
    }),
  );
  return users;
}

export async function rebuildSessionLive(competitionId: string, sessionId: string) {
  const session = await getSession(competitionId, sessionId);
  if (!session) return null;
  const heats = await listHeats(competitionId, sessionId);
  const judgeCount = session.judgeIds.length;
  const liveHeats: LiveHeatStatus[] = heats.map((heat) => {
    const divisions = [...new Set(heat.entries.map((entry) => entry.divisionName))];
    const style = heat.styleName || `Heat ${heat.number}`;
    return {
      id: heat.id,
      number: heat.number,
      label: divisions.length > 1 ? `${style} · ${divisions.join(" + ")}` : style,
      confirmed: heat.confirmCount,
      judges: judgeCount,
      complete: judgeCount > 0 && heat.confirmCount >= judgeCount,
    };
  });
  const live: SessionLiveDoc = {
    heats: liveHeats,
    updatedAt: new Date().toISOString(),
  };
  await adminDb.doc(sessionLivePath(competitionId, sessionId)).set(live);
  return live;
}

export async function setSessionJudges(
  competitionId: string,
  sessionId: string,
  judgeIds: string[],
) {
  await adminDb.doc(sessionPath(competitionId, sessionId)).update({ judgeIds });
  await rebuildSessionLive(competitionId, sessionId);
}

export type JudgeHeatBoard = {
  competition: CompetitionListItem;
  session: SessionDoc & { id: string };
  panel: { id: string; label: string }[];
  heats: {
    id: string;
    number: number;
    submitted: boolean;
    groups: {
      divisionId: string;
      divisionName: string;
      scale: string;
      danceName: string;
      entries: {
        heatEntryId: string;
        bib: number;
        name: string;
        medal: string | null;
        placement: number | null;
        notes: string;
        scratched: boolean;
      }[];
    }[];
  }[];
};

export async function loadJudgeBoard(
  competitionId: string,
  sessionId: string,
  judgeId: string,
): Promise<JudgeHeatBoard | null> {
  const [competition, session, heats] = await Promise.all([
    getCompetition(competitionId),
    getSession(competitionId, sessionId),
    listHeats(competitionId, sessionId),
  ]);
  if (!competition || !session) return null;

  const users = await getUsersByIds(session.judgeIds);
  const panel = session.judgeIds
    .map((id) => users.get(id))
    .filter(Boolean)
    .map((user) => ({ id: user!.id, label: user!.displayName }));

  const sheets = await Promise.all(
    heats.map((heat) => getJudgeSheet(competitionId, sessionId, heat.id, judgeId)),
  );

  const boardHeats = heats.map((heat, index) => {
    const sheet = sheets[index];
    const groups = new Map<string, JudgeHeatBoard["heats"][number]["groups"][number]>();
    for (const entry of heat.entries) {
      const key = `${entry.divisionId}:${entry.danceId}`;
      const group = groups.get(key) ?? {
        divisionId: entry.divisionId,
        divisionName: entry.divisionName,
        scale: entry.scale,
        danceName: entry.danceName,
        entries: [],
      };
      const mark = sheet?.marks?.[entry.id];
      group.entries.push({
        heatEntryId: entry.id,
        bib: entry.bib,
        name: entry.name,
        medal: mark?.medal ?? null,
        placement: mark?.placement ?? null,
        notes: mark?.notes ?? "",
        scratched: mark?.scratched ?? false,
      });
      groups.set(key, group);
    }
    return {
      id: heat.id,
      number: heat.number,
      submitted: Boolean(sheet?.confirmedAt) || heat.confirmedJudgeIds.includes(judgeId),
      groups: [...groups.values()].map((group) => ({
        ...group,
        entries: group.entries.sort((a, b) => a.bib - b.bib),
      })),
    };
  });

  return { competition, session, panel, heats: boardHeats };
}

export async function submitJudgeHeat(input: {
  competitionId: string;
  sessionId: string;
  heatId: string;
  judgeId: string;
  confirm: boolean;
  clientRequestId?: string;
  marks: Record<string, MarkEmbedded>;
}) {
  const sheetRef = adminDb.doc(
    judgeSheetPath(input.competitionId, input.sessionId, input.heatId, input.judgeId),
  );
  const heatRef = adminDb.doc(
    heatPath(input.competitionId, input.sessionId, input.heatId),
  );

  const existing = await sheetRef.get();
  if (
    input.clientRequestId &&
    existing.exists &&
    (existing.data() as JudgeSheetDoc).clientRequestId === input.clientRequestId
  ) {
    return { ok: true as const, idempotent: true };
  }

  const heat = await heatRef.get();
  if (!heat.exists) throw new Error("Heat not found");
  const heatData = heat.data() as HeatDoc;
  const session = await getSession(input.competitionId, input.sessionId);
  if (!session) throw new Error("Session not found");
  if (!session.judgeIds.includes(input.judgeId)) throw new Error("Judge not on panel");

  const confirmedAt = input.confirm
    ? new Date().toISOString()
    : ((existing.data() as JudgeSheetDoc | undefined)?.confirmedAt ?? null);
  const sheet: JudgeSheetDoc = {
    marks: input.marks,
    confirmedAt,
    clientRequestId: input.clientRequestId ?? null,
  };

  const batch = adminDb.batch();
  batch.set(sheetRef, sheet, { merge: true });

  if (input.confirm) {
    const already = heatData.confirmedJudgeIds.includes(input.judgeId);
    const confirmedJudgeIds = already
      ? heatData.confirmedJudgeIds
      : [...heatData.confirmedJudgeIds, input.judgeId];
    batch.update(heatRef, {
      confirmedJudgeIds,
      confirmCount: confirmedJudgeIds.length,
    });
  }

  await batch.commit();
  if (input.confirm) await rebuildSessionLive(input.competitionId, input.sessionId);
  return { ok: true as const, idempotent: false };
}

export async function listJudgeSheetsForHeat(
  competitionId: string,
  sessionId: string,
  heatId: string,
) {
  const snap = await adminDb
    .collection(`${heatPath(competitionId, sessionId, heatId)}/judgeSheets`)
    .get();
  return snap.docs.map((doc) => ({
    judgeId: doc.id,
    ...(doc.data() as JudgeSheetDoc),
  }));
}

export async function saveDivisionResults(
  competitionId: string,
  divisionId: string,
  results: Record<string, unknown>,
) {
  await adminDb.doc(divisionResultsPath(competitionId, divisionId)).set({
    ...results,
    updatedAt: new Date().toISOString(),
  });
}

export async function getDivisionResults(competitionId: string, divisionId: string) {
  const doc = await adminDb.doc(divisionResultsPath(competitionId, divisionId)).get();
  if (!doc.exists) return null;
  return doc.data() ?? null;
}

export async function appendAudit(
  competitionId: string,
  divisionId: string,
  audit: AuditDoc,
) {
  await adminDb.collection(auditsCollection(competitionId, divisionId)).add(audit);
}

export async function listAudits(competitionId: string, divisionId: string, limit = 100) {
  const snap = await adminDb
    .collection(auditsCollection(competitionId, divisionId))
    .orderBy("at", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as AuditDoc) }));
}

export async function updateJudgeMark(input: {
  competitionId: string;
  sessionId: string;
  heatId: string;
  judgeId: string;
  entryId: string;
  mark: MarkEmbedded;
  actorId: string;
  actorName: string;
  bib: number;
  dance: string;
  judgeName: string;
  divisionId: string;
}) {
  const sheetRef = adminDb.doc(
    judgeSheetPath(input.competitionId, input.sessionId, input.heatId, input.judgeId),
  );
  const existing = await sheetRef.get();
  const sheet = (existing.data() as JudgeSheetDoc | undefined) ?? {
    marks: {},
    confirmedAt: null,
  };
  const before = sheet.marks[input.entryId] ?? null;
  const after: MarkEmbedded = { ...input.mark, overridden: true };
  sheet.marks[input.entryId] = after;
  await sheetRef.set(sheet, { merge: true });
  await appendAudit(input.competitionId, input.divisionId, {
    at: new Date().toISOString(),
    actorId: input.actorId,
    actorName: input.actorName,
    bib: input.bib,
    dance: input.dance,
    judgeId: input.judgeId,
    judgeName: input.judgeName,
    before: JSON.stringify(before),
    after: JSON.stringify(after),
    scoreKey: `${input.heatId}__${input.entryId}__${input.judgeId}`,
  });
}

async function deleteSubcollections(docRef: DocumentReference) {
  const collections = await docRef.listCollections();
  for (const col of collections) {
    const docs = await col.listDocuments();
    for (const child of docs) {
      await deleteSubcollections(child);
      await child.delete();
    }
  }
}

export async function wipeCompetitions() {
  const snap = await adminDb.collection("competitions").get();
  for (const doc of snap.docs) {
    await deleteSubcollections(doc.ref);
    await doc.ref.delete();
  }
}

export async function wipeUsers() {
  const snap = await adminDb.collection("users").get();
  for (const doc of snap.docs) {
    await doc.ref.delete();
    try {
      await adminAuth.deleteUser(doc.id);
    } catch {
      /* ignore missing auth user */
    }
  }
}
