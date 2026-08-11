import type {
  Match,
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

function buildRoundRobinSlots(
  settings: TournamentSettings,
  teams: { id: string; name: string }[],
  fields: { index: number; name: string }[],
): ScheduleSlot[] {
  const teamIds = teams.map((t) => t.id);
  const singleRounds = circleMethodRounds(teamIds);
  const logicalRounds =
    settings.format === "dubbele_competitie"
      ? [...singleRounds, ...singleRounds.map((r) => r.map(([a, b]) => [b, a] as [string, string]))]
      : singleRounds;

  const slots: ScheduleSlot[] = [];
  const startMinutes = parseTimeToMinutes(settings.startTime);
  const slotLength = settings.matchDurationMinutes + settings.breakDurationMinutes;
  let matchCounter = 0;
  let slotIndex = 0;

  for (const logicalRound of logicalRounds) {
    const chunks = chunk(logicalRound, fields.length);
    for (const group of chunks) {
      const matches: Match[] = group.map((pair, i) => ({
        id: `m${matchCounter++}`,
        round: slotIndex + 1,
        fieldIndex: fields[i].index,
        home: { type: "team", teamId: pair[0] } satisfies TeamRef,
        away: { type: "team", teamId: pair[1] } satisfies TeamRef,
      }));

      const playingIds = new Set(group.flat());
      const restingTeamIds = teamIds.filter((id) => !playingIds.has(id));
      const start = startMinutes + slotIndex * slotLength;

      const slot: ScheduleSlot = {
        round: slotIndex + 1,
        startTime: formatMinutesToTime(start),
        endTime: formatMinutesToTime(start + settings.matchDurationMinutes),
        matches,
        restingTeamIds,
        refereeAssignments: {},
      };
      assignReferees(slot, restingTeamIds, settings.autoAssignReferees);

      slots.push(slot);
      slotIndex++;
    }
  }

  return slots;
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
