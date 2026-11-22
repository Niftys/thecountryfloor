import { EventEmitter } from "events";

/**
 * Pluggable live bus.
 * Default: in-process EventEmitter (one Node instance).
 * When REDIS_URL is set later, swap publish/subscribe to Redis pub/sub without
 * changing callers — screens only speak publishLive / subscribeLive.
 */
export type LiveEvent = {
  type:
    | "competition"
    | "users"
    | "scores"
    | "submissions"
    | "heat"
    | "ping";
  competitionId?: string;
  sessionId?: string;
  heatId?: string;
  at: string;
};

const globalForLive = globalThis as unknown as {
  countryfloorLive?: EventEmitter;
};

function bus() {
  if (!globalForLive.countryfloorLive) {
    globalForLive.countryfloorLive = new EventEmitter();
    globalForLive.countryfloorLive.setMaxListeners(200);
  }
  return globalForLive.countryfloorLive;
}

export function publishLive(event: Omit<LiveEvent, "at">) {
  const payload: LiveEvent = { ...event, at: new Date().toISOString() };
  // Future: if (process.env.REDIS_URL) publishRedis(payload);
  bus().emit("live", payload);
}

export function subscribeLive(listener: (event: LiveEvent) => void) {
  // Future: if (process.env.REDIS_URL) return subscribeRedis(listener);
  const emitter = bus();
  emitter.on("live", listener);
  return () => {
    emitter.off("live", listener);
  };
}
