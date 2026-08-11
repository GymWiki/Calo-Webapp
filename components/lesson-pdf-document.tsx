import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatDate } from "@/lib/format";
import {
  DIDACTIC_CATEGORIES,
  DIDACTIC_CATEGORY_LABELS,
  LESSON_BLOCK_LABELS,
  LESSON_BLOCK_TYPES,
  groupDidacticItemsByCategory,
  type DidacticCategory,
  type LessonWithDetails,
} from "@/types/lesson";

const DIDACTIC_COLORS: Record<DidacticCategory, string> = {
  loopt_het: "#e6f4ea",
  lukt_het: "#fff6d9",
  leeft_het: "#e6f0fb",
};

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
  matrixRow: { flexDirection: "row", justifyContent: "space-between" },
  matrixColumn: { width: "32%" },
  matrixHeader: { borderRadius: 3, padding: 5, marginBottom: 5 },
  matrixHeaderText: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  matrixItem: {
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 3,
    padding: 5,
    marginBottom: 5,
  },
  matrixSubtheme: { fontSize: 7, color: "#666666", marginBottom: 2 },
  matrixText: { fontSize: 8, lineHeight: 1.35, marginBottom: 1 },
  diagramImage: {
    width: "100%",
    maxWidth: 380,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 4,
  },
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

const GAME_DIMENSION_LABELS: [key: "space" | "equipment" | "people" | "rules", label: string][] = [
  ["space", "Ruimte (Space)"],
  ["equipment", "Materiaal (Equipment)"],
  ["people", "Aantallen (People)"],
  ["rules", "Regels (Rules)"],
];

export function LessonPdfDocument({ lesson }: { lesson: LessonWithDetails }) {
  const authorName = lesson.author
    ? `${lesson.author.first_name} ${lesson.author.last_name}`.trim()
    : "-";
  const blocksByType = new Map(
    lesson.lesson_blocks.map((block) => [block.block_type, block.content]),
  );
  const groupedDidactics = groupDidacticItemsByCategory(
    lesson.lesson_didactics?.items ?? [],
  );
  const hasGamePedagogy =
    lesson.game_category ||
    (lesson.game_dimensions &&
      Object.values(lesson.game_dimensions).some((value) => value?.trim())) ||
    (lesson.tactical_questions && lesson.tactical_questions.length > 0);

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
          <Text style={styles.sectionTitle}>Didactische analyse (de 3 L&apos;en)</Text>
          <View style={[styles.box, { marginBottom: 8 }]} wrap={false}>
            <Text style={styles.boxLabel}>Doelen</Text>
            <Text style={styles.boxText}>{lesson.goals || "-"}</Text>
          </View>
          <View style={styles.matrixRow}>
            {DIDACTIC_CATEGORIES.map((category) => {
              const items = groupedDidactics[category];
              return (
                <View key={category} style={styles.matrixColumn} wrap={false}>
                  <View
                    style={[styles.matrixHeader, { backgroundColor: DIDACTIC_COLORS[category] }]}
                  >
                    <Text style={styles.matrixHeaderText}>
                      {DIDACTIC_CATEGORY_LABELS[category]}
                    </Text>
                  </View>
                  {items.length === 0 ? (
                    <Text style={styles.boxText}>-</Text>
                  ) : (
                    items.map((item) => (
                      <View key={item.id} style={styles.matrixItem}>
                        {item.subTheme && (
                          <Text style={styles.matrixSubtheme}>#{item.subTheme}</Text>
                        )}
                        <Text style={styles.matrixText}>Zie: {item.observation}</Text>
                        <Text style={styles.matrixText}>Doe: {item.action}</Text>
                      </View>
                    ))
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {hasGamePedagogy && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Game-Based Pedagogy</Text>
            {lesson.game_category && (
              <View style={[styles.box, { marginBottom: 8 }]} wrap={false}>
                <Text style={styles.boxLabel}>Spelcategorie</Text>
                <Text style={styles.boxText}>{lesson.game_category}</Text>
              </View>
            )}
            <View style={styles.grid2}>
              {GAME_DIMENSION_LABELS.map(([key, label]) => (
                <View key={key} style={[styles.gridCell, styles.box]} wrap={false}>
                  <Text style={styles.boxLabel}>{label}</Text>
                  <Text style={styles.boxText}>
                    {lesson.game_dimensions?.[key] || "-"}
                  </Text>
                </View>
              ))}
            </View>
            {lesson.tactical_questions && lesson.tactical_questions.length > 0 && (
              <View style={styles.box} wrap={false}>
                <Text style={styles.boxLabel}>Tactische reflectievragen</Text>
                <TextList items={lesson.tactical_questions} />
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kernblokken</Text>
          {LESSON_BLOCK_TYPES.map((type) => (
            <View key={type} style={styles.box} wrap={false}>
              <Text style={styles.boxLabel}>{LESSON_BLOCK_LABELS[type]}</Text>
              <Text style={styles.boxText}>{blocksByType.get(type) || "-"}</Text>
            </View>
          ))}
        </View>

        {lesson.diagram_image_url && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Tekening van het arrangement</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is not an <img>; it has no alt prop */}
            <Image style={styles.diagramImage} src={lesson.diagram_image_url} />
          </View>
        )}
      </Page>
    </Document>
  );
}
