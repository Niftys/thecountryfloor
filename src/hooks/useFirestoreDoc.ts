"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getClientDb } from "@/lib/firebase/client";

/** Narrow listener — one document. Prefer this over full-page SSR refresh. */
export function useFirestoreDoc<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    const unsubscribe = onSnapshot(
      doc(getClientDb(), ...path.split("/").filter(Boolean)),
      (snap) => {
        setData(snap.exists() ? (snap.data() as T) : null);
        setError(null);
      },
      (err) => setError(err.message),
    );
    return unsubscribe;
  }, [path]);

  return { data, error };
}
