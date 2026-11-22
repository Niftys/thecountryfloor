import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export type Role = "ADMIN" | "JUDGE" | "SCRUTINEER";

export type SessionUser = {
  id: string;
  role: Role;
  username: string;
  displayName: string;
};

const COOKIE = "cf_session";

function secret() {
  return process.env.AUTH_SECRET || "countryfloor-dev-secret";
}

export function signSession(user: SessionUser): string {
  const body = Buffer.from(JSON.stringify(user)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readSessionToken(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const actual = Buffer.from(sig);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !crypto.timingSafeEqual(actual, wanted)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionUser;
    if (!parsed.id || !parsed.role || !parsed.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Cookie session, only if that user still exists (reseeds invalidate old ids). Does not modify cookies. */
export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const parsed = readSessionToken(jar.get(COOKIE)?.value);
  if (!parsed) return null;

  const user = await prisma.user.findUnique({ where: { id: parsed.id } });
  if (!user) return null;

  return {
    id: user.id,
    role: user.role as Role,
    username: user.username,
    displayName: user.displayName,
  };
}

export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

export { COOKIE };
