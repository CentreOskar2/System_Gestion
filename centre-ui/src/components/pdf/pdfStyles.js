import { StyleSheet } from '@react-pdf/renderer'

export const colors = {
  primary: '#315fec',
  primaryDark: '#264fc9',
  text: '#13213a',
  textDark: '#172033',
  muted: '#647088',
  border: '#dce3ed',
  avatarBg: '#e7edff',
  successBg: '#effcf1',
  successBorder: '#aee8b9',
  successText: '#1b6d2e',
}

export const BRAND_NAME = 'Centre Oskar'
export const LOGO_SRC = '/oskar-logo.png'

// The Helvetica standard font react-pdf uses only supports WinAnsi (cp1252) glyphs.
// toLocaleString('fr-FR') inserts a no-break/narrow-no-break space (U+00A0 / U+202F) as
// the thousands separator, which isn't in that encoding and renders as a stray glyph —
// swap it for a plain space (U+0020).
const NON_BREAKING_SPACES = new RegExp(`[${String.fromCharCode(0x00a0)}${String.fromCharCode(0x202f)}]`, 'g')

export const formatMoney = (value) =>
  `${Number(value || 0).toLocaleString('fr-FR').replace(NON_BREAKING_SPACES, ' ')} DH`

export const pdfStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: colors.text,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 20,
    marginBottom: 24,
    borderBottom: `1px solid ${colors.border}`,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 44,
    height: 44,
    marginRight: 10,
    borderRadius: 8,
  },
  brandName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: colors.text,
  },
  brandTagline: {
    marginTop: 3,
    fontSize: 9,
    color: colors.muted,
  },
  reference: {
    alignItems: 'flex-end',
  },
  refLabel: {
    fontSize: 8,
    letterSpacing: 1,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  refCode: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  refDate: {
    marginTop: 4,
    fontSize: 9,
    color: colors.muted,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.avatarBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImg: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
  },
  avatarText: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
  },
  personName: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  personMeta: {
    fontSize: 9,
    color: colors.muted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
  },
  tableHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottom: `1px solid ${colors.border}`,
    fontSize: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
  },
  totalLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  totalValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
  },
  confirmationBox: {
    marginTop: 18,
    padding: 12,
    borderRadius: 6,
    border: `1px solid ${colors.successBorder}`,
    backgroundColor: colors.successBg,
    color: colors.successText,
    fontSize: 9.5,
  },
  signatures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 70,
  },
  signatureBox: {
    width: '45%',
    paddingTop: 10,
    borderTop: `1px solid ${colors.border}`,
    fontSize: 8.5,
    color: colors.muted,
  },
})
