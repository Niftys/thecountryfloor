"use client";

export type QueuedHeatSubmit = {
  id: string;
  createdAt: string;
  payload: {
    competitionId: string;
    sessionId: string;
    heatId: string;
    confirm: boolean;
    asJudgeId?: string;
    clientRequestId: string;
    scores: {
      heatEntryId: string;
      medal: string | null;
      placement: number | null;
      notes: string;
      scratched: boolean;
    }[];
  };
};

const KEY = "countryfloor.offlineHeatQueue";

export function loadOfflineQueue(): QueuedHeatSubmit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedHeatSubmit[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(items: QueuedHeatSubmit[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function enqueueOfflineSubmit(item: QueuedHeatSubmit) {
  const current = loadOfflineQueue();
  const withoutDup = current.filter((row) => row.payload.clientRequestId !== item.payload.clientRequestId);
  saveOfflineQueue([...withoutDup, item]);
}

export function removeOfflineSubmit(clientRequestId: string) {
  saveOfflineQueue(loadOfflineQueue().filter((row) => row.payload.clientRequestId !== clientRequestId));
}

export async function flushOfflineQueue(): Promise<{ sent: number; remaining: number; error?: string }> {
  const queue = loadOfflineQueue();
  if (queue.length === 0) return { sent: 0, remaining: 0 };

  let sent = 0;
  for (const item of [...queue]) {
    try {
      const response = await fetch("/api/judge/heat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });
      if (!response.ok && response.status !== 401) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        return { sent, remaining: loadOfflineQueue().length, error: body?.error ?? "Sync failed" };
      }
      if (response.ok) {
        removeOfflineSubmit(item.payload.clientRequestId);
        sent += 1;
      } else {
        return { sent, remaining: loadOfflineQueue().length, error: "Session expired while syncing." };
      }
    } catch {
      return { sent, remaining: loadOfflineQueue().length, error: "Still offline." };
    }
  }
  return { sent, remaining: loadOfflineQueue().length };
}

export function newClientRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
