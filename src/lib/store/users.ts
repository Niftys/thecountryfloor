import { adminAuth, adminDb, authEmailForUsername } from "@/lib/firebase/admin";
import type { Role, UserDoc } from "@/lib/store/types";

export async function listUsers() {
  const snap = await adminDb.collection("users").orderBy("username").get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as UserDoc) }));
}

export async function getUser(uid: string) {
  const doc = await adminDb.collection("users").doc(uid).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as UserDoc) };
}

export async function findUserByUsername(username: string) {
  const snap = await adminDb
    .collection("users")
    .where("username", "==", username.trim().toLowerCase())
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...(doc.data() as UserDoc) };
}

export async function createUser(input: {
  username: string;
  displayName: string;
  role: Role;
  password: string;
}) {
  const username = input.username.trim().toLowerCase();
  const email = authEmailForUsername(username);
  const existing = await findUserByUsername(username);
  if (existing) throw new Error("Username already exists");

  const user = await adminAuth.createUser({
    email,
    password: input.password,
    displayName: input.displayName,
  });
  const profile: UserDoc = {
    username,
    displayName: input.displayName,
    role: input.role,
  };
  await adminAuth.setCustomUserClaims(user.uid, {
    role: profile.role,
    username: profile.username,
    displayName: profile.displayName,
  });
  await adminDb.collection("users").doc(user.uid).set(profile);
  return { id: user.uid, ...profile };
}

export async function updateUser(
  uid: string,
  patch: Partial<{ displayName: string; role: Role; password: string; username: string }>,
) {
  const current = await getUser(uid);
  if (!current) throw new Error("User not found");

  const next: UserDoc = {
    username: patch.username?.trim().toLowerCase() ?? current.username,
    displayName: patch.displayName ?? current.displayName,
    role: patch.role ?? current.role,
  };

  if (patch.username && patch.username !== current.username) {
    const clash = await findUserByUsername(next.username);
    if (clash && clash.id !== uid) throw new Error("Username already exists");
    await adminAuth.updateUser(uid, { email: authEmailForUsername(next.username) });
  }
  if (patch.displayName) {
    await adminAuth.updateUser(uid, { displayName: next.displayName });
  }
  if (patch.password) {
    await adminAuth.updateUser(uid, { password: patch.password });
  }

  await adminAuth.setCustomUserClaims(uid, {
    role: next.role,
    username: next.username,
    displayName: next.displayName,
  });
  await adminDb.collection("users").doc(uid).set(next);
  return { id: uid, ...next };
}

export async function deleteUser(uid: string) {
  await adminDb.collection("users").doc(uid).delete();
  await adminAuth.deleteUser(uid);
}

export async function countAdmins() {
  const snap = await adminDb.collection("users").where("role", "==", "ADMIN").get();
  return snap.size;
}
