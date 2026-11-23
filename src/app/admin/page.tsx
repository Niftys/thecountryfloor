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
    heats.map((heat) => ({
      number: heat.number,
      divisionIds: [...new Set(heat.entries.map((entry) => entry.divisionName))],
      size: new Set(heat.entries.map((entry) => entry.bib)).size,
      styleAbbrev: heat.styleAbbrev,
    })),
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
      <Stack spacing={3}>
        <Alert severity="info">
          Use this page to turn competitions on/off, assign judges to a session, manage users, and
          import CDD structure. Judges and scrutineers open their own views from the buttons above.
        </Alert>

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
                <Typography>
                  {competition.dateLabel}
                  {competition.location ? ` · ${competition.location}` : ""} · {competition.status}
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
                <Box
                  sx={{
                    maxHeight: 88,
                    overflow: "auto",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                  }}
                >
                  {divisions.map((division) => (
                    <Chip
                      key={division.id}
                      size="small"
                      label={`${division.name} · ${division.scale} · Rule9 ${division.rule9Count}`}
                      color="primary"
                    />
                  ))}
                </Box>
              </Stack>
            ) : (
              <Typography>No competition loaded. Run the seed.</Typography>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <CompetitionOps />
          </CardContent>
        </Card>

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

        {session ? (
          <Card>
            <CardContent>
              <SessionJudgesEditor
                key={session.id}
                competitionId={competition!.id}
                sessionId={session.id}
                sessionName={session.name}
                allJudges={judgeUsers}
                assignedIds={session.judgeIds}
              />
            </CardContent>
          </Card>
        ) : null}

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
            entries: h.entries.map((e) => ({ bib: e.bib, divisionName: e.divisionName })),
          }))}
          sessionName={session?.name ?? null}
          heatNotes={heatNotes}
        />
      </Stack>
    </AppShell>
  );
}
