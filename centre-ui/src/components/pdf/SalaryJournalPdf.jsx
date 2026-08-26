import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { pdfStyles, colors, BRAND_NAME, formatMoney, PDF_FONT_FAMILY } from './pdfStyles'

const styles = StyleSheet.create({
  groupBlock: {
    marginBottom: 16,
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
    color: colors.muted,
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
  },
  summaryCol1: { width: '34%' },
  summaryCol2: { width: '22%', textAlign: 'right' },
  summaryCol3: { width: '18%', textAlign: 'right' },
  summaryCol4: { width: '26%', textAlign: 'right', fontFamily: PDF_FONT_FAMILY, fontWeight: 700 },
})

export default function SalaryJournalPdf({ teacher, monthLabel }) {
  const percentage = teacher.type === 'Pourcentage'
  const groupTotals = teacher.groups.map((group) => group.studentsCount * group.price)
  const totalSalary = percentage
    ? teacher.amount
    : teacher.groups.reduce((sum, group) => sum + group.studentsCount * group.price, 0)

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <View>
            <Text style={pdfStyles.brandName}>{BRAND_NAME}</Text>
            <Text style={pdfStyles.brandTagline}>Journal de salaire</Text>
          </View>
          <View style={pdfStyles.reference}>
            <Text style={pdfStyles.refCode}>{teacher.name}</Text>
            <Text style={pdfStyles.refDate}>{monthLabel} · {teacher.type}</Text>
          </View>
        </View>

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
          <Text>Aucun groupe assigné à ce professeur</Text>
        )}

        <View style={{ marginTop: 10 }}>
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
          <View style={pdfStyles.totalRow}>
            <Text style={pdfStyles.totalLabel}>Salaire total à verser</Text>
            <Text style={pdfStyles.totalValue}>{formatMoney(totalSalary)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
