import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { DOELGROEP_LABELS, type Activity } from "@/types/activity";

// Zelfde blauw/groen/rood-indeling als de webpagina (Tab 3 "Leerhulp") —
// pastelversies van Tailwind's blue-50/green-50/red-50 zodat de PDF er
// consistent mee oogt.
const LEERHULP_PDF_COLORS = {
  loopt: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e3a8a" },
  lukt: { bg: "#f0fdf4", border: "#bbf7d0", text: "#14532d" },
  leeft: { bg: "#fef2f2", border: "#fecaca", text: "#7f1d1d" },
} as const;

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
  matrixHeader: { borderWidth: 1, borderRadius: 3, padding: 5, marginBottom: 5 },
  matrixHeaderText: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  matrixText: { fontSize: 8, lineHeight: 1.35, marginBottom: 2 },
  afbeelding: {
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

function NumberedList({ items }: { items: string[] | null }) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <>
      {items.map((item, index) => (
        <Text key={index} style={styles.listItem}>
          {index + 1}. {item}
        </Text>
      ))}
    </>
  );
}

function LeerhulpColumn({
  title,
  items,
  colors,
}: {
  title: string;
  items: string[] | null;
  colors: { bg: string; border: string; text: string };
}) {
  return (
    <View style={styles.matrixColumn} wrap={false}>
      <View
        style={[
          styles.matrixHeader,
          { backgroundColor: colors.bg, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.matrixHeaderText, { color: colors.text }]}>{title}</Text>
      </View>
      <View
        style={[
          styles.box,
          { backgroundColor: colors.bg, borderColor: colors.border },
        ]}
        wrap={false}
      >
        {items && items.length > 0 ? (
          items.map((item, index) => (
            <Text key={index} style={[styles.matrixText, { color: colors.text }]}>
              • {item}
            </Text>
          ))
        ) : (
          <Text style={[styles.matrixText, { color: colors.text }]}>-</Text>
        )}
      </View>
    </View>
  );
}

export function ActivityPdfDocument({ activity }: { activity: Activity }) {
  const doelgroepLabels = (activity.doelgroep ?? [])
    .map((waarde) => DOELGROEP_LABELS[waarde])
    .filter((label): label is string => Boolean(label))
    .join(", ");

  return (
    <Document title={`Activiteit - ${activity.titel}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{activity.titel}</Text>
        <Text style={styles.subtitle}>Activiteit</Text>

        <View style={styles.headerGrid} wrap={false}>
          <HeaderField label="Categorie" value={activity.categorie ?? "-"} />
          <HeaderField label="Leerlijn" value={activity.leerlijn ?? "-"} />
          <HeaderField label="Bewegingsthema" value={activity.beweegthema ?? "-"} />
          <HeaderField
            label="Niveau"
            value={activity.niveau !== null ? `Niveau ${activity.niveau}` : "-"}
          />
          <HeaderField label="Doelgroep" value={doelgroepLabels || "-"} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lesinhoud & Regels</Text>
          <View style={[styles.box, { marginBottom: 8 }]} wrap={false}>
            <Text style={styles.boxLabel}>Beginsituatie & Doelgroep</Text>
            <Text style={styles.boxText}>{activity.beginsituatie || "-"}</Text>
          </View>
          <View style={[styles.box, { marginBottom: 8 }]} wrap={false}>
            <Text style={styles.boxLabel}>Doelstelling</Text>
            <Text style={styles.boxText}>{activity.doel || "-"}</Text>
          </View>
          {activity.learning_outcomes && activity.learning_outcomes.length > 0 && (
            <View style={[styles.box, { marginBottom: 8 }]} wrap={false}>
              <Text style={styles.boxLabel}>Leeruitkomsten</Text>
              <NumberedList items={activity.learning_outcomes} />
            </View>
          )}
          <View style={[styles.box, { marginBottom: 8 }]} wrap={false}>
            <Text style={styles.boxLabel}>Beschrijving</Text>
            <Text style={styles.boxText}>{activity.beschrijving || "-"}</Text>
          </View>
          <View style={styles.box} wrap={false}>
            <Text style={styles.boxLabel}>Regels</Text>
            <TextList items={activity.regels} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Veld & Materiaal</Text>
          <View style={[styles.box, { marginBottom: 8 }]} wrap={false}>
            <Text style={styles.boxLabel}>Veldafmetingen & Opstelling</Text>
            <Text style={styles.boxText}>{activity.veld || "-"}</Text>
          </View>
          <View style={styles.box} wrap={false}>
            <Text style={styles.boxLabel}>Materiaallijst</Text>
            <TextList items={activity.materiaal} />
          </View>
          {activity.afbeelding && (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image is not an <img>; it has no alt prop
            <Image style={styles.afbeelding} src={activity.afbeelding} />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Leerhulp (de 3 L&apos;en)</Text>
          <View style={styles.matrixRow}>
            <LeerhulpColumn
              title="Loopt het?"
              items={activity.loopt}
              colors={LEERHULP_PDF_COLORS.loopt}
            />
            <LeerhulpColumn
              title="Lukt het?"
              items={activity.lukt}
              colors={LEERHULP_PDF_COLORS.lukt}
            />
            <LeerhulpColumn
              title="Leeft het?"
              items={activity.leeft}
              colors={LEERHULP_PDF_COLORS.leeft}
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}
