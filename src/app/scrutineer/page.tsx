import Alert from "@mui/material/Alert";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { LiveSync } from "@/components/LiveSync";
import { ScopePicker } from "@/components/ScopePicker";
import { requireRole } from "@/lib/auth";
import {
  buildScrutineerView,
  listCompetitions,
  loadAuditsForDivision,
  loadCompetition,
  pickDivision,
  pickSession,
} from "@/lib/results";
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
    : await loadCompetition(
        requested?.active ? requested.id : activeCompetitions[0]?.id,
        { activeOnly: true },
      );

  const session = competition ? pickSession(competition, params.sessionId) : null;
  const division = competition ? pickDivision(competition, params.divisionId) : null;
  let view =
    competition && session && division
      ? buildScrutineerView(competition, { sessionId: session.id, divisionId: division.id })
      : null;
  if (view) {
    view = { ...view, audits: await loadAuditsForDivision(view.competitionId, view.divisionId) };
  }

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
      <LiveSync />
      {competition && activeCompetitions.length > 0 ? (
        <Suspense fallback={null}>
          <ScopePicker
            competitions={activeCompetitions.map((item) => ({
              id: item.id,
              label: item.name,
            }))}
            sessions={competition.sessions.map((item) => ({ id: item.id, label: item.name }))}
            divisions={competition.divisions.map((item) => ({
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
          {requested?.name ?? "This competition"} is inactive. Ask an admin to mark it active, or choose
          an active competition.
        </Alert>
      ) : activeCompetitions.length === 0 ? (
        <Alert severity="warning">No active competitions. An admin must mark a competition active.</Alert>
      ) : !view ? (
        <Alert severity="warning">No competition is loaded.</Alert>
      ) : (
        <ScrutineerBoard
          key={`${view.competitionId}-${view.sessionId}-${view.divisionId}`}
          initial={view}
        />
      )}
    </AppShell>
  );
}
