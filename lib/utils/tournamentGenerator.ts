import type {
  Match,
  MatchStatus,
  ScheduleSlot,
  TeamRef,
  TeamStanding,
  TournamentSchedule,
  TournamentScores,
  TournamentSettings,
} from "@/types/tournament";

function parseTimeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatMinutesToTime(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Circle method (Berger tables): fixes the first team and rotates the rest,
 * producing n-1 rounds (n even) where every team plays exactly once per
 * round. An odd team count is padded with a "BYE" slot so one real team
 * rests each round instead of being scheduled twice.
 */
function circleMethodRounds(teamIds: string[]): [string, string][][] {
  const arr = [...teamIds];
  if (arr.length % 2 !== 0) arr.push("BYE");
  const n = arr.length;
  const rounds: [string, string][][] = [];

  for (let round = 0; round < n - 1; round++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== "BYE" && b !== "BYE") pairs.push([a, b]);
    }
    rounds.push(pairs);

    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop() as string);
    arr.splice(0, arr.length, fixed, ...rest);
  }

  return rounds;
}

function assignReferees(
  slot: ScheduleSlot,
  restingTeamIds: string[],
  enabled: boolean,
) {
  if (!enabled) return;
  const pool = [...restingTeamIds];
  for (const match of slot.matches) {
    if (pool.length === 0) break;
    slot.refereeAssignments[match.id] = pool.shift() as string;
  }
}

type GreedyRound = { matches: [string, string][]; resting: string[] };

/**
 * Greedy field-maximizing scheduler: each round takes up to
 * `maxMatchesPerRound` (= min(fields, floor(teams/2))) matches from the
 * remaining pool, always preferring matches involving the team(s) that have
 * been resting longest so nobody sits out two rounds in a row unless the
 * remaining fixtures leave no alternative. Field occupancy only drops below
 * the maximum once too few non-conflicting matches remain — i.e. in the
 * closing rounds of the tournament.
 */
function buildGreedyRounds(
  teamIds: string[],
  matchPairs: [string, string][],
  maxMatchesPerRound: number,
): GreedyRound[] {
  const remaining = [...matchPairs];
  const consecutiveRest = new Map(teamIds.map((id) => [id, 0]));
  const rounds: GreedyRound[] = [];

  while (remaining.length > 0) {
    const usedThisRound = new Set<string>();
    const roundMatches: [string, string][] = [];

    const byRestPriority = [...remaining].sort((a, b) => {
      const restA = Math.max(
        consecutiveRest.get(a[0]) ?? 0,
        consecutiveRest.get(a[1]) ?? 0,
      );
      const restB = Math.max(
        consecutiveRest.get(b[0]) ?? 0,
        consecutiveRest.get(b[1]) ?? 0,
      );
      return restB - restA;
    });

    for (const pair of byRestPriority) {
      if (roundMatches.length >= maxMatchesPerRound) break;
      const [a, b] = pair;
      if (usedThisRound.has(a) || usedThisRound.has(b)) continue;
      roundMatches.push(pair);
      usedThisRound.add(a);
      usedThisRound.add(b);
    }

    for (const match of roundMatches) {
      const index = remaining.indexOf(match);
      if (index !== -1) remaining.splice(index, 1);
    }

    for (const id of teamIds) {
      if (usedThisRound.has(id)) {
        consecutiveRest.set(id, 0);
      } else {
        consecutiveRest.set(id, (consecutiveRest.get(id) ?? 0) + 1);
      }
    }

    rounds.push({
      matches: roundMatches,
      resting: teamIds.filter((id) => !usedThisRound.has(id)),
    });
  }

  return rounds;
}

function buildRoundRobinSlots(
  settings: TournamentSettings,
  teams: { id: string; name: string }[],
  fields: { index: number; name: string }[],
): ScheduleSlot[] {
  const teamIds = teams.map((t) => t.id);
  const basePairs = circleMethodRounds(teamIds).flat();
  const matchPairs =
    settings.format === "dubbele_competitie"
      ? [...basePairs, ...basePairs.map(([a, b]) => [b, a] as [string, string])]
      : basePairs;

  const maxMatchesPerRound = Math.min(
    fields.length,
    Math.floor(teamIds.length / 2),
  );
  const greedyRounds = buildGreedyRounds(teamIds, matchPairs, maxMatchesPerRound);

  const startMinutes = parseTimeToMinutes(settings.startTime);
  const slotLength = settings.matchDurationMinutes + settings.breakDurationMinutes;

  return greedyRounds.map((round, roundIndex) => {
    const matches: Match[] = round.matches.map((pair, i) => ({
      id: `m${roundIndex}_${i}`,
      round: roundIndex + 1,
      fieldIndex: fields[i].index,
      home: { type: "team", teamId: pair[0] } satisfies TeamRef,
      away: { type: "team", teamId: pair[1] } satisfies TeamRef,
    }));

    const start = startMinutes + roundIndex * slotLength;
    const slot: ScheduleSlot = {
      round: roundIndex + 1,
      startTime: formatMinutesToTime(start),
      endTime: formatMinutesToTime(start + settings.matchDurationMinutes),
      matches,
      restingTeamIds: round.resting,
      refereeAssignments: {},
    };
    assignReferees(slot, round.resting, settings.autoAssignReferees);

    return slot;
  });
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function buildKnockoutSlots(
  settings: TournamentSettings,
  teams: { id: string; name: string }[],
  fields: { index: number; name: string }[],
): ScheduleSlot[] {
  const bracketSize = nextPowerOfTwo(Math.max(teams.length, 2));
  const byeCount = bracketSize - teams.length;

  let currentEntrants: TeamRef[] = teams.map(
    (t) => ({ type: "team", teamId: t.id }) satisfies TeamRef,
  );
  // Spread byes across the end of the seed list so they don't all collide
  // with each other in round 1.
  for (let i = 0; i < byeCount; i++) {
    currentEntrants.push({ type: "bye" });
  }

  const slots: ScheduleSlot[] = [];
  const startMinutes = parseTimeToMinutes(settings.startTime);
  const slotLength = settings.matchDurationMinutes + settings.breakDurationMinutes;
  let matchCounter = 0;
  let slotIndex = 0;

  while (currentEntrants.length > 1) {
    const roundMatches: Match[] = [];
    const nextEntrants: TeamRef[] = [];

    for (let i = 0; i < currentEntrants.length; i += 2) {
      const a = currentEntrants[i];
      const b = currentEntrants[i + 1];

      if (a.type === "bye" && b.type === "bye") {
        nextEntrants.push({ type: "bye" });
        continue;
      }
      if (a.type === "bye") {
        nextEntrants.push(b);
        continue;
      }
      if (b.type === "bye") {
        nextEntrants.push(a);
        continue;
      }

      const match: Match = {
        id: `m${matchCounter++}`,
        round: 0,
        fieldIndex: 0,
        home: a,
        away: b,
      };
      roundMatches.push(match);
      nextEntrants.push({ type: "winnerOf", matchId: match.id });
    }

    const chunks = chunk(roundMatches, fields.length);
    for (const group of chunks) {
      const start = startMinutes + slotIndex * slotLength;
      group.forEach((m, i) => {
        m.fieldIndex = fields[i].index;
        m.round = slotIndex + 1;
      });

      slots.push({
        round: slotIndex + 1,
        startTime: formatMinutesToTime(start),
        endTime: formatMinutesToTime(start + settings.matchDurationMinutes),
        matches: group,
        restingTeamIds: [],
        refereeAssignments: {},
      });
      slotIndex++;
    }

    currentEntrants = nextEntrants;
  }

  return slots;
}

export function validateTournamentSettings(
  settings: TournamentSettings,
): string | null {
  if (settings.teamCount < 3) {
    return "Er zijn minimaal 3 teams nodig voor een toernooi.";
  }
  if (settings.fieldCount < 1) {
    return "Er is minimaal 1 veld nodig.";
  }
  if (settings.matchDurationMinutes < 1) {
    return "De wedstrijdduur moet minimaal 1 minuut zijn.";
  }
  return null;
}

export function generateSchedule(
  settings: TournamentSettings,
): TournamentSchedule {
  const teams = Array.from({ length: settings.teamCount }, (_, i) => ({
    id: `team-${i + 1}`,
    name: settings.teamNames[i]?.trim() || `Team ${i + 1}`,
  }));
  const fields = Array.from({ length: settings.fieldCount }, (_, i) => ({
    index: i,
    name: settings.fieldNames[i]?.trim() || `Veld ${i + 1}`,
  }));

  const slots =
    settings.format === "knockout"
      ? buildKnockoutSlots(settings, teams, fields)
      : buildRoundRobinSlots(settings, teams, fields);

  return { format: settings.format, slots, teams, fields };
}

export function getAllMatches(schedule: TournamentSchedule): Match[] {
  return schedule.slots.flatMap((slot) => slot.matches);
}

/** Resolves a (possibly not-yet-decided) team reference to a display name. */
export function resolveTeamRef(
  ref: TeamRef,
  schedule: TournamentSchedule,
  scores: TournamentScores,
): { id: string | null; name: string; decided: boolean } {
  if (ref.type === "bye") {
    return { id: null, name: "Bye", decided: true };
  }
  if (ref.type === "team") {
    const team = schedule.teams.find((t) => t.id === ref.teamId);
    return { id: ref.teamId, name: team?.name ?? "Onbekend team", decided: true };
  }

  const match = getAllMatches(schedule).find((m) => m.id === ref.matchId);
  if (!match) {
    return { id: null, name: "Onbekend", decided: false };
  }

  const score = scores[match.id];
  if (!score || score.homeScore === score.awayScore) {
    return {
      id: null,
      name: `Winnaar ronde ${match.round}`,
      decided: false,
    };
  }

  const winnerRef = score.homeScore > score.awayScore ? match.home : match.away;
  return resolveTeamRef(winnerRef, schedule, scores);
}

export function computeStandings(
  schedule: TournamentSchedule,
  scores: TournamentScores,
): TeamStanding[] {
  const standingsMap = new Map<string, TeamStanding>();
  for (const team of schedule.teams) {
    standingsMap.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      scored: 0,
      conceded: 0,
      goalDifference: 0,
      points: 0,
    });
  }

  for (const match of getAllMatches(schedule)) {
    if (match.home.type !== "team" || match.away.type !== "team") continue;
    const score = scores[match.id];
    if (!score) continue;

    const home = standingsMap.get(match.home.teamId);
    const away = standingsMap.get(match.away.teamId);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.scored += score.homeScore;
    home.conceded += score.awayScore;
    away.scored += score.awayScore;
    away.conceded += score.homeScore;

    if (score.homeScore > score.awayScore) {
      home.won++;
      away.lost++;
      home.points += 3;
    } else if (score.homeScore < score.awayScore) {
      away.won++;
      home.lost++;
      away.points += 3;
    } else {
      home.drawn++;
      away.drawn++;
      home.points += 1;
      away.points += 1;
    }
  }

  return Array.from(standingsMap.values())
    .map((s) => ({ ...s, goalDifference: s.scored - s.conceded }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.scored - a.scored ||
        a.teamName.localeCompare(b.teamName),
    );
}

export function getMatchStatus(
  slot: ScheduleSlot,
  match: Match,
  scores: TournamentScores,
): MatchStatus {
  if (scores[match.id]) return "done";

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseTimeToMinutes(slot.startTime);

  return nowMinutes < startMinutes ? "upcoming" : "live";
}

/** Plain-text schedule for the whiteboard "kopieer als tekst" export. */
export function buildWhiteboardText(
  schedule: TournamentSchedule,
  scores: TournamentScores,
  title: string,
): string {
  const lines: string[] = [`Toernooischema — ${title}`, ""];

  for (const slot of schedule.slots) {
    lines.push(`Ronde ${slot.round} (${slot.startTime} - ${slot.endTime})`);

    for (const match of slot.matches) {
      const home = resolveTeamRef(match.home, schedule, scores);
      const away = resolveTeamRef(match.away, schedule, scores);
      const fieldName =
        schedule.fields.find((f) => f.index === match.fieldIndex)?.name ??
        `Veld ${match.fieldIndex + 1}`;
      lines.push(`  ${fieldName}: ${home.name} vs ${away.name}`);
    }

    const restingNames = slot.restingTeamIds
      .map((id) => schedule.teams.find((t) => t.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    if (restingNames.length > 0) {
      lines.push(`  Rust/Scheidsrechter: ${restingNames.join(", ")}`);
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
