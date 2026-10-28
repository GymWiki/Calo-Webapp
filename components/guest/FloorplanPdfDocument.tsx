/* eslint-disable jsx-a11y/alt-text -- <Image> is hier de react-pdf-component, geen <img> */
import { Document, Image, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { GYMWIKI_LOGO_DATA_URL } from "@/components/pdf/gymwiki-logo-data-url";
import type { FloorplanSummary } from "@/components/canvas-3d/floorplan-summary";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: "Helvetica", color: "#111111" },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  brandLogo: { width: 18, height: 18, marginRight: 6 },
  brandText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#002f4f" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#666666", marginBottom: 10 },
  images: { flexDirection: "row", gap: 10, marginBottom: 12 },
  imageBox: { flex: 1, borderWidth: 1, borderColor: "#dddddd", borderRadius: 4, padding: 4 },
  image: { width: "100%", height: 220, objectFit: "contain" },
  caption: { fontSize: 8, color: "#666666", marginTop: 3 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 4, marginTop: 4 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e5e5", paddingVertical: 2.5 },
  count: { width: 34, fontFamily: "Helvetica-Bold" },
  groupTitle: { fontSize: 9, color: "#666666", marginTop: 6, marginBottom: 1, textTransform: "uppercase" },
  footer: { position: "absolute", bottom: 16, left: 28, right: 28, fontSize: 8, color: "#888888", flexDirection: "row", justifyContent: "space-between" },
  link: { color: "#c2410c", textDecoration: "none" },
});

/** Materiaallijst + afbeeldingen van een plattegrond uit de gratis tool; het label "Gemaakt met GymWiki" staat onderaan. */
export function FloorplanPdfDocument({
  title,
  summary,
  image3d,
  imageTop,
}: {
  title: string;
  summary: FloorplanSummary;
  image3d: string;
  imageTop: string;
}) {
  return (
    <Document title={`${title} — GymWiki`} author="GymWiki" creator="GymWiki">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.brandRow}>
          <Image src={GYMWIKI_LOGO_DATA_URL} style={styles.brandLogo} />
          <Text style={styles.brandText}>GymWiki</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Gymzaal-plattegrond met materiaallijst</Text>
        <View style={styles.images}>
          <View style={styles.imageBox}>
            <Image src={image3d} style={styles.image} />
            <Text style={styles.caption}>3D-weergave</Text>
          </View>
          <View style={styles.imageBox}>
            <Image src={imageTop} style={styles.image} />
            <Text style={styles.caption}>Bovenaanzicht</Text>
          </View>
        </View>
        <View wrap={false}>
          <Text style={styles.h2}>Materiaal</Text>
          {summary.coneTotal > 0 && (
            <View style={styles.row}>
              <Text style={styles.count}>{summary.coneTotal}×</Text>
              <Text>Pionnen en dopjes ({summary.fields.length} {summary.fields.length === 1 ? "afgezet veld" : "afgezette velden"})</Text>
            </View>
          )}
          {summary.groups.map((group) => (
            <View key={group.categorie}>
              <Text style={styles.groupTitle}>{group.label}</Text>
              {group.items.map((item) => (
                <View key={item.slug} style={styles.row}>
                  <Text style={styles.count}>{item.count}×</Text>
                  <Text>{item.naam}</Text>
                </View>
              ))}
            </View>
          ))}
          {summary.personTotal > 0 && (
            <View style={styles.row}>
              <Text style={styles.count}>{summary.personTotal}×</Text>
              <Text>Leerlingen</Text>
            </View>
          )}
        </View>
        <View style={styles.footer} fixed>
          <Text>Gemaakt met GymWiki — gratis gymzaal-plattegronden in 3D</Text>
          <Link src="https://www.gymwiki.nl/gratis-gymzaal-plattegrond-maken" style={styles.link}>
            www.gymwiki.nl/gratis-gymzaal-plattegrond-maken
          </Link>
        </View>
      </Page>
    </Document>
  );
}
