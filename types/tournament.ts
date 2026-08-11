export type TournamentFormat = "poule" | "dubbele_competitie" | "knockout";

export const TOURNAMENT_FORMAT_LABELS: Record<TournamentFormat, string> = {
  poule: "Halve competitie / Poulefase",
  dubbele_competitie: "Iedereen tegen iedereen (heen en terug)",
  knockout: "Knock-out",
};

export const TOURNAMENT_FORMAT_DESCRIPTIONS: Record<TournamentFormat, string> = {
  poule: "Elk team speelt één keer tegen elk ander team.",
  dubbele_competitie: "Elk team speelt twee keer tegen elk ander team.",
  knockout: "Verliezer ligt eruit — winnaars gaan door naar de volgende ronde.",
};

export type TournamentSettings = {
  teamCount: number;
  teamNames: string[];
  fieldCount: number;
  fieldNames: string[];
  format: TournamentFormat;
  matchDurationMinutes: number;
  breakDurationMinutes: number;
  startTime: string;
  autoAssignReferees: boolean;
};

export const DEFAULT_TOURNAMENT_SETTINGS: TournamentSettings = {
  teamCount: 6,
  teamNames: [],
  fieldCount: 2,
  fieldNames: [],
  format: "poule",
  matchDurationMinutes: 8,
  breakDurationMinutes: 2,
  startTime: "10:00",
  autoAssignReferees: false,
};

export type TeamRef =
  | { type: "team"; teamId: string }
  | { type: "winnerOf"; matchId: string }
  | { type: "bye" };

export type Match = {
  id: string;
  round: number;
  fieldIndex: number;
  home: TeamRef;
  away: TeamRef;
};

export type ScheduleSlot = {
  round: number;
  startTime: string;
  endTime: string;
  matches: Match[];
  restingTeamIds: string[];
  refereeAssignments: Record<string, string>;
};

export type TournamentSchedule = {
  format: TournamentFormat;
  slots: ScheduleSlot[];
  teams: { id: string; name: string }[];
  fields: { index: number; name: string }[];
};

export type MatchScore = {
  homeScore: number;
  awayScore: number;
};

export type TournamentScores = Record<string, MatchScore>;

export type MatchStatus = "upcoming" | "live" | "done";

export type TeamStanding = {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scored: number;
  conceded: number;
  goalDifference: number;
  points: number;
};
