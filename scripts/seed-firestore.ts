/**
 * Seed Auth users + Firestore competitions.
 * Run with emulators:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run seed
 * Or against the real project with GOOGLE_APPLICATION_CREDENTIALS set.
 */
import { adminAuth, adminDb, authEmailForUsername } from "../src/lib/firebase/admin";
import { JUDGES, SAMPLE_PASSWORD } from "../src/lib/sampleData";
import { wipeCompetitions, wipeUsers } from "../src/lib/store/competitions";
import { createUser } from "../src/lib/store/users";
import { planSessionHeats } from "../src/lib/seed/acdaNationalsPlan";
import { seedAcdaNationalsCompetition } from "./seedNationalsCompetition";

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

function allowLiveSeed(): boolean {
  const raw = (process.env.ALLOW_LIVE_SEED ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

async function main() {
  const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  if (!usingEmulator && !allowLiveSeed()) {
    console.error(
      "Refusing to seed the live Firebase project.\n" +
        "Use emulators, or set ALLOW_LIVE_SEED=true (or 1) with GOOGLE_APPLICATION_CREDENTIALS.",
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

  for (const key of ["saturday", "sundayAm", "sundayPm"] as const) {
    console.log(`  plan ${key}: ${planSessionHeats(key).length} heats`);
  }

  console.log("Seeding ACDA National Championships 2026 (fully judged)…");
  const nationals = await seedAcdaNationalsCompetition(judgeIds, {
    name: "ACDA National Championships 2026",
    dateLabel: "November 19–22, 2026",
    location: "Dallas, TX",
    status: "Judged",
    cddId: "countryscores:E4IPWuo9G8JDP5kwmiOk",
    idPrefix: "nationals",
    judged: true,
  });
  console.log("  Nationals competitionId:", nationals.competitionId);
  console.log("  Heats by session:", nationals.sessionHeatCounts);

  console.log("Seeding ACDA Heartland Championships 2026 (same size, no marks)…");
  const heartland = await seedAcdaNationalsCompetition(judgeIds, {
    name: "ACDA Heartland Championships 2026",
    dateLabel: "March 12–15, 2026",
    location: "Kansas City, MO",
    status: "Unjudged",
    cddId: "heartland:2026",
    idPrefix: "heartland",
    judged: false,
    bibStart: 500,
    nameSalt: 97,
  });
  console.log("  Heartland competitionId:", heartland.competitionId);
  console.log("  Heats by session:", heartland.sessionHeatCounts);

  console.log("Seed complete.");
  console.log("Logins (password demo12): admin, scrutineer, d.appel, …");
  console.log(
    "ACDA National Championships 2026 is fully judged. ACDA Heartland Championships 2026 is the same floor with no marks.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
