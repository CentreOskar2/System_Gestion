import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { colors, BRAND_NAME, LOGO_SRC, PDF_FONT_FAMILY } from './pdfStyles'

const ACADEMIC_YEAR = '2026 – 2027'
const sessions = Array.from({ length: 18 }, (_, index) => `S${index + 1}`)

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontSize: 8,
    fontFamily: PDF_FONT_FAMILY,
    color: colors.text,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottom: `1px solid ${colors.border}`,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 34,
    height: 34,
    marginRight: 8,
    borderRadius: 6,
  },
  brandName: {
    fontSize: 11,
    fontFamily: PDF_FONT_FAMILY,
    fontWeight: 700,
  },
  brandTagline: {
    marginTop: 2,
    fontSize: 8,
    color: colors.muted,
  },
  titleBlock: {
    alignItems: 'flex-end',
  },
  titleMain: {
    fontSize: 11,
    fontFamily: PDF_FONT_FAMILY,
    fontWeight: 700,
  },
  titleSub: {
    marginTop: 2,
    fontSize: 8,
    color: colors.muted,
  },
  details: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  detailItem: {
    marginRight: 24,
  },
  detailLabel: {
    fontSize: 7,
    color: colors.muted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 9.5,
    fontFamily: PDF_FONT_FAMILY,
    fontWeight: 700,
  },
  table: {
    borderTop: `1px solid ${colors.border}`,
    borderLeft: `1px solid ${colors.border}`,
  },
  row: {
    flexDirection: 'row',
  },
  headCell: {
    fontFamily: PDF_FONT_FAMILY,
    fontWeight: 700,
    fontSize: 7,
    color: colors.muted,
    backgroundColor: '#f4f7fb',
  },
  cell: {
    borderRight: `1px solid ${colors.border}`,
    borderBottom: `1px solid ${colors.border}`,
    paddingVertical: 4,
    paddingHorizontal: 3,
  },
  colIndex: { width: 18, textAlign: 'center' },
  colStudent: { width: 110 },
  colReg: { width: 55 },
  colNote: { width: 26, textAlign: 'center' },
  colSession: { width: 29, textAlign: 'center' },
  empty: {
    padding: 20,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 9,
  },
  help: {
    marginTop: 10,
    fontSize: 8,
    color: colors.muted,
  },
  signatures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
  },
  signatureBox: {
    width: '40%',
    paddingTop: 8,
    borderTop: `1px solid ${colors.border}`,
    fontSize: 8,
    color: colors.muted,
  },
})

export default function AbsenceSheetPdf({ meta, students }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image src={LOGO_SRC} style={styles.logo} />
            <View>
              <Text style={styles.brandName}>{BRAND_NAME}</Text>
              <Text style={styles.brandTagline}>Fiche de présence</Text>
            </View>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.titleMain}>Fiche d'absence</Text>
            <Text style={styles.titleSub}>Année scolaire {ACADEMIC_YEAR}</Text>
          </View>
        </View>

        <View style={styles.details}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>PROFESSEUR</Text>
            <Text style={styles.detailValue}>{meta.teacher || '—'}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>MATIÈRE</Text>
            <Text style={styles.detailValue}>{meta.subject || '—'}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>NIVEAU</Text>
            <Text style={styles.detailValue}>{meta.level || '—'}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>GROUPE</Text>
            <Text style={styles.detailValue}>{meta.group || '—'}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.row} fixed>
            <Text style={[styles.cell, styles.headCell, styles.colIndex]}>#</Text>
            <Text style={[styles.cell, styles.headCell, styles.colStudent]}>Élève</Text>
            <Text style={[styles.cell, styles.headCell, styles.colReg]}>Matricule</Text>
            <Text style={[styles.cell, styles.headCell, styles.colNote]}>Note°1</Text>
            <Text style={[styles.cell, styles.headCell, styles.colNote]}>Note°2</Text>
            {sessions.map((session) => (
              <Text style={[styles.cell, styles.headCell, styles.colSession]} key={session}>{session}</Text>
            ))}
          </View>
          {students.length === 0 ? (
            <Text style={styles.empty}>Aucun élève inscrit dans ce groupe.</Text>
          ) : (
            students.map((student, index) => (
              <View style={styles.row} key={student.id} wrap={false}>
                <Text style={[styles.cell, styles.colIndex]}>{index + 1}</Text>
                <Text style={[styles.cell, styles.colStudent]}>{student.name}</Text>
                <Text style={[styles.cell, styles.colReg]}>{student.registration_number || ''}</Text>
                <Text style={[styles.cell, styles.colNote]} />
                <Text style={[styles.cell, styles.colNote]} />
                {sessions.map((session) => (
                  <Text style={[styles.cell, styles.colSession]} key={session} />
                ))}
              </View>
            ))
          )}
        </View>

        <Text style={styles.help}>Cocher P pour présent, A pour absent, R pour retard.</Text>

        <View style={styles.signatures}>
          <Text style={styles.signatureBox}>Signature du professeur</Text>
          <Text style={styles.signatureBox}>Signature de l'administration</Text>
        </View>
      </Page>
    </Document>
  )
}
