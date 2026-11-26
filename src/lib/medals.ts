/** Distinct hues so neighboring medals stay readable under ballroom light. */
export const MEDAL_COLORS: Record<string, { bg: string; fg: string }> = {
  M: { bg: "#6a1b9a", fg: "#fff" },
  B: { bg: "#b87333", fg: "#fff" },
  S: { bg: "#546e7a", fg: "#fff" },
  "S+": { bg: "#00838f", fg: "#fff" },
  G: { bg: "#2e7d32", fg: "#fff" },
  "G+": { bg: "#1b5e20", fg: "#fff" },
  H: { bg: "#1565c0", fg: "#fff" },
  "H+": { bg: "#0d47a1", fg: "#fff" },
  GG: { bg: "#e65100", fg: "#fff" },
};

export function medalColor(medal: string): { bg: string; fg: string } {
  return MEDAL_COLORS[medal] ?? { bg: "#212121", fg: "#fff" };
}
