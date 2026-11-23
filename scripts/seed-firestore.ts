/**
 * Seed Auth users + Firestore competitions.
 * Run with emulators:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run seed
 * Or against the real project with GOOGLE_APPLICATION_CREDENTIALS set.
 */
import { adminAuth, adminDb, authEmailForUsername } from "../src/lib/firebase/admin";
import { danceName } from "../src/lib/dances";
import {
  COMPETITION,
  COUPLES,
  DANCES,
  DIVISION,
  HEATS,
  JUDGES,
  MARKS,
  SAMPLE_PASSWORD,
  SESSION_NAME,
} from "../src/lib/sampleData";
import { rebuildSessionLive, wipeCompetitions, wipeUsers } from "../src/lib/store/competitions";
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
import type { Scale } from "../src/lib/scoring";
import { createUser } from "../src/lib/store/users";

async function ensureUser(input: {
  username: string;
  displayName: string;
  role: "ADMIN" | "JUDGE" | "SCRUTINEER";
}) {
  const email = authEmailForUsername(input.username);
  try {
    const existing = await adminAuth.getUserByEmail(email);
    await adminAuth.updateUser(existing.uid, {
      password: SAMPLE_PASSWORD,
      displayName: input.displayName,
    });
    await adminAuth.setCustomUserClaims(existing.uid, {
      role: input.role,
      username: input.username,
      displayName: input.displayName,
    });
    await adminDb.collection("users").doc(existing.uid).set({
      username: input.username,
      displayName: input.displayName,
      role: input.role,
    });
    return existing.uid;
  } catch {
    const created = await createUser({
      username: input.username,
      displayName: input.displayName,
      role: input.role,
      password: SAMPLE_PASSWORD,
    });
    return created.id;
  }
}

async function main() {
  const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  if (!usingEmulator && process.env.ALLOW_LIVE_SEED !== "true") {
    console.error(
      "Refusing to seed the live Firebase project.\n" +
        "Use emulators, or set ALLOW_LIVE_SEED=true with GOOGLE_APPLICATION_CREDENTIALS.",
    );
    process.exit(1);
  }

  console.log(usingEmulator ? "Wiping emulator seed data…" : "Wiping LIVE project seed data…");
  await wipeCompetitions();
  await wipeUsers();

  await ensureUser({ username: "admin", displayName: "Admin", role: "ADMIN" });
  await ensureUser({ username: "scrutineer", displayName: "Scrutineer", role: "SCRUTINEER" });

  const judgeIds: string[] = [];
  for (const displayName of JUDGES) {
    const username = displayName.replace(/\./g, "").trim().toLowerCase().replace(/\s+/g, ".");
    const id = await ensureUser({ username, displayName, role: "JUDGE" });
    judgeIds.push(id);
  }

  // —— LoneStar ——
  const lonestarId = adminDb.collection("competitions").doc().id;
  const lonestar: CompetitionDoc = {
    name: COMPETITION.name,
    dateLabel: COMPETITION.dateLabel,
    location: COMPETITION.location,
    status: COMPETITION.status,
    active: true,
  };
  await adminDb.doc(competitionRef(lonestarId)).set(lonestar);

  const divisionId = adminDb.collection("x").doc().id;
  const dances = DANCES.map((dance) => ({
    id: `${divisionId}_${dance.abbrev}`,
    name: dance.name,
    abbrev: dance.abbrev,
    sortOrder: dance.order,
  }));
  const competitors = COUPLES.map((couple) => ({
    id: `${divisionId}_${couple.bib}`,
    bib: couple.bib,
    name: couple.name,
  }));
  const divisionDoc: DivisionDoc = {
    name: DIVISION.name,
    scale: DIVISION.scale,
    rule9Count: DIVISION.rule9Count,
    dances,
    competitors,
  };
  await adminDb.doc(divisionPath(lonestarId, divisionId)).set(divisionDoc);

  const sessionId = adminDb.collection("x").doc().id;
  const heatIndex: SessionDoc["heatIndex"] = [];
  const now = new Date().toISOString();

  for (const heatPlan of HEATS) {
    const marks = MARKS[heatPlan.abbrev];
    if (!marks) continue;
    const dance = dances.find((item) => item.abbrev === heatPlan.abbrev);
    if (!dance) continue;
    const heatId = adminDb.collection("x").doc().id;
    const entries: HeatEntryEmbedded[] = [];
    for (const couple of competitors) {
      if (!marks[couple.bib as keyof typeof marks]) continue;
      entries.push({
        id: `${heatId}_${couple.id}_${dance.id}`,
        competitorId: couple.id,
        bib: couple.bib,
        name: couple.name,
        divisionId,
        divisionName: DIVISION.name,
        scale: DIVISION.scale,
        danceId: dance.id,
        danceName: dance.name,
        danceAbbrev: dance.abbrev,
      });
    }
    const heatDoc: HeatDoc = {
      number: heatPlan.number,
      styleAbbrev: heatPlan.abbrev,
      styleName: danceName(heatPlan.abbrev),
      entries,
      confirmedJudgeIds: [...judgeIds],
      confirmCount: judgeIds.length,
    };
    await adminDb.doc(heatPath(lonestarId, sessionId, heatId)).set(heatDoc);

    for (const [judgeIndex, judgeId] of judgeIds.entries()) {
      const sheetMarks: JudgeSheetDoc["marks"] = {};
      for (const entry of entries) {
        const row = marks[entry.bib as keyof typeof marks];
        const mark = row?.[judgeIndex];
        if (!mark) continue;
        sheetMarks[entry.id] = {
          medal: mark[0],
          placement: mark[1],
          notes: "",
          scratched: false,
          overridden: false,
        };
      }
      await adminDb.doc(judgeSheetPath(lonestarId, sessionId, heatId, judgeId)).set({
        marks: sheetMarks,
        confirmedAt: now,
      } satisfies JudgeSheetDoc);
    }

    heatIndex.push({
      id: heatId,
      number: heatPlan.number,
      styleAbbrev: heatPlan.abbrev,
      styleName: danceName(heatPlan.abbrev),
      divisionIds: [divisionId],
    });
  }

  const sessionDoc: SessionDoc = {
    name: SESSION_NAME,
    sortOrder: 1,
    judgeIds,
    heatIndex,
  };
  await adminDb.doc(sessionPath(lonestarId, sessionId)).set(sessionDoc);
  await rebuildSessionLive(lonestarId, sessionId);

  // —— Prairie Demo ——
  const prairieId = adminDb.collection("competitions").doc().id;
  await adminDb.doc(competitionRef(prairieId)).set({
    name: "Prairie Demo Classic 2025",
    dateLabel: "2025",
    location: "Fakeville Expo Hall",
    status: "Test",
    active: true,
  } satisfies CompetitionDoc);

  const openId = adminDb.collection("x").doc().id;
  const proamId = adminDb.collection("x").doc().id;
  const openDiv: DivisionDoc = {
    name: "Open Couples",
    scale: "COUPLES",
    rule9Count: 3,
    dances: [
      { id: `${openId}_2ST`, name: "Two Step", abbrev: "2ST", sortOrder: 7 },
      { id: `${openId}_WLZ`, name: "Waltz", abbrev: "WLZ", sortOrder: 3 },
      { id: `${openId}_WCS`, name: "West Coast Swing", abbrev: "WCS", sortOrder: 8 },
    ],
    competitors: [
      { id: `${openId}_101`, bib: 101, name: "ADA MORRIS & BEN CARTER" },
      { id: `${openId}_102`, bib: 102, name: "CARA WELLS & DAN PRICE" },
      { id: `${openId}_103`, bib: 103, name: "ELLA QUINN & FRANK YATES" },
    ],
  };
  const proamDiv: DivisionDoc = {
    name: "ProAm Newcomer",
    scale: "PROAM" as Scale,
    rule9Count: 2,
    dances: [
      { id: `${proamId}_2ST`, name: "Two Step", abbrev: "2ST", sortOrder: 7 },
      { id: `${proamId}_CHA`, name: "Cha Cha", abbrev: "CHA", sortOrder: 5 },
    ],
    competitors: [
      { id: `${proamId}_201`, bib: 201, name: "GINA LANE & PRO JOE" },
      { id: `${proamId}_202`, bib: 202, name: "HANA PARK & PRO KEN" },
    ],
  };
  await adminDb.doc(divisionPath(prairieId, openId)).set(openDiv);
  await adminDb.doc(divisionPath(prairieId, proamId)).set(proamDiv);

  const morningId = adminDb.collection("x").doc().id;
  const heat1Id = adminDb.collection("x").doc().id;
  const twoOpen = openDiv.dances[0]!;
  const twoPro = proamDiv.dances[0]!;
  const heat1Entries: HeatEntryEmbedded[] = [
    ...openDiv.competitors.map((couple) => ({
      id: `${heat1Id}_${couple.id}_${twoOpen.id}`,
      competitorId: couple.id,
      bib: couple.bib,
      name: couple.name,
      divisionId: openId,
      divisionName: openDiv.name,
      scale: openDiv.scale,
      danceId: twoOpen.id,
      danceName: twoOpen.name,
      danceAbbrev: twoOpen.abbrev,
    })),
    ...proamDiv.competitors.map((couple) => ({
      id: `${heat1Id}_${couple.id}_${twoPro.id}`,
      competitorId: couple.id,
      bib: couple.bib,
      name: couple.name,
      divisionId: proamId,
      divisionName: proamDiv.name,
      scale: proamDiv.scale,
      danceId: twoPro.id,
      danceName: twoPro.name,
      danceAbbrev: twoPro.abbrev,
    })),
  ];
  await adminDb.doc(heatPath(prairieId, morningId, heat1Id)).set({
    number: 1,
    styleAbbrev: "2ST",
    styleName: "Two Step",
    entries: heat1Entries,
    confirmedJudgeIds: [],
    confirmCount: 0,
  } satisfies HeatDoc);

  const afternoonId = adminDb.collection("x").doc().id;
  await adminDb.doc(sessionPath(prairieId, morningId)).set({
    name: "Morning Floor",
    sortOrder: 1,
    judgeIds,
    heatIndex: [
      {
        id: heat1Id,
        number: 1,
        styleAbbrev: "2ST",
        styleName: "Two Step",
        divisionIds: [openId, proamId],
      },
    ],
  } satisfies SessionDoc);
  await adminDb.doc(sessionPath(prairieId, afternoonId)).set({
    name: "Afternoon Floor",
    sortOrder: 2,
    judgeIds,
    heatIndex: [],
  } satisfies SessionDoc);
  await rebuildSessionLive(prairieId, morningId);
  await rebuildSessionLive(prairieId, afternoonId);

  // —— Cedar inactive ——
  const cedarId = adminDb.collection("competitions").doc().id;
  await adminDb.doc(competitionRef(cedarId)).set({
    name: "Cedar Ridge Showcase 2024",
    dateLabel: "2024",
    location: "Cedar Ridge",
    status: "Archived",
    active: false,
  } satisfies CompetitionDoc);
  const cedarDivId = adminDb.collection("x").doc().id;
  await adminDb.doc(divisionPath(cedarId, cedarDivId)).set({
    name: "Division I",
    scale: "COUPLES",
    rule9Count: 5,
    dances: [{ id: `${cedarDivId}_2ST`, name: "Two Step", abbrev: "2ST", sortOrder: 7 }],
    competitors: [{ id: `${cedarDivId}_1`, bib: 1, name: "SAMPLE & PAIR" }],
  } satisfies DivisionDoc);
  const cedarSess = adminDb.collection("x").doc().id;
  await adminDb.doc(sessionPath(cedarId, cedarSess)).set({
    name: "Evening",
    sortOrder: 1,
    judgeIds,
    heatIndex: [],
  } satisfies SessionDoc);
  await rebuildSessionLive(cedarId, cedarSess);

  console.log("Seed complete.");
  console.log("Logins (password demo12): admin, scrutineer, d.appel, …");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
