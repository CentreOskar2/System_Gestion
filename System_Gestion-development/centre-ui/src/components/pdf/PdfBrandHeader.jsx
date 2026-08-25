import { View, Text, Image } from '@react-pdf/renderer'
import { pdfStyles, BRAND_NAME, LOGO_SRC } from './pdfStyles'

export function PdfBrandHeader({ tagline, label, code, date }) {
  return (
    <View style={pdfStyles.header}>
      <View style={pdfStyles.brandRow}>
        <Image src={LOGO_SRC} style={pdfStyles.logo} />
        <View>
          <Text style={pdfStyles.brandName}>{BRAND_NAME}</Text>
          <Text style={pdfStyles.brandTagline}>{tagline}</Text>
        </View>
      </View>
      <View style={pdfStyles.reference}>
        <Text style={pdfStyles.refLabel}>{label}</Text>
        <Text style={pdfStyles.refCode}>{code}</Text>
        <Text style={pdfStyles.refDate}>Date : {date}</Text>
      </View>
    </View>
  )
}

export function PdfSignatures({ left = 'Signature parent/tuteur', right = 'Signature administration' }) {
  return (
    <View style={pdfStyles.signatures}>
      <Text style={pdfStyles.signatureBox}>{left}</Text>
      <Text style={pdfStyles.signatureBox}>{right}</Text>
    </View>
  )
}
