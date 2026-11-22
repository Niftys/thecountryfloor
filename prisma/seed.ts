import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import {
  COMPETITION,
  COUPLES,
  DANCES,
  DIVISION,
  HEATS,
  JUDGES,
  MARKS,
  SAMPLE_PASSWORD,
  SESSION_NAME,
} from "../src/lib/sampleData";

const prisma = new PrismaClient();

/** Login username can differ from the name printed on sheets. */
const JUDGE_ACCOUNTS = JUDGES.map((displayName) => ({
  displayName,
  username: displayName
    .replace(/\./g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "."),
}));

async function seedLoneStar(judgeUsers: { id: string }[]) {
  const competition = await prisma.competition.create({
    data: {
      name: COMPETITION.name,
      dateLabel: COMPETITION.dateLabel,
      location: COMPETITION.location,
      status: COMPETITION.status,
      active: true,
    },
  });

  const division = await prisma.division.create({
    data: {
      competitionId: competition.id,
      name: DIVISION.name,
      scale: DIVISION.scale,
      rule9Count: DIVISION.rule9Count,
    },
  });

  const dances = new Map<string, { id: string }>();
  for (const dance of DANCES) {
    const created = await prisma.dance.create({
      data: {
        divisionId: division.id,
        name: dance.name,
        abbrev: dance.abbrev,
        sortOrder: dance.order,
      },
    });
    dances.set(dance.abbrev, created);
  }

  const couples = new Map<number, { id: string }>();
  for (const couple of COUPLES) {
    const created = await prisma.competitor.create({
      data: { divisionId: division.id, bib: couple.bib, name: couple.name },
    });
    couples.set(couple.bib, created);
  }

  const session = await prisma.session.create({
    data: { competitionId: competition.id, name: SESSION_NAME, sortOrder: 1 },
  });

  for (const [index, judge] of judgeUsers.entries()) {
    await prisma.sessionJudge.create({
      data: { sessionId: session.id, userId: judge.id, sortOrder: index },
    });
  }

  const now = new Date();
  for (const heatPlan of HEATS) {
    const dance = dances.get(heatPlan.abbrev);
    const marks = MARKS[heatPlan.abbrev];
    if (!dance || !marks) continue;

    const heat = await prisma.heat.create({
      data: { sessionId: session.id, number: heatPlan.number },
    });

    for (const [bibText, judgeMarks] of Object.entries(marks)) {
      const bib = Number(bibText);
      const couple = couples.get(bib);
      if (!couple) continue;
      const entry = await prisma.heatEntry.create({
        data: { heatId: heat.id, competitorId: couple.id, danceId: dance.id },
      });
      for (const [index, mark] of judgeMarks.entries()) {
        await prisma.score.create({
          data: {
            heatEntryId: entry.id,
            judgeId: judgeUsers[index].id,
            medal: mark[0],
            placement: mark[1],
          },
        });
      }
    }

    for (const judge of judgeUsers) {
      await prisma.heatSubmission.create({
        data: { heatId: heat.id, judgeId: judge.id, confirmedAt: now },
      });
    }
  }

  return competition.id;
}

async function seedPrairieDemo(judgeUsers: { id: string }[]) {
  const competition = await prisma.competition.create({
    data: {
      name: "Prairie Demo Classic 2025",
      dateLabel: "2025",
      location: "Fakeville Expo Hall",
      status: "Test",
      active: true,
    },
  });

  const open = await prisma.division.create({
    data: {
      competitionId: competition.id,
      name: "Open Couples",
      scale: "COUPLES",
      rule9Count: 3,
    },
  });
  const proam = await prisma.division.create({
    data: {
      competitionId: competition.id,
      name: "ProAm Newcomer",
      scale: "PROAM",
      rule9Count: 2,
    },
  });

  const openTwo = await prisma.dance.create({
    data: { divisionId: open.id, name: "Two Step", abbrev: "2ST", sortOrder: 7 },
  });
  const openWaltz = await prisma.dance.create({
    data: { divisionId: open.id, name: "Waltz", abbrev: "WLZ", sortOrder: 3 },
  });
  const openWcs = await prisma.dance.create({
    data: { divisionId: open.id, name: "West Coast Swing", abbrev: "WCS", sortOrder: 8 },
  });
  const proTwo = await prisma.dance.create({
    data: { divisionId: proam.id, name: "Two Step", abbrev: "2ST", sortOrder: 7 },
  });
  const proCha = await prisma.dance.create({
    data: { divisionId: proam.id, name: "Cha Cha", abbrev: "CHA", sortOrder: 5 },
  });

  const openCouples = [
    await prisma.competitor.create({
      data: { divisionId: open.id, bib: 101, name: "ADA MORRIS & BEN CARTER" },
    }),
    await prisma.competitor.create({
      data: { divisionId: open.id, bib: 102, name: "CARA WELLS & DAN PRICE" },
    }),
    await prisma.competitor.create({
      data: { divisionId: open.id, bib: 103, name: "ELLA QUINN & FRANK YATES" },
    }),
  ];
  const proCouples = [
    await prisma.competitor.create({
      data: { divisionId: proam.id, bib: 201, name: "GINA LANE & PRO JOE" },
    }),
    await prisma.competitor.create({
      data: { divisionId: proam.id, bib: 202, name: "HANA PARK & PRO KEN" },
    }),
  ];

  const morning = await prisma.session.create({
    data: { competitionId: competition.id, name: "Morning Floor", sortOrder: 1 },
  });
  const afternoon = await prisma.session.create({
    data: { competitionId: competition.id, name: "Afternoon Floor", sortOrder: 2 },
  });

  for (const [index, judge] of judgeUsers.entries()) {
    await prisma.sessionJudge.create({
      data: { sessionId: morning.id, userId: judge.id, sortOrder: index },
    });
    await prisma.sessionJudge.create({
      data: { sessionId: afternoon.id, userId: judge.id, sortOrder: index },
    });
  }

  async function addEntry(
    heatId: string,
    competitorId: string,
    danceId: string,
    marks: Array<[string, number | null] | null>,
    usePlacement = true,
  ) {
    const entry = await prisma.heatEntry.create({
      data: { heatId, competitorId, danceId },
    });
    for (const [index, mark] of marks.entries()) {
      if (!mark) continue;
      await prisma.score.create({
        data: {
          heatEntryId: entry.id,
          judgeId: judgeUsers[index].id,
          medal: mark[0],
          placement: usePlacement ? mark[1] : null,
        },
      });
    }
    return entry;
  }

  const heat1 = await prisma.heat.create({ data: { sessionId: morning.id, number: 1 } });
  await addEntry(heat1.id, openCouples[0].id, openTwo.id, [
    ["H", 2],
    ["H", 1],
    ["GG", 1],
    ["H", 2],
    ["H", 1],
  ]);
  await addEntry(heat1.id, openCouples[1].id, openTwo.id, [
    ["G", 3],
    ["G", 3],
    ["H", 2],
    ["G", 3],
    ["G", 3],
  ]);
  await addEntry(heat1.id, openCouples[2].id, openTwo.id, [
    ["GG", 1],
    ["H", 2],
    ["H", 3],
    ["GG", 1],
    ["H", 2],
  ]);
  await addEntry(
    heat1.id,
    proCouples[0].id,
    proTwo.id,
    [
      ["G+", null],
      ["H", null],
      ["G", null],
      ["H+", null],
      ["G+", null],
    ],
    false,
  );
  await addEntry(
    heat1.id,
    proCouples[1].id,
    proTwo.id,
    [
      ["S+", null],
      ["G", null],
      ["S", null],
      ["G", null],
      ["S+", null],
    ],
    false,
  );
  for (const judge of judgeUsers) {
    await prisma.heatSubmission.create({
      data: { heatId: heat1.id, judgeId: judge.id, confirmedAt: new Date() },
    });
  }

  const heat2 = await prisma.heat.create({ data: { sessionId: morning.id, number: 2 } });
  await addEntry(heat2.id, openCouples[0].id, openWaltz.id, [
    ["GG", 1],
    ["H", 1],
    ["H", 2],
    ["GG", 1],
    ["H", 1],
  ]);
  await addEntry(heat2.id, openCouples[1].id, openWaltz.id, [
    ["H", 2],
    ["G", 2],
    ["H", 1],
    ["H", 2],
    ["G", 2],
  ]);
  for (const judge of judgeUsers) {
    await prisma.heatSubmission.create({
      data: { heatId: heat2.id, judgeId: judge.id, confirmedAt: new Date() },
    });
  }

  const heat3 = await prisma.heat.create({ data: { sessionId: morning.id, number: 3 } });
  await addEntry(heat3.id, openCouples[0].id, openWcs.id, [
    ["H", 1],
    ["GG", 1],
    null,
    null,
    null,
  ]);
  await addEntry(heat3.id, openCouples[2].id, openWcs.id, [
    ["G", 2],
    ["H", 2],
    null,
    null,
    null,
  ]);
  await prisma.heatSubmission.create({
    data: { heatId: heat3.id, judgeId: judgeUsers[0].id, confirmedAt: new Date() },
  });
  await prisma.heatSubmission.create({
    data: { heatId: heat3.id, judgeId: judgeUsers[1].id, confirmedAt: new Date() },
  });

  const aft1 = await prisma.heat.create({ data: { sessionId: afternoon.id, number: 1 } });
  await addEntry(aft1.id, proCouples[0].id, proCha.id, [null, null, null, null, null], false);
  await addEntry(aft1.id, proCouples[1].id, proCha.id, [null, null, null, null, null], false);

  const aft2 = await prisma.heat.create({ data: { sessionId: afternoon.id, number: 2 } });
  await addEntry(aft2.id, openCouples[1].id, openWaltz.id, [
    ["H", 1],
    ["H", 1],
    ["GG", 1],
    ["H", 1],
    ["H", 1],
  ]);
  const scratchedEntry = await addEntry(aft2.id, openCouples[2].id, openWaltz.id, [
    ["G", 2],
    ["G", 2],
    ["H", 2],
    ["G", 2],
    ["G", 2],
  ]);
  await prisma.score.update({
    where: {
      heatEntryId_judgeId: { heatEntryId: scratchedEntry.id, judgeId: judgeUsers[0].id },
    },
    data: { scratched: true, medal: null, placement: null },
  });

  return competition.id;
}

async function seedCedarRidge(judgeUsers: { id: string }[]) {
  const competition = await prisma.competition.create({
    data: {
      name: "Cedar Ridge Showcase 2024",
      dateLabel: "2024",
      location: "Maple Pavilion",
      status: "Test",
      active: false,
    },
  });

  const divOne = await prisma.division.create({
    data: {
      competitionId: competition.id,
      name: "Division I",
      scale: "COUPLES",
      rule9Count: 3,
    },
  });
  const divTwo = await prisma.division.create({
    data: {
      competitionId: competition.id,
      name: "Division II",
      scale: "COUPLES",
      rule9Count: 2,
    },
  });

  const d1Night = await prisma.dance.create({
    data: { divisionId: divOne.id, name: "Nightclub", abbrev: "NC2", sortOrder: 2 },
  });
  const d1Waltz = await prisma.dance.create({
    data: { divisionId: divOne.id, name: "Waltz", abbrev: "WLZ", sortOrder: 3 },
  });
  const d1Polka = await prisma.dance.create({
    data: { divisionId: divOne.id, name: "Polka", abbrev: "PLK", sortOrder: 4 },
  });
  const d1Two = await prisma.dance.create({
    data: { divisionId: divOne.id, name: "Two Step", abbrev: "2ST", sortOrder: 7 },
  });
  const d1Wcs = await prisma.dance.create({
    data: { divisionId: divOne.id, name: "West Coast Swing", abbrev: "WCS", sortOrder: 8 },
  });
  const d2Night = await prisma.dance.create({
    data: { divisionId: divTwo.id, name: "Nightclub", abbrev: "NC2", sortOrder: 2 },
  });
  const d2Two = await prisma.dance.create({
    data: { divisionId: divTwo.id, name: "Two Step", abbrev: "2ST", sortOrder: 7 },
  });

  const d1Couples = [
    await prisma.competitor.create({
      data: { divisionId: divOne.id, bib: 501, name: "IVY STONE & JAX COOPER" },
    }),
    await prisma.competitor.create({
      data: { divisionId: divOne.id, bib: 502, name: "MIRA BLOOM & NOAH REED" },
    }),
    await prisma.competitor.create({
      data: { divisionId: divOne.id, bib: 503, name: "PIPER SHAW & QUINN BLAKE" },
    }),
  ];
  const d2Couples = [
    await prisma.competitor.create({
      data: { divisionId: divTwo.id, bib: 601, name: "RORY GLENN & SAGE HOLT" },
    }),
    await prisma.competitor.create({
      data: { divisionId: divTwo.id, bib: 602, name: "TESS MARLOW & URI VANCE" },
    }),
  ];

  const evening = await prisma.session.create({
    data: { competitionId: competition.id, name: "Evening Block", sortOrder: 1 },
  });
  const late = await prisma.session.create({
    data: { competitionId: competition.id, name: "Late Night Block", sortOrder: 2 },
  });

  for (const [index, judge] of judgeUsers.entries()) {
    await prisma.sessionJudge.create({
      data: { sessionId: evening.id, userId: judge.id, sortOrder: index },
    });
    await prisma.sessionJudge.create({
      data: { sessionId: late.id, userId: judge.id, sortOrder: index },
    });
  }

  async function addEntry(
    heatId: string,
    competitorId: string,
    danceId: string,
    marks: Array<[string, number] | null>,
  ) {
    const entry = await prisma.heatEntry.create({
      data: { heatId, competitorId, danceId },
    });
    for (const [index, mark] of marks.entries()) {
      if (!mark) continue;
      await prisma.score.create({
        data: {
          heatEntryId: entry.id,
          judgeId: judgeUsers[index].id,
          medal: mark[0],
          placement: mark[1],
        },
      });
    }
    return entry;
  }

  const heat1 = await prisma.heat.create({ data: { sessionId: evening.id, number: 1 } });
  await addEntry(heat1.id, d1Couples[0].id, d1Night.id, [
    ["GG", 1],
    ["H", 1],
    ["H", 2],
    ["GG", 1],
    ["H", 1],
  ]);
  await addEntry(heat1.id, d1Couples[1].id, d1Night.id, [
    ["H", 2],
    ["G", 3],
    ["H", 1],
    ["H", 2],
    ["G", 2],
  ]);
  await addEntry(heat1.id, d1Couples[2].id, d1Night.id, [
    ["G", 3],
    ["H", 2],
    ["G", 3],
    ["G", 3],
    ["H", 3],
  ]);
  await addEntry(heat1.id, d2Couples[0].id, d2Night.id, [
    ["H", 1],
    ["GG", 1],
    ["H", 1],
    ["H", 2],
    ["GG", 1],
  ]);
  await addEntry(heat1.id, d2Couples[1].id, d2Night.id, [
    ["G", 2],
    ["H", 2],
    ["G", 2],
    ["GG", 1],
    ["H", 2],
  ]);
  for (const judge of judgeUsers) {
    await prisma.heatSubmission.create({
      data: { heatId: heat1.id, judgeId: judge.id, confirmedAt: new Date() },
    });
  }

  const heat2 = await prisma.heat.create({ data: { sessionId: evening.id, number: 2 } });
  await addEntry(heat2.id, d1Couples[0].id, d1Waltz.id, [
    ["H", 1],
    ["H", 2],
    ["GG", 1],
    ["H", 1],
    ["H", 1],
  ]);
  await addEntry(heat2.id, d1Couples[1].id, d1Waltz.id, [
    ["G", 2],
    ["GG", 1],
    ["H", 2],
    ["G", 2],
    ["G", 2],
  ]);
  for (const judge of judgeUsers.slice(0, 3)) {
    await prisma.heatSubmission.create({
      data: { heatId: heat2.id, judgeId: judge.id, confirmedAt: new Date() },
    });
  }

  const heat3 = await prisma.heat.create({ data: { sessionId: evening.id, number: 3 } });
  await addEntry(heat3.id, d1Couples[0].id, d1Polka.id, [
    ["H", 1],
    ["GG", 1],
    ["H", 1],
    ["H", 1],
    ["H", 1],
  ]);
  await addEntry(heat3.id, d1Couples[2].id, d1Polka.id, [
    ["G", 2],
    ["H", 2],
    ["G", 2],
    ["G", 2],
    ["H", 2],
  ]);
  for (const judge of judgeUsers) {
    await prisma.heatSubmission.create({
      data: { heatId: heat3.id, judgeId: judge.id, confirmedAt: new Date() },
    });
  }

  const late1 = await prisma.heat.create({ data: { sessionId: late.id, number: 1 } });
  await addEntry(late1.id, d1Couples[1].id, d1Two.id, [
    ["H", 1],
    ["H", 1],
    ["GG", 1],
    ["H", 2],
    ["H", 1],
  ]);
  await addEntry(late1.id, d1Couples[2].id, d1Two.id, [
    ["G", 2],
    ["G", 2],
    ["H", 2],
    ["G", 1],
    ["G", 2],
  ]);
  await addEntry(late1.id, d2Couples[0].id, d2Two.id, [
    ["GG", 1],
    ["H", 1],
    ["H", 1],
    ["GG", 1],
    ["H", 2],
  ]);
  await addEntry(late1.id, d2Couples[1].id, d2Two.id, [
    ["H", 2],
    ["G", 2],
    ["G", 2],
    ["H", 2],
    ["GG", 1],
  ]);

  const late2 = await prisma.heat.create({ data: { sessionId: late.id, number: 2 } });
  await addEntry(late2.id, d1Couples[0].id, d1Wcs.id, [
    ["H", 2],
    ["GG", 1],
    ["H", 1],
    ["H", 2],
    ["GG", 1],
  ]);
  await addEntry(late2.id, d1Couples[2].id, d1Wcs.id, [
    ["GG", 1],
    ["H", 2],
    ["G", 2],
    ["GG", 1],
    ["H", 2],
  ]);

  const overrideHeat = await prisma.heat.findFirst({
    where: { sessionId: evening.id, number: 1 },
    include: { entries: { include: { scores: true, competitor: true } } },
  });
  const overrideEntry = overrideHeat?.entries.find((entry) => entry.competitor.bib === 501);
  const overrideScore = overrideEntry?.scores.find((score) => score.judgeId === judgeUsers[2].id);
  if (overrideScore) {
    await prisma.score.update({
      where: { id: overrideScore.id },
      data: { medal: "G", placement: 2, overridden: true },
    });
  }

  return competition.id;
}

async function main() {
  await prisma.scoreAudit.deleteMany();
  await prisma.score.deleteMany();
  await prisma.heatSubmission.deleteMany();
  await prisma.heatEntry.deleteMany();
  await prisma.heat.deleteMany();
  await prisma.sessionJudge.deleteMany();
  await prisma.session.deleteMany();
  await prisma.competitor.deleteMany();
  await prisma.dance.deleteMany();
  await prisma.division.deleteMany();
  await prisma.competition.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = bcrypt.hashSync(SAMPLE_PASSWORD, 10);

  await prisma.user.create({
    data: { username: "admin", passwordHash, role: "ADMIN", displayName: "Admin" },
  });
  await prisma.user.create({
    data: { username: "scrutineer", passwordHash, role: "SCRUTINEER", displayName: "Scrutineer" },
  });

  const judgeUsers = [];
  for (const account of JUDGE_ACCOUNTS) {
    judgeUsers.push(
      await prisma.user.create({
        data: {
          username: account.username,
          passwordHash,
          role: "JUDGE",
          displayName: account.displayName,
        },
      }),
    );
  }

  await seedLoneStar(judgeUsers);
  await seedPrairieDemo(judgeUsers);
  await seedCedarRidge(judgeUsers);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
