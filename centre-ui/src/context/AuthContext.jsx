import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [role, setRole] = useState(null)
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      setRole(null)
      setPermissions([])
      setLoading(false)
      return
    }

    if (userData.status !== 'active') {
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      setRole(null)
      setPermissions([])
      setLoading(false)
      return
    }

    setProfile(userData)
    setRole(userData.role)

    if (userData.role === 'super_admin') {
      setPermissions(['dashboard', 'students', 'groups', 'teachers', 'tuition', 'late_payments', 'teacher_salaries', 'expenses', 'net_profit', 'settings', 'administration'])
    } else {
      const { data: permData } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (permData) {
        const activePerms = Object.entries(permData)
          .filter(([key, value]) => key !== 'user_id' && value === true)
          .map(([key]) => key)
        setPermissions(activePerms)
      } else {
        setPermissions([])
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        fetchProfile(currentUser.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        await fetchProfile(currentUser.id)
      } else {
        setProfile(null)
        setRole(null)
        setPermissions([])
        setLoading(false)
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const can = useCallback((perm) => permissions.includes(perm), [permissions])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setRole(null)
    setPermissions([])
  }

  return (
    <AuthContext.Provider value={{ user, profile, role, permissions, loading, signOut, can }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
