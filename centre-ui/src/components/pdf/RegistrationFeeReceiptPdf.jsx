import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import { pdfStyles, formatMoney } from './pdfStyles'
import { PdfBrandHeader, PdfSignatures } from './PdfBrandHeader'
import { initials } from '../Students/utils/studentHelpers'

export default function RegistrationFeeReceiptPdf({ student, amount, schoolYear, dateLabel }) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <PdfBrandHeader
          tagline="Cours particuliers — Agadir"
          label="Reçu de frais d'inscription"
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
            <Text style={pdfStyles.personMeta}>Niveau : {student.level || '—'}</Text>
            <Text style={pdfStyles.personMeta}>Année scolaire : {schoolYear}</Text>
          </View>
        </View>

        <View>
          <Text style={pdfStyles.sectionTitle}>Détail</Text>
          <View style={pdfStyles.tableHeadRow}>
            <Text>Désignation</Text>
            <Text>Montant</Text>
          </View>
          <View style={pdfStyles.tableRow}>
            <Text>Frais d'inscription — {schoolYear}</Text>
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
