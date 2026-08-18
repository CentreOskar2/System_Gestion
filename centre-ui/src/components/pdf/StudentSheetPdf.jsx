import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { pdfStyles, colors, BRAND_NAME, LOGO_SRC, formatMoney } from './pdfStyles'

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 16,
    marginBottom: 20,
    borderBottom: `1px solid ${colors.border}`,
  },
  title: {
    alignItems: 'flex-end',
  },
  titleMain: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
  },
  titleSub: {
    marginTop: 4,
    fontSize: 9,
    color: colors.muted,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '50%',
    marginBottom: 10,
    paddingRight: 10,
  },
  gridLabel: {
    fontSize: 8,
    color: colors.muted,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gridValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  empty: {
    fontSize: 9,
    color: colors.muted,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  statBox: {
    width: '20%',
    paddingRight: 8,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  statLabel: {
    fontSize: 7.5,
    color: colors.muted,
    marginTop: 2,
  },
  colSubject: { width: '34%' },
  colGroup: { width: '33%' },
  colFee: { width: '33%', textAlign: 'right' },
  colGradeSubject: { width: '28%' },
  colGradeValue: { width: '18%' },
  colGradeExam: { width: '18%' },
  colGradeSession: { width: '18%' },
  colGradeDate: { width: '18%', textAlign: 'right' },
  colLogDate: { width: '18%' },
  colLogEvent: { width: '32%' },
  colLogDetail: { width: '50%' },
  footer: {
    marginTop: 16,
    paddingTop: 10,
    borderTop: `1px solid ${colors.border}`,
    fontSize: 8,
    color: colors.muted,
    textAlign: 'center',
  },
})

function GridItem({ label, value }) {
  return (
    <View style={styles.gridItem}>
      <Text style={styles.gridLabel}>{label}</Text>
      <Text style={styles.gridValue}>{value || '—'}</Text>
    </View>
  )
}

export default function StudentSheetPdf({ data }) {
  const {
    student,
    subscriptions,
    grades,
    logEvents,
    eventStats,
    periodLabel,
    totalMonths,
    paidMonths,
    totalPaid,
    formatDate,
    generatedDate,
  } = data

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={styles.header}>
          <View style={pdfStyles.brandRow}>
            <Image src={LOGO_SRC} style={pdfStyles.logo} />
            <View>
              <Text style={pdfStyles.brandName}>{BRAND_NAME}</Text>
              <Text style={pdfStyles.brandTagline}>Gestion pédagogique & scolarité</Text>
            </View>
          </View>
          <View style={styles.title}>
            <Text style={styles.titleMain}>Fiche Élève</Text>
            <Text style={styles.titleSub}>Année scolaire 2026 – 2027</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profil de l'élève</Text>
          <View style={styles.grid}>
            <GridItem label="Nom complet" value={student.name} />
            <GridItem label="Code d'inscription" value={student.code} />
            <GridItem label="Cycle" value={student.cycle} />
            <GridItem label="Niveau" value={student.level} />
            <GridItem label="Succursale" value={student.branch} />
            <GridItem label="Date d'inscription" value={formatDate(student.registrationDate)} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact parent / tuteur</Text>
          <View style={styles.grid}>
            <GridItem label="Téléphone 1" value={student.phone} />
            <GridItem label="Téléphone 2" value={student.phone2} />
            <GridItem label="Adresse" value={student.address} />
            <GridItem label="École d'origine" value={[student.school, student.schoolClass].filter(Boolean).join(' · ')} />
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Matières inscrites & frais de scolarité</Text>
          {subscriptions.length === 0 ? (
            <Text style={styles.empty}>Aucune matière inscrite.</Text>
          ) : (
            <>
              <View style={pdfStyles.tableHeadRow}>
                <Text style={styles.colSubject}>Matière</Text>
                <Text style={styles.colGroup}>Groupe</Text>
                <Text style={styles.colFee}>Frais mensuels</Text>
              </View>
              {subscriptions.map((sub, index) => (
                <View style={pdfStyles.tableRow} key={sub.subject_id || index}>
                  <Text style={styles.colSubject}>{sub.subjects?.name || 'Matière inconnue'}</Text>
                  <Text style={styles.colGroup}>{sub.groups?.name || 'Non assigné'}</Text>
                  <Text style={styles.colFee}>{formatMoney(sub.monthly_price)}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes scolaires</Text>
          {grades.length === 0 ? (
            <Text style={styles.empty}>Aucune note enregistrée.</Text>
          ) : (
            <>
              <View style={pdfStyles.tableHeadRow}>
                <Text style={styles.colGradeSubject}>Matière</Text>
                <Text style={styles.colGradeValue}>Note (/20)</Text>
                <Text style={styles.colGradeExam}>N° Examen</Text>
                <Text style={styles.colGradeSession}>Session</Text>
                <Text style={styles.colGradeDate}>Date</Text>
              </View>
              {grades.map((grade) => (
                <View style={pdfStyles.tableRow} key={grade.id}>
                  <Text style={styles.colGradeSubject}>{grade.subjects?.name || '—'}</Text>
                  <Text style={styles.colGradeValue}>{Number(grade.value)}</Text>
                  <Text style={styles.colGradeExam}>{grade.exam || '—'}</Text>
                  <Text style={styles.colGradeSession}>{grade.session}</Text>
                  <Text style={styles.colGradeDate}>{formatDate(grade.grade_date)}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Paiements & bilan financier</Text>
          <View style={styles.grid}>
            <GridItem label="Mois payés" value={totalMonths ? `${paidMonths}/${totalMonths}` : '—'} />
            <GridItem label="Total réglé" value={totalPaid > 0 ? formatMoney(totalPaid) : '—'} />
            {student.alerts && (
              <GridItem label="Alertes médicales / comportementales" value={student.alerts} />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suivi comportemental & discipline — {periodLabel}</Text>
          <View style={styles.statsRow}>
            {eventStats.map((stat) => (
              <View style={styles.statBox} key={stat.id}>
                <Text style={styles.statValue}>{stat.count}</Text>
                <Text style={styles.statLabel}>{stat.label}{stat.note ? ` · ${stat.note}` : ''}</Text>
              </View>
            ))}
          </View>
          {logEvents.length === 0 ? (
            <Text style={styles.empty}>Aucun événement enregistré pour cette période.</Text>
          ) : (
            <>
              <View style={pdfStyles.tableHeadRow}>
                <Text style={styles.colLogDate}>Date</Text>
                <Text style={styles.colLogEvent}>Événement</Text>
                <Text style={styles.colLogDetail}>Note / Détail</Text>
              </View>
              {logEvents.map((event, index) => (
                <View style={pdfStyles.tableRow} key={`${event.event_date}-${event.event_type}-${index}`}>
                  <Text style={styles.colLogDate}>{formatDate(event.event_date)}</Text>
                  <Text style={styles.colLogEvent}>{event.label}</Text>
                  <Text style={styles.colLogDetail}>{event.detail || '—'}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <Text style={styles.footer}>Centre Oskar · Fiche élève générée le {generatedDate}</Text>
      </Page>
    </Document>
  )
}
