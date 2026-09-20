import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { computeStandings, resolveTeamRef } from "@/lib/utils/tournamentGenerator";
import type {
  TournamentSchedule,
  TournamentScores,
} from "@/types/tournament";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111111",
  },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#666666", marginBottom: 14 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
    paddingBottom: 3,
  },
  roundBlock: { marginBottom: 10 },
  roundHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  roundLabel: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  roundTime: { fontSize: 9, color: "#666666" },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 4,
    padding: 6,
    marginBottom: 4,
  },
  matchField: { width: 70, fontSize: 8, color: "#666666" },
  matchTeams: { flex: 1, fontSize: 9, textAlign: "center" },
  matchScore: { width: 60, fontSize: 9, fontWeight: 700, textAlign: "center" },
  restLine: { fontSize: 8, color: "#666666", marginBottom: 4 },
  table: {
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 4,
    marginTop: 6,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#F3F3F3",
    borderBottomWidth: 1,
    borderBottomColor: "#DDDDDD",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  cellTeam: { flex: 2, padding: 5, fontSize: 8 },
  cell: { flex: 1, padding: 5, fontSize: 8, textAlign: "center" },
  cellHeader: { fontFamily: "Helvetica-Bold" },
});

export function TournamentPdfDocument({
  schedule,
  scores,
  title,
}: {
  schedule: TournamentSchedule;
  scores: TournamentScores;
  title: string;
}) {
  const standings =
    schedule.format !== "knockout" ? computeStandings(schedule, scores) : null;

  return (
    <Document title={`Toernooischema - ${title}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {schedule.teams.length} teams · {schedule.fields.length} velden ·
          gegenereerd toernooischema
        </Text>

        <Text style={styles.sectionTitle}>Speelschema</Text>
        {schedule.slots.map((slot) => {
          const restingNames = slot.restingTeamIds
            .map((id) => schedule.teams.find((team) => team.id === id)?.name)
            .filter((name): name is string => Boolean(name));

          return (
            <View key={slot.round} style={styles.roundBlock} wrap={false}>
              <View style={styles.roundHeader}>
                <Text style={styles.roundLabel}>Ronde {slot.round}</Text>
                <Text style={styles.roundTime}>
                  {slot.startTime} - {slot.endTime}
                </Text>
              </View>
              {restingNames.length > 0 && (
                <Text style={styles.restLine}>Rust: {restingNames.join(", ")}</Text>
              )}
              {slot.matches.map((match) => {
                const home = resolveTeamRef(match.home, schedule, scores);
                const away = resolveTeamRef(match.away, schedule, scores);
                const fieldName =
                  schedule.fields.find((f) => f.index === match.fieldIndex)?.name ??
                  `Veld ${match.fieldIndex + 1}`;
                const score = scores[match.id];
                const scoreLabel = score
                  ? `${score.homeScore} - ${score.awayScore}`
                  : "- : -";

                return (
                  <View key={match.id} style={styles.matchRow}>
                    <Text style={styles.matchField}>{fieldName}</Text>
                    <Text style={styles.matchTeams}>
                      {home.name} vs {away.name}
                    </Text>
                    <Text style={styles.matchScore}>{scoreLabel}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}

        {standings && (
          <View wrap={false}>
            <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Stand</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.cellTeam, styles.cellHeader]}>Team</Text>
                <Text style={[styles.cell, styles.cellHeader]}>Sp</Text>
                <Text style={[styles.cell, styles.cellHeader]}>W</Text>
                <Text style={[styles.cell, styles.cellHeader]}>G</Text>
                <Text style={[styles.cell, styles.cellHeader]}>V</Text>
                <Text style={[styles.cell, styles.cellHeader]}>DS</Text>
                <Text style={[styles.cell, styles.cellHeader]}>Pt</Text>
              </View>
              {standings.map((standing) => (
                <View key={standing.teamId} style={styles.tableRow}>
                  <Text style={styles.cellTeam}>{standing.teamName}</Text>
                  <Text style={styles.cell}>{standing.played}</Text>
                  <Text style={styles.cell}>{standing.won}</Text>
                  <Text style={styles.cell}>{standing.drawn}</Text>
                  <Text style={styles.cell}>{standing.lost}</Text>
                  <Text style={styles.cell}>{standing.goalDifference}</Text>
                  <Text style={styles.cell}>{standing.points}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}
