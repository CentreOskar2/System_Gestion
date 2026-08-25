import { supabase } from './supabaseClient'
import { academicYearStart, schoolYearLabel } from './components/Accounting/monthUtils'

export const DEFAULT_REGISTRATION_FEE = 100

const KEYS = {
  registrationFee: 'registration_fee_amount',
  activeSchoolYear: 'active_school_year',
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

  cache = {
    registrationFee: Number.isFinite(feeValue) ? feeValue : fallback.registrationFee,
    activeSchoolYear: byKey[KEYS.activeSchoolYear] || fallback.activeSchoolYear,
  }
  return cache
}

export async function saveAppSettings({ registrationFee, activeSchoolYear }) {
  const rows = []
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
