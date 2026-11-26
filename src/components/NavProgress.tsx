"use client";

import LinearProgress from "@mui/material/LinearProgress";
import { usePathname, useSearchParams } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useState } from "react";

const NavProgressContext = createContext<() => void>(() => {});

function NavProgressReset({ setPending }: { setPending: (pending: boolean) => void }) {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    setPending(false);
  }, [pathname, search, setPending]);
  return null;
}

export function NavProgressProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState(false);
  const start = useCallback(() => setPending(true), []);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setPending(false), 8000);
    return () => window.clearTimeout(timer);
  }, [pending]);

  return (
    <NavProgressContext.Provider value={start}>
      <Suspense fallback={null}>
        <NavProgressReset setPending={setPending} />
      </Suspense>
      {pending ? (
        <LinearProgress
          className="no-print"
          sx={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 2000 }}
        />
      ) : null}
      {children}
    </NavProgressContext.Provider>
  );
}

export function useNavProgress() {
  return useContext(NavProgressContext);
}
