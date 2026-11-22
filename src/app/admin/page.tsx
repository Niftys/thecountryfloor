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
import { LiveSync } from "@/components/LiveSync";
import { ScopePicker } from "@/components/ScopePicker";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CompetitionActiveToggle } from "./CompetitionActiveToggle";
import { CompetitionOps } from "./CompetitionOps";
import { SessionJudgesEditor } from "./SessionJudgesEditor";
import { UserManager } from "./UserManager";

type Props = { searchParams: Promise<{ competitionId?: string; sessionId?: string }> };

export default async function AdminPage({ searchParams }: Props) {
  const user = await requireRole(["ADMIN"]);
  const params = await searchParams;

  const competitions = await prisma.competition.findMany({
    orderBy: { name: "asc" },
    include: {
      divisions: {
        include: {
          competitors: { orderBy: { bib: "asc" } },
          dances: { orderBy: { sortOrder: "asc" } },
        },
      },
      sessions: {
        orderBy: { sortOrder: "asc" },
        include: {
          judges: { include: { user: true }, orderBy: { sortOrder: "asc" } },
          heats: {
            orderBy: { number: "asc" },
            include: {
              entries: {
                include: {
                  competitor: { include: { division: true } },
                  dance: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const competition =
    competitions.find((item) => item.id === params.competitionId) ?? competitions[0] ?? null;
  const session =
    competition?.sessions.find((item) => item.id === params.sessionId) ??
    competition?.sessions[0] ??
    null;
  const users = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { displayName: "asc" }] });
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
      <LiveSync />
      <Stack spacing={3}>
        <Alert severity="info">
          LoneStar + Prairie are active; Cedar Ridge starts inactive. CDD structure import uses{" "}
          <code>countryfloor.cdd.v1</code> and never overwrites confirmed scores.
        </Alert>

        {competition ? (
          <Suspense fallback={null}>
            <ScopePicker
              competitions={competitions.map((item) => ({
                id: item.id,
                label: `${item.name} · ${item.active ? "Active" : "Inactive"}`,
              }))}
              sessions={competition.sessions.map((item) => ({ id: item.id, label: item.name }))}
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
                <Typography variant="body2" color="text.secondary">
                  Only active competitions appear for judges and scrutineers.
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {competition.divisions.map((division) => (
                    <Chip
                      key={division.id}
                      label={`${division.name} · ${division.scale} · Rule9 ${division.rule9Count}`}
                      color="primary"
                    />
                  ))}
                  <Chip label={`${competition.sessions.length} sessions`} />
                  <Chip label={`${session?.heats.length ?? 0} heats in selected session`} />
                </Stack>
              </Stack>
            ) : (
              <Typography>No competition loaded. Run the seed.</Typography>
            )}
          </CardContent>
        </Card>

        {competition ? (
          <Card>
            <CardContent>
              <CompetitionOps />
            </CardContent>
          </Card>
        ) : null}

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
                sessionId={session.id}
                sessionName={session.name}
                allJudges={judgeUsers}
                assignedIds={session.judges.map((judge) => judge.userId)}
              />
            </CardContent>
          </Card>
        ) : null}

        {competition?.divisions.map((division) => (
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
            <Typography gutterBottom>
              Judges: {session?.judges.map((judge) => judge.user.displayName).join(", ") || "—"}
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
                {session?.heats.map((heat) => {
                  const style = heat.entries[0]?.dance.name ?? "—";
                  const divisions = [
                    ...new Set(heat.entries.map((entry) => entry.competitor.division.name)),
                  ].join(" + ");
                  const couples = [
                    ...new Set(heat.entries.map((entry) => String(entry.competitor.bib))),
                  ].join(", ");
                  return (
                    <TableRow key={heat.id}>
                      <TableCell>{heat.number}</TableCell>
                      <TableCell>{style}</TableCell>
                      <TableCell>{divisions || "—"}</TableCell>
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
