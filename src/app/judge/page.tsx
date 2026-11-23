import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
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

  const pickerCompetitionId = competition?.id ?? activeCompetitions[0]?.id;
  const scopeSlot =
    activeCompetitions.length > 0 && pickerCompetitionId ? (
      <Suspense fallback={null}>
        <ScopePicker
          competitions={activeCompetitions.map((item) => ({
            id: item.id,
            label: item.name,
          }))}
          sessions={sessions.map((item) => ({ id: item.id, label: item.name }))}
          competitionId={pickerCompetitionId}
          sessionId={session?.id}
        />
      </Suspense>
    ) : null;

  const blockedMessage = inactiveRequested
    ? `${requested?.name ?? "This competition"} is inactive. Ask an admin to mark it active, or choose an active competition.`
    : activeCompetitions.length === 0
      ? "No active competitions. An admin must mark a competition active."
      : !competition || !session
        ? "No competition is loaded. Run the Firestore seed."
        : !assigned || !scoringJudgeId || !board
          ? session
            ? `You are not assigned to ${session.name}. Choose a different competition or session above.`
            : "You are not assigned to this session. Choose a different competition or session above."
          : null;

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
      {board && competition && session && scoringJudgeId ? (
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
      ) : (
        <Stack spacing={2}>
          {scopeSlot}
          {blockedMessage ? <Alert severity="warning">{blockedMessage}</Alert> : null}
        </Stack>
      )}
    </AppShell>
  );
}
