import { supabase } from './supabaseClient'
import { academicYearStart, schoolYearLabel } from './components/Accounting/monthUtils'

export const DEFAULT_REGISTRATION_FEE = 100

// Prime des professeurs (voir groupPrimeOf) : 10 DH par élève payé au-delà de
// 20 dans un groupe. cycleIds null = rien d'enregistré : le cycle préscolaire.
export const DEFAULT_TEACHER_PRIME = { threshold: 20, amountPerStudent: 10, cycleIds: null }

const KEYS = {
  registrationFee: 'registration_fee_amount',
  activeSchoolYear: 'active_school_year',
  teacherPrimeThreshold: 'teacher_prime_threshold',
  teacherPrimeAmount: 'teacher_prime_amount_per_student',
  teacherPrimeCycles: 'teacher_prime_cycle_ids',
}

const numberOr = (value, fallback) => {
  const number = Number(value)
  return value != null && value !== '' && Number.isFinite(number) ? number : fallback
}

let cache = null
const listeners = new Set()

export function subscribeAppSettings(callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function defaults() {
  return {
    registrationFee: DEFAULT_REGISTRATION_FEE,
    activeSchoolYear: schoolYearLabel(academicYearStart()),
    teacherPrime: { ...DEFAULT_TEACHER_PRIME },
  }
}

export async function fetchAppSettings({ force = false } = {}) {
  if (cache && !force) return cache

  const { data, error } = await supabase.from('app_settings').select('key, value')
  const fallback = defaults()

  // Before the app_settings migration has been applied, fall back to defaults
  // rather than breaking every screen that reads these values.
  if (error) {
    console.error(error)
    return fallback
  }

  const byKey = Object.fromEntries((data || []).map((row) => [row.key, row.value]))
  const feeValue = Number(byKey[KEYS.registrationFee])
  let primeCycleIds = null
  try {
    const parsed = JSON.parse(byKey[KEYS.teacherPrimeCycles] ?? 'null')
    if (Array.isArray(parsed)) primeCycleIds = parsed
  } catch {
    // Valeur illisible : on retombe sur le cycle préscolaire.
  }

  cache = {
    registrationFee: Number.isFinite(feeValue) ? feeValue : fallback.registrationFee,
    activeSchoolYear: byKey[KEYS.activeSchoolYear] || fallback.activeSchoolYear,
    teacherPrime: {
      threshold: numberOr(byKey[KEYS.teacherPrimeThreshold], DEFAULT_TEACHER_PRIME.threshold),
      amountPerStudent: numberOr(byKey[KEYS.teacherPrimeAmount], DEFAULT_TEACHER_PRIME.amountPerStudent),
      cycleIds: primeCycleIds,
    },
  }
  return cache
}

export async function saveAppSettings({ registrationFee, activeSchoolYear, teacherPrime }) {
  const rows = []
  if (teacherPrime !== undefined) {
    const now = new Date().toISOString()
    rows.push(
      { key: KEYS.teacherPrimeThreshold, value: String(teacherPrime.threshold), updated_at: now },
      { key: KEYS.teacherPrimeAmount, value: String(teacherPrime.amountPerStudent), updated_at: now },
      { key: KEYS.teacherPrimeCycles, value: JSON.stringify(teacherPrime.cycleIds || []), updated_at: now },
    )
  }
  if (registrationFee !== undefined) {
    rows.push({ key: KEYS.registrationFee, value: String(registrationFee), updated_at: new Date().toISOString() })
  }
  if (activeSchoolYear !== undefined) {
    rows.push({ key: KEYS.activeSchoolYear, value: String(activeSchoolYear), updated_at: new Date().toISOString() })
  }
  if (rows.length === 0) return

  const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' })
  if (error) throw new Error(error.message)

  cache = null
  for (const listener of listeners) listener()
}
