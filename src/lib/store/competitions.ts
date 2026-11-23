import type { DocumentReference, DocumentSnapshot } from "firebase-admin/firestore";
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
  MarkOriginal,
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

async function readDocs(refs: DocumentReference[]): Promise<DocumentSnapshot[]> {
  if (refs.length === 0) return [];
  const snaps: DocumentSnapshot[] = [];
  for (let index = 0; index < refs.length; index += 100) {
    snaps.push(...(await adminDb.getAll(...refs.slice(index, index + 100))));
  }
  return snaps;
}

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
  const snaps = await readDocs(unique.map((id) => adminDb.collection("users").doc(id)));
  for (const doc of snaps) {
    if (doc.exists) users.set(doc.id, { id: doc.id, ...(doc.data() as UserDoc) });
  }
  return users;
}

export async function rebuildSessionLive(competitionId: string, sessionId: string) {
  const session = await getSession(competitionId, sessionId);
  if (!session) return null;
  const heats = await listHeats(competitionId, sessionId);
  const panel = new Set(session.judgeIds);
  const judgeCount = session.judgeIds.length;
  const liveHeats: LiveHeatStatus[] = heats.map((heat) => {
    const style = heat.styleAbbrev || heat.styleName || `H${heat.number}`;
    const confirmed = heat.confirmedJudgeIds.filter((id) => panel.has(id)).length;
    return {
      id: heat.id,
      number: heat.number,
      // Keep short — full division lists belong in heat detail, not polling chips.
      label: style,
      confirmed,
      judges: judgeCount,
      complete: judgeCount > 0 && confirmed >= judgeCount,
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
  const panel = new Set(judgeIds);
  await adminDb.doc(sessionPath(competitionId, sessionId)).update({ judgeIds });
  const heats = await listHeats(competitionId, sessionId);
  for (const heat of heats) {
    const next = heat.confirmedJudgeIds.filter((id) => panel.has(id));
    if (
      next.length !== heat.confirmedJudgeIds.length ||
      heat.confirmCount !== next.length
    ) {
      await adminDb.doc(heatPath(competitionId, sessionId, heat.id)).update({
        confirmedJudgeIds: next,
        confirmCount: next.length,
      });
    }
  }
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

  const sheetSnaps = await readDocs(
    heats.map((heat) => adminDb.doc(judgeSheetPath(competitionId, sessionId, heat.id, judgeId))),
  );

  const boardHeats = heats.map((heat, index) => {
    const snap = sheetSnaps[index];
    const sheet = snap?.exists ? (snap.data() as JudgeSheetDoc) : null;
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
  const sessionRef = adminDb.doc(sessionPath(input.competitionId, input.sessionId));

  let idempotent = false;
  await adminDb.runTransaction(async (tx) => {
    const [existing, heatSnap, sessionSnap] = await Promise.all([
      tx.get(sheetRef),
      tx.get(heatRef),
      tx.get(sessionRef),
    ]);
    if (
      input.clientRequestId &&
      existing.exists &&
      (existing.data() as JudgeSheetDoc).clientRequestId === input.clientRequestId
    ) {
      idempotent = true;
      return;
    }

    if (!heatSnap.exists) throw new Error("Heat not found");
    if (!sessionSnap.exists) throw new Error("Session not found");
    const heatData = heatSnap.data() as HeatDoc;
    const session = sessionSnap.data() as SessionDoc;
    if (!session.judgeIds.includes(input.judgeId)) throw new Error("Judge not on panel");

    const prior = existing.exists ? (existing.data() as JudgeSheetDoc) : null;
    if (prior?.confirmedAt) {
      throw new Error("This heat is already confirmed and locked. Ask a scrutineer to change marks.");
    }

    const confirmedAt = input.confirm ? new Date().toISOString() : null;
    const sheet: JudgeSheetDoc = {
      marks: input.marks,
      confirmedAt,
      clientRequestId: input.clientRequestId ?? null,
    };
    tx.set(sheetRef, sheet, { merge: true });

    if (input.confirm) {
      const panel = new Set(session.judgeIds);
      let confirmedJudgeIds = heatData.confirmedJudgeIds.filter((id) => panel.has(id));
      if (!confirmedJudgeIds.includes(input.judgeId)) {
        confirmedJudgeIds = [...confirmedJudgeIds, input.judgeId];
      }
      tx.update(heatRef, {
        confirmedJudgeIds,
        confirmCount: confirmedJudgeIds.length,
      });
    }
  });

  if (idempotent) return { ok: true as const, idempotent: true };
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

function asOriginal(mark: {
  medal: string | null;
  placement: number | null;
  notes: string;
  scratched: boolean;
}): MarkOriginal {
  return {
    medal: mark.medal,
    placement: mark.placement,
    notes: mark.notes,
    scratched: mark.scratched,
  };
}

async function findOriginalFromAudits(
  competitionId: string,
  divisionId: string,
  scoreKeyValue: string,
): Promise<MarkOriginal | null> {
  const audits = await listAudits(competitionId, divisionId, 250);
  const chronological = [...audits]
    .filter((audit) => audit.scoreKey === scoreKeyValue)
    .sort((a, b) => a.at.localeCompare(b.at));
  for (const audit of chronological) {
    try {
      const before = JSON.parse(audit.before) as MarkEmbedded | null;
      if (!before) continue;
      if (!before.overridden) return asOriginal(before);
      if (before.original) return before.original;
    } catch {
      /* skip bad audit rows */
    }
  }
  return null;
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
  const scoreKeyValue = `${input.heatId}__${input.entryId}__${input.judgeId}`;
  let original = before?.original ?? null;
  if (!original && before && !before.overridden) {
    original = asOriginal(before);
  }
  if (!original && before?.overridden) {
    original = await findOriginalFromAudits(input.competitionId, input.divisionId, scoreKeyValue);
  }
  const after: MarkEmbedded = {
    medal: input.mark.medal,
    placement: input.mark.placement,
    notes: input.mark.notes,
    scratched: input.mark.scratched,
    overridden: true,
    original,
  };
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
    scoreKey: scoreKeyValue,
  });
}

/** Restore a mark to the judge's original confirmed grade (undo scrutineer override). */
export async function restoreJudgeMark(input: {
  competitionId: string;
  sessionId: string;
  heatId: string;
  judgeId: string;
  entryId: string;
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
  if (!existing.exists) throw new Error("Judge sheet not found");
  const sheet = existing.data() as JudgeSheetDoc;
  const before = sheet.marks[input.entryId];
  if (!before) throw new Error("Mark not found");
  if (!before.overridden) throw new Error("Mark is already the judge's original.");

  const scoreKeyValue = `${input.heatId}__${input.entryId}__${input.judgeId}`;
  const original =
    before.original ??
    (await findOriginalFromAudits(input.competitionId, input.divisionId, scoreKeyValue));
  if (!original) {
    throw new Error("No original judge mark is stored for this score; cannot restore.");
  }

  const after: MarkEmbedded = {
    ...original,
    overridden: false,
    original: null,
  };
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
    scoreKey: scoreKeyValue,
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
