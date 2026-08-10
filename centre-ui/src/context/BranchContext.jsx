import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

export const ALL_BRANCHES = 'all'

const STORAGE_KEY = 'centre_selected_branch'

function readStoredBranch() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || ALL_BRANCHES
  } catch {
    return ALL_BRANCHES
  }
}

const BranchContext = createContext(null)

export function BranchProvider({ children }) {
  const [selectedBranch, setSelectedBranchState] = useState(readStoredBranch)
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('branches')
      .select('id, name')
      .eq('status', 'active')
      .order('name')
      .then(({ data, error }) => {
        if (cancelled) return
        const list = data || []
        setBranches(list)
        setLoading(false)
        if (error) return
        const stored = readStoredBranch()
        if (stored !== ALL_BRANCHES && !list.some((b) => b.id === stored)) {
          setSelectedBranchState(ALL_BRANCHES)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setSelectedBranch = useCallback((next) => {
    setSelectedBranchState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* stockage indisponible (navigation privée, etc.) */
    }
  }, [])

  const selectedBranchName = useMemo(() => {
    if (selectedBranch === ALL_BRANCHES) return 'Toutes les succursales'
    const found = branches.find((b) => b.id === selectedBranch)
    return found ? found.name : 'Toutes les succursales'
  }, [selectedBranch, branches])

  const value = useMemo(
    () => ({
      selectedBranch,
      setSelectedBranch,
      branches,
      selectedBranchName,
      loading,
      isAll: selectedBranch === ALL_BRANCHES,
      ALL_BRANCHES,
    }),
    [selectedBranch, setSelectedBranch, branches, selectedBranchName, loading]
  )

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBranch() {
  const context = useContext(BranchContext)
  if (!context) throw new Error('useBranch must be used within a BranchProvider')
  return context
}
