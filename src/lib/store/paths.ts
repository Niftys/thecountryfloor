export function competitionRef(competitionId: string) {
  return `competitions/${competitionId}`;
}

export function divisionPath(competitionId: string, divisionId: string) {
  return `${competitionRef(competitionId)}/divisions/${divisionId}`;
}

export function sessionPath(competitionId: string, sessionId: string) {
  return `${competitionRef(competitionId)}/sessions/${sessionId}`;
}

export function heatPath(competitionId: string, sessionId: string, heatId: string) {
  return `${sessionPath(competitionId, sessionId)}/heats/${heatId}`;
}

export function judgeSheetPath(
  competitionId: string,
  sessionId: string,
  heatId: string,
  judgeId: string,
) {
  return `${heatPath(competitionId, sessionId, heatId)}/judgeSheets/${judgeId}`;
}

export function sessionLivePath(competitionId: string, sessionId: string) {
  return `${sessionPath(competitionId, sessionId)}/meta/live`;
}

export function divisionResultsPath(competitionId: string, divisionId: string) {
  return `${divisionPath(competitionId, divisionId)}/meta/results`;
}

export function auditsCollection(competitionId: string, divisionId: string) {
  return `${divisionPath(competitionId, divisionId)}/audits`;
}

export function scoreKey(heatId: string, entryId: string, judgeId: string) {
  return `${heatId}__${entryId}__${judgeId}`;
}

export function parseScoreKey(key: string) {
  const [heatId, entryId, judgeId] = key.split("__");
  if (!heatId || !entryId || !judgeId) return null;
  return { heatId, entryId, judgeId };
}
