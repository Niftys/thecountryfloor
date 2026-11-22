import { prisma } from "../db";
import { publishLive } from "../live";
import { parseCddPayload } from "./adapter";
import type { CddCompetitionPayload } from "./types";

function jsonBag(value: Record<string, unknown> | undefined) {
  return value ? JSON.stringify(value) : null;
}

/**
 * Import structure from CDD exchange JSON.
 * Never deletes or overwrites existing Score / HeatSubmission rows.
 */
export async function importCddCompetition(raw: unknown) {
  const parsed = parseCddPayload(raw);
  if (!parsed.ok) return parsed;

  const data: CddCompetitionPayload = parsed.data;
  const existing =
    (data.competition.cddId
      ? await prisma.competition.findFirst({ where: { cddId: data.competition.cddId } })
      : null) ??
    (await prisma.competition.findFirst({ where: { name: data.competition.name } }));

  const competition = existing
    ? await prisma.competition.update({
        where: { id: existing.id },
        data: {
          name: data.competition.name,
          dateLabel: data.competition.dateLabel ?? existing.dateLabel,
          location: data.competition.location ?? existing.location,
          status: data.competition.status ?? existing.status,
          active: data.competition.active ?? existing.active,
          cddId: data.competition.cddId ?? existing.cddId,
          cddData: jsonBag(data.competition.cddData) ?? existing.cddData,
        },
      })
    : await prisma.competition.create({
        data: {
          name: data.competition.name,
          dateLabel: data.competition.dateLabel ?? "",
          location: data.competition.location ?? "",
          status: data.competition.status ?? "Imported",
          active: data.competition.active ?? false,
          cddId: data.competition.cddId,
          cddData: jsonBag(data.competition.cddData),
        },
      });

  const divisionIds = new Map<string, string>();
  const danceIds = new Map<string, string>();
  const competitorIds = new Map<string, string>();

  for (const div of data.divisions) {
    let division = await prisma.division.findFirst({
      where: {
        competitionId: competition.id,
        OR: [
          ...(div.cddId ? [{ cddId: div.cddId }] : []),
          { name: div.name },
        ],
      },
    });
    if (division) {
      division = await prisma.division.update({
        where: { id: division.id },
        data: {
          name: div.name,
          scale: div.scale,
          rule9Count: div.rule9Count,
          cddId: div.cddId ?? division.cddId,
          cddData: jsonBag(div.cddData) ?? division.cddData,
        },
      });
    } else {
      division = await prisma.division.create({
        data: {
          competitionId: competition.id,
          name: div.name,
          scale: div.scale,
          rule9Count: div.rule9Count,
          cddId: div.cddId,
          cddData: jsonBag(div.cddData),
        },
      });
    }
    divisionIds.set(div.name, division.id);

    for (const dance of div.dances) {
      let row = await prisma.dance.findFirst({
        where: { divisionId: division.id, abbrev: dance.abbrev },
      });
      if (row) {
        row = await prisma.dance.update({
          where: { id: row.id },
          data: { name: dance.name, sortOrder: dance.sortOrder },
        });
      } else {
        row = await prisma.dance.create({
          data: {
            divisionId: division.id,
            name: dance.name,
            abbrev: dance.abbrev,
            sortOrder: dance.sortOrder,
          },
        });
      }
      danceIds.set(`${div.name}:${dance.abbrev}`, row.id);
    }

    for (const couple of div.competitors) {
      let row = await prisma.competitor.findFirst({
        where: {
          divisionId: division.id,
          OR: [
            ...(couple.cddId ? [{ cddId: couple.cddId }] : []),
            { bib: couple.bib },
          ],
        },
      });
      if (row) {
        row = await prisma.competitor.update({
          where: { id: row.id },
          data: {
            bib: couple.bib,
            name: couple.name,
            cddId: couple.cddId ?? row.cddId,
            cddData: jsonBag(couple.cddData) ?? row.cddData,
          },
        });
      } else {
        row = await prisma.competitor.create({
          data: {
            divisionId: division.id,
            bib: couple.bib,
            name: couple.name,
            cddId: couple.cddId,
            cddData: jsonBag(couple.cddData),
          },
        });
      }
      competitorIds.set(`${div.name}:${couple.bib}`, row.id);
    }
  }

  for (const sess of data.sessions) {
    let session = await prisma.session.findFirst({
      where: {
        competitionId: competition.id,
        OR: [...(sess.cddId ? [{ cddId: sess.cddId }] : []), { name: sess.name }],
      },
    });
    if (session) {
      session = await prisma.session.update({
        where: { id: session.id },
        data: {
          name: sess.name,
          sortOrder: sess.sortOrder,
          cddId: sess.cddId ?? session.cddId,
          cddData: jsonBag(sess.cddData) ?? session.cddData,
        },
      });
    } else {
      session = await prisma.session.create({
        data: {
          competitionId: competition.id,
          name: sess.name,
          sortOrder: sess.sortOrder,
          cddId: sess.cddId,
          cddData: jsonBag(sess.cddData),
        },
      });
    }

    await prisma.sessionJudge.deleteMany({ where: { sessionId: session.id } });
    let order = 0;
    for (const username of sess.judgeUsernames ?? []) {
      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) continue;
      await prisma.sessionJudge.create({
        data: { sessionId: session.id, userId: user.id, sortOrder: order++ },
      });
    }

    for (const heatPlan of sess.heats ?? []) {
      let heat = await prisma.heat.findFirst({
        where: {
          sessionId: session.id,
          OR: [
            ...(heatPlan.cddId ? [{ cddId: heatPlan.cddId }] : []),
            { number: heatPlan.number },
          ],
        },
      });
      if (heat) {
        heat = await prisma.heat.update({
          where: { id: heat.id },
          data: {
            number: heatPlan.number,
            cddId: heatPlan.cddId ?? heat.cddId,
            cddData: jsonBag(heatPlan.cddData) ?? heat.cddData,
          },
        });
      } else {
        heat = await prisma.heat.create({
          data: {
            sessionId: session.id,
            number: heatPlan.number,
            cddId: heatPlan.cddId,
            cddData: jsonBag(heatPlan.cddData),
          },
        });
      }

      const wanted = new Set<string>();
      for (const entry of heatPlan.entries ?? []) {
        const competitorId = competitorIds.get(`${entry.divisionName}:${entry.bib}`);
        const danceId = danceIds.get(`${entry.divisionName}:${heatPlan.styleAbbrev}`);
        if (!competitorId || !danceId) continue;
        wanted.add(`${competitorId}:${danceId}`);
        const existingEntry = await prisma.heatEntry.findFirst({
          where: { heatId: heat.id, competitorId, danceId },
        });
        if (!existingEntry) {
          await prisma.heatEntry.create({
            data: { heatId: heat.id, competitorId, danceId },
          });
        }
      }

      // Remove entries that vanished from CDD only if they have no scores
      const current = await prisma.heatEntry.findMany({
        where: { heatId: heat.id },
        include: { scores: true },
      });
      for (const entry of current) {
        const key = `${entry.competitorId}:${entry.danceId}`;
        if (wanted.has(key)) continue;
        if (entry.scores.length === 0) {
          await prisma.heatEntry.delete({ where: { id: entry.id } });
        }
      }
    }
  }

  publishLive({ type: "competition", competitionId: competition.id });
  return { ok: true as const, competitionId: competition.id };
}
