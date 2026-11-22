import Alert from "@mui/material/Alert";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { LiveSync } from "@/components/LiveSync";
import { ScopePicker } from "@/components/ScopePicker";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { JudgeBoard } from "./JudgeBoard";

type Props = {
  searchParams: Promise<{ competitionId?: string; sessionId?: string; asJudgeId?: string }>;
};

export default async function JudgePage({ searchParams }: Props) {
  const user = await requireRole(["JUDGE", "ADMIN"]);
  const params = await searchParams;

  const competitions = await prisma.competition.findMany({
    orderBy: { name: "asc" },
    include: {
      sessions: {
        orderBy: { sortOrder: "asc" },
        include: {
          judges: { include: { user: true }, orderBy: { sortOrder: "asc" } },
          heats: {
            orderBy: { number: "asc" },
            include: {
              submissions: true,
              entries: {
                include: {
                  competitor: { include: { division: true } },
                  dance: true,
                  scores: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const activeCompetitions = competitions.filter((item) => item.active);
  const requested = params.competitionId
    ? competitions.find((item) => item.id === params.competitionId) ?? null
    : null;
  const inactiveRequested = Boolean(requested && !requested.active);
  const competition = inactiveRequested
    ? null
    : requested && requested.active
      ? requested
      : activeCompetitions[0] ?? null;

  const session =
    competition?.sessions.find((item) => item.id === params.sessionId) ??
    competition?.sessions[0] ??
    null;

  const panel =
    session?.judges.map((judge) => ({
      id: judge.userId,
      label: judge.user.displayName,
    })) ?? [];

  const scoringJudgeId =
    user.role === "ADMIN"
      ? panel.find((judge) => judge.id === params.asJudgeId)?.id ?? panel[0]?.id ?? null
      : user.id;

  const assigned =
    user.role === "ADMIN"
      ? Boolean(scoringJudgeId)
      : Boolean(session?.judges.some((judge) => judge.userId === user.id));

  const heats =
    session?.heats.map((heat) => {
      const groups = new Map<
        string,
        {
          divisionId: string;
          divisionName: string;
          scale: string;
          danceName: string;
          entries: {
            heatEntryId: string;
            bib: number;
            name: string;
            medal: string | null;
            placement: number | null;
            notes: string;
            scratched: boolean;
          }[];
        }
      >();

      for (const entry of heat.entries) {
        const key = `${entry.competitor.divisionId}:${entry.danceId}`;
        const existing = groups.get(key) ?? {
          divisionId: entry.competitor.divisionId,
          divisionName: entry.competitor.division.name,
          scale: entry.competitor.division.scale,
          danceName: entry.dance.name,
          entries: [],
        };
        const mine = entry.scores.find((score) => score.judgeId === scoringJudgeId);
        existing.entries.push({
          heatEntryId: entry.id,
          bib: entry.competitor.bib,
          name: entry.competitor.name,
          medal: mine?.medal ?? null,
          placement: mine?.placement ?? null,
          notes: mine?.notes ?? "",
          scratched: mine?.scratched ?? false,
        });
        groups.set(key, existing);
      }

      return {
        id: heat.id,
        number: heat.number,
        submitted: heat.submissions.some((item) => item.judgeId === scoringJudgeId),
        groups: [...groups.values()].map((group) => ({
          ...group,
          entries: group.entries.sort((a, b) => a.bib - b.bib),
        })),
      };
    }) ?? [];

  return (
    <AppShell
      title="Judge"
      role={user.role}
      displayName={user.displayName}
      links={
        user.role === "ADMIN"
          ? [
              {
                href: requested
                  ? `/admin?competitionId=${requested.id}`
                  : competition
                    ? `/admin?competitionId=${competition.id}`
                    : "/admin",
                label: "Admin",
              },
              {
                href: competition
                  ? `/scrutineer?competitionId=${competition.id}${session ? `&sessionId=${session.id}` : ""}`
                  : "/scrutineer",
                label: "Scrutineer",
              },
            ]
          : []
      }
    >
      <LiveSync />
      {activeCompetitions.length > 0 && competition ? (
        <Suspense fallback={null}>
          <ScopePicker
            competitions={activeCompetitions.map((item) => ({
              id: item.id,
              label: item.name,
            }))}
            sessions={competition.sessions.map((item) => ({ id: item.id, label: item.name }))}
            competitionId={competition.id}
            sessionId={session?.id}
          />
        </Suspense>
      ) : null}

      {inactiveRequested ? (
        <Alert severity="warning">
          {requested?.name ?? "This competition"} is inactive. Ask an admin to mark it active, or choose
          an active competition.
        </Alert>
      ) : activeCompetitions.length === 0 ? (
        <Alert severity="warning">No active competitions. An admin must mark a competition active.</Alert>
      ) : !competition || !session ? (
        <Alert severity="warning">No competition is loaded.</Alert>
      ) : !assigned || !scoringJudgeId ? (
        <Alert severity="warning">You are not assigned to this session.</Alert>
      ) : (
        <JudgeBoard
          key={`${competition.id}-${session.id}-${scoringJudgeId}`}
          competitionName={competition.name}
          sessionName={session.name}
          heats={heats}
          asJudgeId={user.role === "ADMIN" ? scoringJudgeId : undefined}
          panelJudges={user.role === "ADMIN" ? panel : []}
        />
      )}
    </AppShell>
  );
}
