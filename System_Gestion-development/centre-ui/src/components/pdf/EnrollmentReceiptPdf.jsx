import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import { pdfStyles, formatMoney, colors } from './pdfStyles'
import { PdfBrandHeader, PdfSignatures } from './PdfBrandHeader'
import { initials } from '../Students/utils/studentHelpers'

export default function EnrollmentReceiptPdf({ form, lines, total, dateLabel, registrationFee, registrationFeePaid, firstMonthPaid }) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <PdfBrandHeader
          tagline="Centre de soutien scolaire — Casablanca"
          label="Reçu d'inscription"
          code={form.code}
          date={dateLabel}
        />

        <View style={pdfStyles.personRow}>
          {form.photoUrl ? (
            <Image src={form.photoUrl} style={pdfStyles.avatarImg} />
          ) : (
            <View style={pdfStyles.avatar}>
              <Text style={pdfStyles.avatarText}>{initials(`${form.firstName} ${form.lastName}`)}</Text>
            </View>
          )}
          <View>
            <Text style={pdfStyles.personName}>{form.firstName || 'Élève'} {form.lastName}</Text>
            <Text style={pdfStyles.personMeta}>Niveau : {form.level || '—'}</Text>
            <Text style={pdfStyles.personMeta}>Cycle : {form.cycle || '—'}</Text>
          </View>
        </View>

        <View>
          <Text style={pdfStyles.sectionTitle}>Matières inscrites</Text>
          <View style={pdfStyles.tableHeadRow}>
            <Text>Matière</Text>
            <Text>Prix mensuel</Text>
          </View>
          {lines.map((line) => (
            <View style={pdfStyles.tableRow} key={line.name}>
              <Text>{line.name}</Text>
              <Text>{formatMoney(line.amount)}</Text>
            </View>
          ))}
          <View style={pdfStyles.totalRow}>
            <Text style={pdfStyles.totalLabel}>Total mensuel à payer</Text>
            <Text style={pdfStyles.totalValue}>{formatMoney(total)}</Text>
          </View>
          <Text
            style={{
              marginTop: 10,
              padding: 9,
              borderRadius: 5,
              fontSize: 9,
              backgroundColor: firstMonthPaid ? colors.successBg : '#fff4e5',
              color: firstMonthPaid ? colors.successText : '#9a5b00',
            }}
          >
            {firstMonthPaid ? `Payé le ${dateLabel}` : 'En attente de paiement'}
          </Text>
        </View>

        {registrationFee != null && (
          <View style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${colors.border}` }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={pdfStyles.totalLabel}>Frais d'inscription (une seule fois)</Text>
              <Text style={pdfStyles.totalLabel}>{formatMoney(registrationFee)}</Text>
            </View>
            <Text
              style={{
                marginTop: 10,
                padding: 9,
                borderRadius: 5,
                fontSize: 9,
                backgroundColor: registrationFeePaid ? colors.successBg : '#fff4e5',
                color: registrationFeePaid ? colors.successText : '#9a5b00',
              }}
            >
              {registrationFeePaid ? `Payé le ${dateLabel}` : 'En attente de paiement'}
            </Text>
          </View>
        )}

        <PdfSignatures />
      </Page>
    </Document>
  )
}
