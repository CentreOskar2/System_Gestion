import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { BRAND_NAME, LOGO_SRC, PDF_FONT_FAMILY, formatMoney } from './pdfStyles'

// Reçus destinés à l'imprimante thermique du comptoir (WDLink WD8280, rouleau
// 80 mm, zone imprimable 72 mm, 203 dpi, noir uniquement).
//
// - Page de 80 mm de large et SANS hauteur fixe : react-pdf calcule la hauteur
//   d'après le contenu, le ticket fait donc exactement la longueur du reçu.
//   Un PDF A4 était réduit à ~35 % pour tenir sur 80 mm : texte illisible.
// - Tout est en noir pur, sans fond coloré ni gris : la tête thermique ne fait
//   que du noir/blanc, les gris clairs sortent tramés ou disparaissent.
// - Les marges latérales (5 mm) absorbent la zone non imprimable du rouleau.
const INK = '#000000'
const PAPER_WIDTH = '80mm'
// La police arabe a des métriques hautes : sans interligne explicite chaque
// ligne prend ~1,7× sa taille et le ticket s'allonge inutilement. On le fixe
// sur chaque style de texte, car react-pdf hérite l'interligne en points.
const LINE = 1.25

const s = StyleSheet.create({
  page: {
    paddingTop: 10,
    paddingBottom: 28, // laisse de la marge avant le massicot (cutter)
    paddingHorizontal: 14,
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10,
    lineHeight: LINE,
    color: INK,
  },
  brand: { alignItems: 'center' },
  logo: { width: 46, height: 46, marginBottom: 4 },
  brandName: { lineHeight: LINE, fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  tagline: { lineHeight: LINE, fontSize: 9, marginTop: 1, textAlign: 'center' },
  separator: { marginVertical: 7, borderBottom: `1pt dashed ${INK}` },
  strongSeparator: { marginVertical: 7, borderBottom: `1.5pt solid ${INK}` },
  title: { lineHeight: LINE, fontSize: 11.5, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase' },
  infoRow: { flexDirection: 'row', marginTop: 2 },
  infoLabel: { width: 62 },
  infoValue: { flex: 1, fontWeight: 700 },
  sectionTitle: { lineHeight: LINE, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  lineName: { flex: 1, paddingRight: 8 },
  lineAmount: { fontWeight: 700, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { lineHeight: LINE, flex: 1, paddingRight: 8, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' },
  totalValue: { lineHeight: LINE, fontSize: 15, fontWeight: 700 },
  statusBox: {
    marginTop: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
    border: `1.5pt solid ${INK}`,
    fontSize: 10,
    lineHeight: LINE,
    fontWeight: 700,
    textAlign: 'center',
  },
  signatures: { marginTop: 16 },
  signatureLabel: { lineHeight: LINE, fontSize: 9 },
  signatureSpace: { height: 34, borderBottom: `1pt solid ${INK}`, marginBottom: 10 },
  thanks: { lineHeight: LINE, marginTop: 4, fontSize: 9, textAlign: 'center' },
})

// Un ticket = une page. Plusieurs pages dans un même <Document> donnent un seul
// travail d'impression, le massicot coupant entre chaque ticket.
export function ThermalReceipt(props) {
  return (
    <Document>
      <ThermalReceiptPage {...props} />
    </Document>
  )
}

export function ThermalReceiptPage({ tagline, title, code, date, children }) {
  return (
    <Page size={{ width: PAPER_WIDTH }} style={s.page}>
      <View style={s.brand}>
        <Image src={LOGO_SRC} style={s.logo} />
        <Text style={s.brandName}>{BRAND_NAME}</Text>
        <Text style={s.tagline}>{tagline}</Text>
      </View>

      <View style={s.strongSeparator} />
      <Text style={s.title}>{title}</Text>
      <View style={s.separator} />

      <ThermalInfo label="N° élève" value={code} />
      <ThermalInfo label="Date" value={date} />

      {children}

      <View style={s.signatures}>
        <Text style={s.signatureLabel}>Signature parent/tuteur :</Text>
        <View style={s.signatureSpace} />
        <Text style={s.signatureLabel}>Signature administration :</Text>
        <View style={s.signatureSpace} />
      </View>
      <Text style={s.thanks}>Merci de votre confiance</Text>
    </Page>
  )
}

export function ThermalInfo({ label, value }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>: {value || '—'}</Text>
    </View>
  )
}

export function ThermalSeparator() {
  return <View style={s.separator} />
}

export function ThermalLines({ title, lines }) {
  return (
    <View>
      <Text style={s.sectionTitle}>{title}</Text>
      {lines.map((line, index) => (
        <View style={s.lineRow} key={`${line.name}-${index}`}>
          <Text style={s.lineName}>{line.name}</Text>
          <Text style={s.lineAmount}>{formatMoney(line.amount)}</Text>
        </View>
      ))}
    </View>
  )
}

export function ThermalTotal({ label, amount }) {
  return (
    <>
      <View style={s.strongSeparator} />
      <View style={s.totalRow}>
        <Text style={s.totalLabel}>{label}</Text>
        <Text style={s.totalValue}>{formatMoney(amount)}</Text>
      </View>
    </>
  )
}

export function ThermalStatus({ children }) {
  return <Text style={s.statusBox}>{children}</Text>
}
