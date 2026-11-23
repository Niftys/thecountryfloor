import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { ScopePicker } from "@/components/ScopePicker";
import { requireRole } from "@/lib/auth";
import { loadScrutineerView } from "@/lib/results";
import { listCompetitions, listDivisions, listSessions } from "@/lib/store/competitions";
import { ScrutineerBoard } from "./ScrutineerBoard";

type Props = {
  searchParams: Promise<{ competitionId?: string; sessionId?: string; divisionId?: string }>;
};

export default async function ScrutineerPage({ searchParams }: Props) {
  const user = await requireRole(["SCRUTINEER", "ADMIN"]);
  const params = await searchParams;
  const allCompetitions = await listCompetitions();
  const activeCompetitions = allCompetitions.filter((item) => item.active);
  const requested = params.competitionId
    ? allCompetitions.find((item) => item.id === params.competitionId) ?? null
    : null;
  const inactiveRequested = Boolean(requested && !requested.active);

  const competition = inactiveRequested
    ? null
    : requested?.active
      ? requested
      : activeCompetitions[0] ?? null;

  const sessions = competition ? await listSessions(competition.id) : [];
  const divisions = competition ? await listDivisions(competition.id) : [];
  const session = sessions.find((item) => item.id === params.sessionId) ?? sessions[0] ?? null;
  const division =
    divisions.find((item) => item.id === params.divisionId) ?? divisions[0] ?? null;

  const view =
    competition && session && division
      ? await loadScrutineerView({
          competitionId: competition.id,
          sessionId: session.id,
          divisionId: division.id,
        })
      : null;

  return (
    <AppShell
      title="Scrutineer"
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
                  ? `/judge?competitionId=${competition.id}${session ? `&sessionId=${session.id}` : ""}`
                  : "/judge",
                label: "Judge",
              },
            ]
          : []
      }
    >
      <Stack spacing={2.5}>
        {competition && activeCompetitions.length > 0 ? (
          <Suspense fallback={null}>
            <ScopePicker
              competitions={activeCompetitions.map((item) => ({
                id: item.id,
                label: item.name,
              }))}
              sessions={sessions.map((item) => ({ id: item.id, label: item.name }))}
              divisions={divisions.map((item) => ({
                id: item.id,
                label: `${item.name} (${item.scale})`,
              }))}
              competitionId={competition.id}
              sessionId={session?.id}
              divisionId={division?.id}
            />
          </Suspense>
        ) : null}

        {inactiveRequested ? (
          <Alert severity="warning">
            {requested?.name ?? "This competition"} is inactive. Ask an admin to mark it active, or
            choose an active competition.
          </Alert>
        ) : activeCompetitions.length === 0 ? (
          <Alert severity="warning">
            No active competitions. An admin must mark a competition active.
          </Alert>
        ) : !view ? (
          <Alert severity="warning">No competition is loaded. Run the Firestore seed.</Alert>
        ) : (
          <ScrutineerBoard
            key={`${view.competitionId}-${view.sessionId}-${view.divisionId}`}
            initial={view}
          />
        )}
      </Stack>
    </AppShell>
  );
}
