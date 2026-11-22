"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { LiveEvent } from "@/lib/live";

type Options = {
  /** Soft refresh server components (admin/judge pages). */
  refreshPage?: boolean;
  /** Called for every live event so client boards can refetch. */
  onEvent?: (event: LiveEvent) => void;
  /** Ignore events until this many ms after mount (avoids double-load). */
  settleMs?: number;
};

export function useLiveSync(options: Options = {}) {
  const router = useRouter();
  const onEventRef = useRef(options.onEvent);
  onEventRef.current = options.onEvent;

  useEffect(() => {
    const refreshPage = options.refreshPage ?? true;
    const settleMs = options.settleMs ?? 300;
    const started = Date.now();
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    function connect() {
      if (closed) return;
      source = new EventSource("/api/events");
      source.onmessage = (message) => {
        if (Date.now() - started < settleMs) return;
        let event: LiveEvent;
        try {
          event = JSON.parse(message.data) as LiveEvent;
        } catch {
          return;
        }
        if (event.type === "ping") return;
        onEventRef.current?.(event);
        if (refreshPage) router.refresh();
      };
      source.onerror = () => {
        source?.close();
        source = null;
        if (closed) return;
        reconnectTimer = setTimeout(connect, 2000);
      };
    }

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source?.close();
    };
  }, [options.refreshPage, options.settleMs, router]);
}
