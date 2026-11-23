import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { Role } from "@/lib/store/types";

export type { Role };

export type SessionUser = {
  id: string;
  role: Role;
  username: string;
  displayName: string;
};

export const COOKIE = "__session";
const SESSION_DAYS = 5;

export async function createSessionCookie(idToken: string) {
  const expiresIn = SESSION_DAYS * 24 * 60 * 60 * 1000;
  return adminAuth.createSessionCookie(idToken, { expiresIn });
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const session = jar.get(COOKIE)?.value;
  if (!session) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    // Always prefer Firestore profile so role/name changes apply without re-login.
    const profile = await adminDb.collection("users").doc(decoded.uid).get();
    if (!profile.exists) return null;
    const data = profile.data() as { role: Role; username: string; displayName: string };
    return {
      id: decoded.uid,
      role: data.role,
      username: data.username,
      displayName: data.displayName,
    };
  } catch {
    return null;
  }
}

export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

export async function setSessionCookie(value: string) {
  const jar = await cookies();
  jar.set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
