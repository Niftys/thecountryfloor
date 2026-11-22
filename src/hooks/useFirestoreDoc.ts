"use client";

import { doc, onSnapshot, type DocumentReference } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getClientDb } from "@/lib/firebase/client";

function docFromPath(path: string): DocumentReference {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2 || parts.length % 2 !== 0) {
    throw new Error(`Invalid Firestore document path: ${path}`);
  }
  const [collectionId, ...rest] = parts;
  return doc(getClientDb(), collectionId!, ...rest);
}

/** Narrow listener — one document. Prefer this over full-page SSR refresh. */
export function useFirestoreDoc<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = onSnapshot(
        docFromPath(path),
        (snap) => {
          setData(snap.exists() ? (snap.data() as T) : null);
          setError(null);
        },
        (err) => setError(err.message),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid path");
    }
    return () => unsubscribe?.();
  }, [path]);

  return { data, error };
}
