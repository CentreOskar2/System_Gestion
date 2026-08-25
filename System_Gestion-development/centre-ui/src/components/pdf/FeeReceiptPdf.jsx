import { Document, Page, View, Text } from '@react-pdf/renderer'
import { pdfStyles, formatMoney } from './pdfStyles'
import { PdfBrandHeader, PdfSignatures } from './PdfBrandHeader'
import { initials } from '../Students/utils/studentHelpers'

export default function FeeReceiptPdf({ receipt, dateLabel }) {
  const { student, lines, total, month } = receipt

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <PdfBrandHeader
          tagline="Cours particuliers — Casablanca"
          label="Reçu de paiement mensuel"
          code={student.code}
          date={dateLabel}
        />

        <View style={pdfStyles.personRow}>
          <View style={pdfStyles.avatar}>
            <Text style={pdfStyles.avatarText}>{initials(student.name)}</Text>
          </View>
          <View>
            <Text style={pdfStyles.personName}>{student.name}</Text>
            <Text style={pdfStyles.personMeta}>Niveau : {student.level}</Text>
            <Text style={pdfStyles.personMeta}>Mois réglé : {month}</Text>
          </View>
        </View>

        <View>
          <Text style={pdfStyles.sectionTitle}>Détail des matières</Text>
          <View style={pdfStyles.tableHeadRow}>
            <Text>Matière</Text>
            <Text>Prix</Text>
          </View>
          {lines.map((line) => (
            <View style={pdfStyles.tableRow} key={line.name}>
              <Text>{line.name}</Text>
              <Text>{formatMoney(line.amount)}</Text>
            </View>
          ))}
          <View style={pdfStyles.totalRow}>
            <Text style={pdfStyles.totalLabel}>Montant total payé</Text>
            <Text style={pdfStyles.totalValue}>{formatMoney(total)}</Text>
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
