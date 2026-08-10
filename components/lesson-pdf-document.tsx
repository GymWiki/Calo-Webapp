import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatDate } from "@/lib/format";
import {
  L_QUESTIONS,
  LESSON_BLOCK_LABELS,
  LESSON_BLOCK_TYPES,
  type LessonWithDetails,
} from "@/types/lesson";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111111",
  },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#666666", marginBottom: 12 },
  headerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 4,
    marginBottom: 14,
  },
  headerCell: {
    width: "33.33%",
    padding: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#EEEEEE",
  },
  headerLabel: {
    fontSize: 7,
    color: "#777777",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  headerValue: { fontSize: 9 },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
    paddingBottom: 3,
  },
  box: {
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  boxLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  boxText: { fontSize: 9, lineHeight: 1.4 },
  grid2: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridCell: { width: "48%", marginBottom: 8 },
  listItem: { fontSize: 9, marginBottom: 2 },
});

function HeaderField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.headerCell}>
      <Text style={styles.headerLabel}>{label}</Text>
      <Text style={styles.headerValue}>{value || "-"}</Text>
    </View>
  );
}

function TextList({ items }: { items: string[] | null }) {
  if (!items || items.length === 0) {
    return <Text style={styles.listItem}>-</Text>;
  }

  return (
    <>
      {items.map((item, index) => (
        <Text key={index} style={styles.listItem}>
          • {item}
        </Text>
      ))}
    </>
  );
}

export function LessonPdfDocument({ lesson }: { lesson: LessonWithDetails }) {
  const authorName = lesson.author
    ? `${lesson.author.first_name} ${lesson.author.last_name}`.trim()
    : "-";
  const blocksByType = new Map(
    lesson.lesson_blocks.map((block) => [block.block_type, block.content]),
  );

  return (
    <Document title={`Lesvoorbereiding - ${lesson.title}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{lesson.title}</Text>
        <Text style={styles.subtitle}>Activiteitvoorbereiding</Text>

        <View style={styles.headerGrid} wrap={false}>
          <HeaderField label="Studentnaam" value={authorName} />
          <HeaderField label="Datum" value={formatDate(lesson.lesson_date) ?? "-"} />
          <HeaderField label="Groep/klas" value={lesson.group_name ?? "-"} />
          <HeaderField label="Leerlijn" value={lesson.learning_line ?? "-"} />
          <HeaderField label="Bewegingsprobleem" value={lesson.movement_problem ?? "-"} />
          <HeaderField label="Bewegingsthema" value={lesson.movement_theme ?? "-"} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organisatie</Text>
          <View style={styles.grid2}>
            <View style={[styles.gridCell, styles.box]} wrap={false}>
              <Text style={styles.boxLabel}>Basismateriaal</Text>
              <TextList items={lesson.base_materials} />
            </View>
            <View style={[styles.gridCell, styles.box]} wrap={false}>
              <Text style={styles.boxLabel}>Regelmateriaal</Text>
              <TextList items={lesson.rule_materials} />
            </View>
            <View style={[styles.gridCell, styles.box]} wrap={false}>
              <Text style={styles.boxLabel}>Aantal deelnemers</Text>
              <Text style={styles.boxText}>
                In het veld: {lesson.min_participants ?? "-"} · Op de bank:{" "}
                {lesson.participants_bench ?? "-"}
              </Text>
            </View>
            <View style={[styles.gridCell, styles.box]} wrap={false}>
              <Text style={styles.boxLabel}>Regels</Text>
              <TextList items={lesson.rules} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Didactische analyse (de 4 L&apos;en)</Text>
          <View style={[styles.box, { marginBottom: 8 }]} wrap={false}>
            <Text style={styles.boxLabel}>Doelen</Text>
            <Text style={styles.boxText}>{lesson.goals || "-"}</Text>
          </View>
          <View style={styles.grid2}>
            {L_QUESTIONS.map((question) => (
              <View key={question.title} style={[styles.gridCell, styles.box]} wrap={false}>
                <Text style={styles.boxLabel}>{question.title}</Text>
                <Text style={styles.boxText}>
                  Wat zie je? {lesson.lesson_didactics?.[question.seeKey] || "-"}
                </Text>
                <Text style={styles.boxText}>
                  Wat doe je? {lesson.lesson_didactics?.[question.doKey] || "-"}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kernblokken</Text>
          {LESSON_BLOCK_TYPES.map((type) => (
            <View key={type} style={styles.box} wrap={false}>
              <Text style={styles.boxLabel}>{LESSON_BLOCK_LABELS[type]}</Text>
              <Text style={styles.boxText}>{blocksByType.get(type) || "-"}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
