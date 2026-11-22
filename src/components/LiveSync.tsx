"use client";

import { useLiveSync } from "@/hooks/useLiveSync";

/** Drop on any server-rendered page that should refresh when the venue changes. */
export function LiveSync() {
  useLiveSync({ refreshPage: true });
  return null;
}
