import type { Scale } from "./scoring";

export const SAMPLE_PASSWORD = "demo";

export const JUDGES = ["D. APPEL", "K. LINKOUS", "S. HANSEN", "C. GRABER", "R. CHAMPION"] as const;

export const COMPETITION = {
  name: "LoneStar Invitational 2026",
  dateLabel: "2026",
  location: "",
  status: "Sample",
};

export const SESSION_NAME = "Division III Finals";

export const DIVISION = {
  name: "Division III",
  scale: "COUPLES" as Scale,
  rule9Count: 5,
};

export const COUPLES = [
  { bib: 306, name: "JOSHUA GORAUM & BELYNN BUCKLEY" },
  { bib: 283, name: "SETH LOWERY & NATALIE CHAVEZ" },
  { bib: 279, name: "ANTHONY RIOJAS & ADRIANNE ZIARKOWSKI" },
] as const;

/** Summary columns follow the exported sheet (includes VWZ as 0s). Floor order includes VWZ between NC2 and WLZ. */
export const DANCES = [
  { name: "Triple Two", abbrev: "TR2", order: 1 },
  { name: "Polka", abbrev: "PLK", order: 2 },
  { name: "Nightclub", abbrev: "NC2", order: 3 },
  { name: "Cha Cha", abbrev: "CHA", order: 4 },
  { name: "Viennese Waltz", abbrev: "VWZ", order: 5 },
  { name: "Waltz", abbrev: "WLZ", order: 6 },
  { name: "Two Step", abbrev: "2ST", order: 7 },
  { name: "East Coast Swing", abbrev: "ECS", order: 8 },
  { name: "West Coast Swing", abbrev: "WCS", order: 9 },
] as const;

/** One heat = one song/style, in floor order (VWZ between NC2 and WLZ). */
export const HEATS: { number: number; abbrev: string }[] = [
  { number: 1, abbrev: "TR2" },
  { number: 2, abbrev: "NC2" },
  { number: 3, abbrev: "VWZ" },
  { number: 4, abbrev: "WLZ" },
  { number: 5, abbrev: "PLK" },
  { number: 6, abbrev: "CHA" },
  { number: 7, abbrev: "ECS" },
  { number: 8, abbrev: "2ST" },
  { number: 9, abbrev: "WCS" },
];

type Mark = [medal: string, place: number];

/** Judge columns follow JUDGES: Appel, Linkous, Hansen, Graber, Champion. */
export const MARKS: Record<string, Record<number, Mark[]>> = {
  TR2: {
    306: [["H", 1], ["H", 1], ["GG", 2], ["H", 1], ["H", 1]],
    279: [["H", 2], ["H", 2], ["GG", 1], ["G", 2], ["G", 2]],
  },
  NC2: {
    306: [["GG", 1], ["GG", 1], ["H", 2], ["H", 1], ["GG", 1]],
    279: [["H", 2], ["H", 2], ["H", 1], ["G", 2], ["H", 2]],
  },
  WLZ: {
    306: [["GG", 1], ["H", 1], ["G", 3], ["H", 1], ["GG", 1]],
    279: [["H", 2], ["H", 2], ["H", 2], ["G", 3], ["H", 2]],
    283: [["H", 3], ["H", 3], ["GG", 1], ["H", 2], ["H", 3]],
  },
  PLK: {
    283: [["GG", 1], ["GG", 1], ["H", 1], ["H", 1], ["H", 1]],
  },
  CHA: {
    283: [["H", 1], ["H", 1], ["H", 1], ["H", 1], ["GG", 1]],
  },
  ECS: {
    283: [["H", 2], ["H", 1], ["H", 1], ["H", 1], ["H", 2]],
    306: [["GG", 1], ["H", 2], ["H", 2], ["H", 2], ["GG", 1]],
  },
  "2ST": {
    306: [["GG", 1], ["H", 2], ["H", 3], ["H", 1], ["GG", 1]],
    283: [["H", 2], ["H", 1], ["H", 1], ["H", 2], ["H", 2]],
    279: [["H", 3], ["H", 3], ["H", 2], ["G", 3], ["H", 3]],
  },
  WCS: {
    279: [["H", 2], ["GG", 1], ["H", 2], ["H", 1], ["GG", 1]],
    306: [["H", 1], ["H", 2], ["H", 3], ["H", 2], ["G", 3]],
    283: [["G", 3], ["G", 3], ["GG", 1], ["G", 3], ["H", 2]],
  },
};
