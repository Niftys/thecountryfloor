"use client";

import {
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
  type User,
} from "firebase/auth";
import { useEffect, useState } from "react";
import { getClientAuth } from "@/lib/firebase/client";

/**
 * Ensures the Firebase web client is signed in with role claims whenever a
 * server __session exists. Scrutineer live listeners need this; the cookie alone is not enough.
 */
export function ClientAuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function waitForAuthUser(): Promise<User | null> {
      const auth = getClientAuth();
      if (auth.currentUser) return auth.currentUser;
      await auth.authStateReady();
      if (auth.currentUser) return auth.currentUser;
      return new Promise<User | null>((resolve) => {
        const unsub = onAuthStateChanged(auth, (user) => {
          unsub();
          resolve(user);
        });
      });
    }

    async function ensureRoleClaim(force = true) {
      const auth = getClientAuth();
      const user = auth.currentUser;
      if (!user) return false;
      await user.getIdToken(force);
      const token = await user.getIdTokenResult(force);
      return Boolean(token.claims.role);
    }

    async function syncFromServerSession() {
      const auth = getClientAuth();
      try {
        await waitForAuthUser();

        const response = await fetch("/api/auth/session-token", {
          method: "POST",
          credentials: "same-origin",
        });

        if (response.status === 401) {
          if (auth.currentUser) await signOut(auth);
          if (!cancelled) {
            setReady(true);
            setError(null);
          }
          return;
        }

        const body = (await response.json().catch(() => null)) as {
          error?: string;
          uid?: string;
          customToken?: string | null;
          tokenError?: string | null;
        } | null;

        if (!response.ok) {
          throw new Error(body?.error ?? "Could not restore Firebase session.");
        }
        if (!body?.uid) {
          throw new Error("Session token response was incomplete.");
        }

        if (auth.currentUser?.uid === body.uid) {
          if (await ensureRoleClaim(true)) {
            if (!cancelled) {
              setReady(true);
              setError(null);
            }
            return;
          }
        }

        if (body.customToken) {
          const credential = await signInWithCustomToken(auth, body.customToken);
          await credential.user.getIdToken(true);
          if (!(await ensureRoleClaim(true))) {
            await new Promise((r) => setTimeout(r, 400));
            if (!(await ensureRoleClaim(true))) {
              throw new Error("Signed in, but role claim is missing for Firestore rules.");
            }
          }
          if (!cancelled) {
            setReady(true);
            setError(null);
          }
          return;
        }

        // Claims were updated but we could not mint a custom token, and the
        // browser is not signed in as this user (or claims still missing).
        throw new Error(
          body.tokenError
            ? `Live Auth sync needs a fresh sign-in (${body.tokenError}).`
            : "Live Auth sync needs a fresh sign-in. Sign out and sign back in.",
        );
      } catch (err) {
        if (!cancelled) {
          setReady(true);
          setError(err instanceof Error ? err.message : "Firebase client auth failed.");
        }
      }
    }

    void syncFromServerSession();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;
  return (
    <>
      {error ? (
        <div style={{ padding: 12, background: "#ffebee", color: "#b71c1c", fontSize: 14 }}>
          Live updates may be offline: {error}
        </div>
      ) : null}
      {children}
    </>
  );
}
