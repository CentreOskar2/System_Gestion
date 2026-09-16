import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import { pdfStyles, formatMoney } from './pdfStyles'
import { PdfBrandHeader, PdfSignatures } from './PdfBrandHeader'
import { initials } from '../Students/utils/studentHelpers'

// Reçu d'une mensualité de formation. Volontairement proche de FeeReceiptPdf :
// c'est le même geste au comptoir, le parent doit reconnaître le document.
// La différence tient au détail — une formation et son niveau, là où la
// scolarité liste les matières suivies.
export default function FormationFeeReceiptPdf({ student, formationName, levelName, groupName, monthLabel, amount, dateLabel }) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <PdfBrandHeader
          tagline="Cours particuliers — Agadir"
          label="Reçu de frais de formation"
          code={student.code}
          date={dateLabel}
        />

        <View style={pdfStyles.personRow}>
          {student.photoUrl ? (
            <Image src={student.photoUrl} style={pdfStyles.avatarImg} />
          ) : (
            <View style={pdfStyles.avatar}>
              <Text style={pdfStyles.avatarText}>{initials(student.name)}</Text>
            </View>
          )}
          <View>
            <Text style={pdfStyles.personName}>{student.name}</Text>
            <Text style={pdfStyles.personMeta}>Formation : {formationName || '—'}</Text>
            <Text style={pdfStyles.personMeta}>Niveau : {levelName || '—'}</Text>
            {groupName ? <Text style={pdfStyles.personMeta}>Groupe : {groupName}</Text> : null}
          </View>
        </View>

        <View>
          <Text style={pdfStyles.sectionTitle}>Détail</Text>
          <View style={pdfStyles.tableHeadRow}>
            <Text>Désignation</Text>
            <Text>Montant</Text>
          </View>
          <View style={pdfStyles.tableRow}>
            <Text>{formationName} — {levelName} · {monthLabel}</Text>
            <Text>{formatMoney(amount)}</Text>
          </View>
          <View style={pdfStyles.totalRow}>
            <Text style={pdfStyles.totalLabel}>Montant total payé</Text>
            <Text style={pdfStyles.totalValue}>{formatMoney(amount)}</Text>
          </View>
        </View>

        <View style={pdfStyles.confirmationBox}>
          <Text>Paiement reçu en espèces — Le {dateLabel}</Text>
        </View>

        <PdfSignatures />
      </Page>
    </Document>
  )
}
