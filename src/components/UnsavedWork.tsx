"use client";

import { createContext, useContext, useMemo, useState } from "react";

type UnsavedWorkValue = {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
};

const UnsavedWorkContext = createContext<UnsavedWorkValue>({
  dirty: false,
  setDirty: () => {},
});

export function UnsavedWorkProvider({ children }: { children: React.ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const value = useMemo(() => ({ dirty, setDirty }), [dirty]);
  return <UnsavedWorkContext.Provider value={value}>{children}</UnsavedWorkContext.Provider>;
}

export function useUnsavedWork() {
  return useContext(UnsavedWorkContext);
}
