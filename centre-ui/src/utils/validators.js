export const PHONE_NUMBER_ERROR = 'Le numéro doit contenir exactement 10 chiffres.'

export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export function normalizePhoneInput(value) {
  return digitsOnly(value)
}

export function isValidPhoneNumber(value) {
  return digitsOnly(value).length === 10
}

export function phoneValidationMessage(value) {
  return isValidPhoneNumber(value) ? '' : PHONE_NUMBER_ERROR
}
