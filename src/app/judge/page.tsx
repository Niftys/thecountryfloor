import Alert from "@mui/material/Alert";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { ScopePicker } from "@/components/ScopePicker";
import { requireRole } from "@/lib/auth";
import { listCompetitions, listSessions, loadJudgeBoard } from "@/lib/store/competitions";
import { JudgeBoard } from "./JudgeBoard";

type Props = {
  searchParams: Promise<{ competitionId?: string; sessionId?: string; asJudgeId?: string }>;
};

export default async function JudgePage({ searchParams }: Props) {
  const user = await requireRole(["JUDGE", "ADMIN"]);
  const params = await searchParams;

  const competitions = await listCompetitions();
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

  const sessions = competition ? await listSessions(competition.id) : [];
  const session =
    sessions.find((item) => item.id === params.sessionId) ?? sessions[0] ?? null;

  const scoringJudgeId =
    user.role === "ADMIN"
      ? params.asJudgeId && session?.judgeIds.includes(params.asJudgeId)
        ? params.asJudgeId
        : session?.judgeIds[0] ?? null
      : user.id;

  const assigned =
    user.role === "ADMIN"
      ? Boolean(scoringJudgeId)
      : Boolean(session?.judgeIds.includes(user.id));

  const board =
    competition && session && scoringJudgeId && assigned
      ? await loadJudgeBoard(competition.id, session.id, scoringJudgeId)
      : null;

  const scopeSlot =
    activeCompetitions.length > 0 && competition ? (
      <Suspense fallback={null}>
        <ScopePicker
          competitions={activeCompetitions.map((item) => ({
            id: item.id,
            label: item.name,
          }))}
          sessions={sessions.map((item) => ({ id: item.id, label: item.name }))}
          competitionId={competition.id}
          sessionId={session?.id}
        />
      </Suspense>
    ) : null;

  return (
    <AppShell
      title="Judge"
      role={user.role}
      displayName={user.displayName}
      scoringFocus
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
      {inactiveRequested ? (
        <Alert severity="warning">
          {requested?.name ?? "This competition"} is inactive. Ask an admin to mark it active, or choose
          an active competition.
        </Alert>
      ) : activeCompetitions.length === 0 ? (
        <Alert severity="warning">No active competitions. An admin must mark a competition active.</Alert>
      ) : !competition || !session ? (
        <Alert severity="warning">No competition is loaded. Import a CDD file from Admin → Data.</Alert>
      ) : !assigned || !scoringJudgeId || !board ? (
        <Alert severity="warning">You are not assigned to this session.</Alert>
      ) : (
        <JudgeBoard
          key={`${competition.id}-${session.id}-${scoringJudgeId}`}
          competitionId={competition.id}
          sessionId={session.id}
          competitionName={board.competition.name}
          sessionName={board.session.name}
          heats={board.heats}
          asJudgeId={user.role === "ADMIN" ? scoringJudgeId : undefined}
          panelJudges={user.role === "ADMIN" ? board.panel : []}
          scopeSlot={scopeSlot}
        />
      )}
    </AppShell>
  );
}
