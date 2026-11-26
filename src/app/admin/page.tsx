import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { ScopePicker } from "@/components/ScopePicker";
import { requireRole } from "@/lib/auth";
import { heatingWarnings } from "@/lib/dances";
import {
  listCompetitions,
  listDivisions,
  listHeats,
  listSessions,
} from "@/lib/store/competitions";
import { listUsers } from "@/lib/store/users";
import { AdminBrowsePanels } from "./AdminBrowsePanels";
import { AdminConsole } from "./AdminConsole";
import { CompetitionActiveToggle } from "./CompetitionActiveToggle";
import { CompetitionOps } from "./CompetitionOps";
import { SessionJudgesEditor } from "./SessionJudgesEditor";
import { UserManager } from "./UserManager";

type Props = { searchParams: Promise<{ competitionId?: string; sessionId?: string }> };

export default async function AdminPage({ searchParams }: Props) {
  const user = await requireRole(["ADMIN"]);
  const params = await searchParams;

  const competitions = await listCompetitions();
  const competition =
    competitions.find((item) => item.id === params.competitionId) ?? competitions[0] ?? null;
  const sessions = competition ? await listSessions(competition.id) : [];
  const session =
    sessions.find((item) => item.id === params.sessionId) ?? sessions[0] ?? null;
  const divisions = competition ? await listDivisions(competition.id) : [];
  const heats = competition && session ? await listHeats(competition.id, session.id) : [];
  const heatNotes = heatingWarnings(
    heats.map((heat) => {
      const divisionSizes: Record<string, number> = {};
      for (const entry of heat.entries) {
        divisionSizes[entry.divisionName] = (divisionSizes[entry.divisionName] ?? 0) + 1;
      }
      return {
        number: heat.number,
        divisionIds: Object.keys(divisionSizes),
        size: new Set(heat.entries.map((entry) => entry.bib)).size,
        styleAbbrev: heat.styleAbbrev,
        divisionSizes,
      };
    }),
  );
  const users = await listUsers();
  const judgeUsers = users
    .filter((row) => row.role === "JUDGE")
    .map((row) => ({ id: row.id, label: `${row.displayName} (${row.username})` }));

  return (
    <AppShell
      title="Admin"
      role={user.role}
      displayName={user.displayName}
      links={[
        {
          href: competition
            ? `/judge?competitionId=${competition.id}${session ? `&sessionId=${session.id}` : ""}`
            : "/judge",
          label: "Judge view",
        },
        {
          href: competition
            ? `/scrutineer?competitionId=${competition.id}${session ? `&sessionId=${session.id}` : ""}`
            : "/scrutineer",
          label: "Scrutineer view",
        },
      ]}
    >
      <AdminConsole
        competition={
          <Stack spacing={3}>
            {competition ? (
              <Suspense fallback={null}>
                <ScopePicker
                  competitions={competitions.map((item) => ({
                    id: item.id,
                    label: `${item.name} · ${item.active ? "Active" : "Inactive"}`,
                  }))}
                  sessions={sessions.map((item) => ({ id: item.id, label: item.name }))}
                  competitionId={competition.id}
                  sessionId={session?.id}
                />
              </Suspense>
            ) : null}
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom>
                  Competition
                </Typography>
                {competition ? (
                  <Stack spacing={2}>
                    <Typography variant="h6">{competition.name}</Typography>
                    <Typography color="text.secondary">
                      {[competition.dateLabel, competition.location].filter(Boolean).join(" · ")}
                    </Typography>
                    <CompetitionActiveToggle
                      key={competition.id}
                      competitionId={competition.id}
                      active={competition.active}
                    />
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
                      <Chip label={`${sessions.length} sessions`} />
                      <Chip label={`${heats.length} heats in selected session`} />
                      <Chip label={`${divisions.length} divisions`} />
                    </Stack>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {divisions.map((division) => (
                        <Chip
                          key={division.id}
                          size="small"
                          label={`${division.name} · ${division.scale}`}
                          color="primary"
                        />
                      ))}
                    </Box>
                  </Stack>
                ) : (
                  <Typography>
                    No competition yet. Import a CDD file from the Data tab.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Stack>
        }
        people={
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Users
              </Typography>
              <UserManager
                currentUserId={user.id}
                users={users.map((row) => ({
                  id: row.id,
                  username: row.username,
                  displayName: row.displayName,
                  role: row.role,
                }))}
              />
            </CardContent>
          </Card>
        }
        panel={
          session && competition ? (
            <Card>
              <CardContent>
                <SessionJudgesEditor
                  key={session.id}
                  competitionId={competition.id}
                  sessionId={session.id}
                  sessionName={session.name}
                  allJudges={judgeUsers}
                  assignedIds={session.judgeIds}
                />
              </CardContent>
            </Card>
          ) : (
            <Alert severity="info">Choose a competition and session on the Competition tab.</Alert>
          )
        }
        schedule={
          <AdminBrowsePanels
            divisions={divisions.map((d) => ({
              id: d.id,
              name: d.name,
              competitors: d.competitors,
            }))}
            heats={heats.map((h) => ({
              id: h.id,
              number: h.number,
              styleName: h.styleName,
              styleAbbrev: h.styleAbbrev,
              entries: h.entries.map((e) => ({
                bib: e.bib,
                name: e.name,
                divisionName: e.divisionName,
              })),
            }))}
            sessionName={session?.name ?? null}
            heatNotes={heatNotes}
          />
        }
        data={
          <Card>
            <CardContent>
              <CompetitionOps />
            </CardContent>
          </Card>
        }
      />
    </AppShell>
  );
}
