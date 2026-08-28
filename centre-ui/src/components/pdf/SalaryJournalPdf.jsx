import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { pdfStyles, colors, formatMoney, PDF_FONT_FAMILY } from './pdfStyles'
import { PdfBrandHeader, PdfSignatures } from './PdfBrandHeader'
import { initials } from '../Students/utils/studentHelpers'

const styles = StyleSheet.create({
  teacherCard: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 20, padding: 14,
    border: `1px solid ${colors.border}`, borderRadius: 8, backgroundColor: '#f8faff',
  },
  teacherAvatar: {
    width: 42, height: 42, borderRadius: 21, marginRight: 12, backgroundColor: colors.avatarBg,
    alignItems: 'center', justifyContent: 'center',
  },
  teacherAvatarText: { color: colors.primary, fontSize: 12, fontFamily: PDF_FONT_FAMILY, fontWeight: 700 },
  teacherInfo: { flexGrow: 1 },
  teacherName: { fontSize: 13, fontFamily: PDF_FONT_FAMILY, fontWeight: 700 },
  teacherMeta: { marginTop: 3, fontSize: 9, color: colors.muted },
  teacherType: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 10, backgroundColor: '#e7edff', color: colors.primary, fontSize: 8, fontFamily: PDF_FONT_FAMILY, fontWeight: 700 },
  groupBlock: {
    marginBottom: 16,
    padding: 12,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
  },
  groupHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  groupName: {
    fontSize: 10,
    fontFamily: PDF_FONT_FAMILY,
    fontWeight: 700,
  },
  groupRate: {
    fontSize: 9,
    color: '#6d4300',
    backgroundColor: '#fff0d8',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 8,
  },
  groupMeta: {
    fontSize: 8.5,
    color: colors.muted,
    marginBottom: 6,
  },
  studentCol: { width: '70%' },
  priceCol: { width: '30%', textAlign: 'right' },
  groupTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  groupTotalLabel: {
    fontSize: 9,
    fontFamily: PDF_FONT_FAMILY,
    fontWeight: 700,
  },
  groupTotalValue: {
    fontSize: 9,
    fontFamily: PDF_FONT_FAMILY,
    fontWeight: 700,
    color: colors.primary,
  },
  summaryCard: { marginTop: 10, padding: 14, borderRadius: 8, backgroundColor: '#f1f5ff', border: '1px solid #bfd0ff' },
  totalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid #bfd0ff' },
  totalLabel: { fontSize: 10, fontFamily: PDF_FONT_FAMILY, fontWeight: 700 },
  totalValue: { fontSize: 16, fontFamily: PDF_FONT_FAMILY, fontWeight: 700, color: colors.primary },
  note: { marginTop: 14, padding: 10, borderRadius: 6, backgroundColor: '#effcf1', color: colors.successText, fontSize: 8.5 },
  summaryCol1: { width: '34%' },
  summaryCol2: { width: '22%', textAlign: 'right' },
  summaryCol3: { width: '18%', textAlign: 'right' },
  summaryCol4: { width: '26%', textAlign: 'right', fontFamily: PDF_FONT_FAMILY, fontWeight: 700 },
})

export default function SalaryJournalPdf({ teacher, monthLabel }) {
  const percentage = teacher.type === 'Pourcentage'
  const groupTotals = teacher.groups.map((group) => group.studentsCount * group.price)
  const totalSalary = teacher.amount

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <PdfBrandHeader tagline="Journal de salaire professeur" label="Professeur" code={teacher.name} date={monthLabel} />

        <View style={styles.teacherCard}>
          <View style={styles.teacherAvatar}><Text style={styles.teacherAvatarText}>{initials(teacher.name)}</Text></View>
          <View style={styles.teacherInfo}>
            <Text style={styles.teacherName}>{teacher.name}</Text>
            <Text style={styles.teacherMeta}>{teacher.groups.length} groupe{teacher.groups.length > 1 ? 's' : ''} attribué{teacher.groups.length > 1 ? 's' : ''}</Text>
          </View>
          <Text style={styles.teacherType}>{teacher.type}</Text>
        </View>

        <Text style={pdfStyles.sectionTitle}>Détail des groupes et élèves</Text>

        {teacher.groups.length > 0 ? (
          teacher.groups.map((group, index) => (
            <View key={group.id} style={styles.groupBlock} wrap={false}>
              <View style={styles.groupHeadRow}>
                <Text style={styles.groupName}>{group.name}</Text>
                {percentage && group.rate > 0 && <Text style={styles.groupRate}>Taux : {group.rate}%</Text>}
              </View>
              <Text style={styles.groupMeta}>
                {group.subject} · {group.level} · {group.branch} · {group.studentsCount} élèves
              </Text>
              <View style={pdfStyles.tableHeadRow}>
                <Text style={styles.studentCol}>Élève</Text>
                <Text style={styles.priceCol}>Prix matière</Text>
              </View>
              {(group.students.length > 0
                ? group.students
                : Array.from({ length: group.studentsCount }, (_, i) => `Élève ${i + 1}`)
              ).map((student, i) => (
                <View style={pdfStyles.tableRow} key={`${student}-${i}`}>
                  <Text style={styles.studentCol}>{student}</Text>
                  <Text style={styles.priceCol}>{formatMoney(group.price)}</Text>
                </View>
              ))}
              <View style={styles.groupTotalRow}>
                <Text style={styles.groupTotalLabel}>Total du groupe</Text>
                <Text style={styles.groupTotalValue}>{formatMoney(groupTotals[index])}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.groupMeta}>Aucun groupe assigné à ce professeur pour cette période.</Text>
        )}

        <View style={styles.summaryCard} wrap={false}>
          <Text style={pdfStyles.sectionTitle}>Récapitulatif</Text>
          <View style={pdfStyles.tableHeadRow}>
            <Text style={styles.summaryCol1}>Groupe</Text>
            <Text style={styles.summaryCol2}>Total groupe</Text>
            <Text style={styles.summaryCol3}>Taux</Text>
            <Text style={styles.summaryCol4}>Montant dû</Text>
          </View>
          {teacher.groups.map((group, index) => (
            <View style={pdfStyles.tableRow} key={group.id}>
              <Text style={styles.summaryCol1}>{group.name}</Text>
              <Text style={styles.summaryCol2}>{formatMoney(groupTotals[index])}</Text>
              <Text style={styles.summaryCol3}>{percentage ? `${group.rate}%` : 'Fixe'}</Text>
              <Text style={styles.summaryCol4}>
                {percentage
                  ? formatMoney(Math.round((groupTotals[index] * group.rate) / 100))
                  : formatMoney(groupTotals[index])}
              </Text>
            </View>
          ))}
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Salaire total à verser</Text>
            <Text style={styles.totalValue}>{formatMoney(totalSalary)}</Text>
          </View>
        </View>
        <View style={styles.note}><Text>Document récapitulatif généré par Centre Oskar pour la période de {monthLabel}.</Text></View>
        <PdfSignatures left="Signature du professeur" right="Signature de l'administration" />
      </Page>
    </Document>
  )
}
