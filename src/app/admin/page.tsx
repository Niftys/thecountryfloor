import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { ScopePicker } from "@/components/ScopePicker";
import { requireRole } from "@/lib/auth";
import {
  listCompetitions,
  listDivisions,
  listHeats,
  listSessions,
} from "@/lib/store/competitions";
import { listUsers } from "@/lib/store/users";
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
          Data is in Cloud Firestore. New competitions come from CDD import. Seed with{" "}
          <code>npm run seed</code> against emulators or your Firebase project.
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
                <CompetitionActiveToggle competitionId={competition.id} active={competition.active} />
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {divisions.map((division) => (
                    <Chip
                      key={division.id}
                      label={`${division.name} · ${division.scale} · Rule9 ${division.rule9Count}`}
                      color="primary"
                    />
                  ))}
                  <Chip label={`${sessions.length} sessions`} />
                  <Chip label={`${heats.length} heats in selected session`} />
                </Stack>
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
                competitionId={competition!.id}
                sessionId={session.id}
                sessionName={session.name}
                allJudges={judgeUsers}
                assignedIds={session.judgeIds}
              />
            </CardContent>
          </Card>
        ) : null}

        {divisions.map((division) => (
          <Card key={division.id}>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Competitors · {division.name}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Bib</TableCell>
                    <TableCell>Couple</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {division.competitors.map((couple) => (
                    <TableRow key={couple.id}>
                      <TableCell>{couple.bib}</TableCell>
                      <TableCell>{couple.name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Session · {session?.name ?? "—"}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Heat</TableCell>
                  <TableCell>Style</TableCell>
                  <TableCell>Divisions</TableCell>
                  <TableCell>Couples</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {heats.map((heat) => {
                  const divisionsLabel = [
                    ...new Set(heat.entries.map((entry) => entry.divisionName)),
                  ].join(" + ");
                  const couples = [...new Set(heat.entries.map((entry) => String(entry.bib)))].join(
                    ", ",
                  );
                  return (
                    <TableRow key={heat.id}>
                      <TableCell>{heat.number}</TableCell>
                      <TableCell>{heat.styleName}</TableCell>
                      <TableCell>{divisionsLabel || "—"}</TableCell>
                      <TableCell>{couples}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Stack>
    </AppShell>
  );
}
