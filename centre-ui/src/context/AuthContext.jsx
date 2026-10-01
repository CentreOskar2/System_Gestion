import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

// Délai avant de réessayer de charger le profil après une erreur réseau.
const PROFILE_RETRY_MS = 5000

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [role, setRole] = useState(null)
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  // Compte dont le profil est chargé (ou en cours de chargement). Sert à ne
  // recharger le profil que lorsque le compte change réellement.
  const loadedUserIdRef = useRef(null)

  async function fetchProfile(userId) {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    // Une erreur réseau ou serveur ne prouve pas que le compte est invalide :
    // déconnecter la secrétaire pour une coupure passagère lui ferait perdre
    // la saisie en cours. On réessaie, tant que ce compte est toujours connecté.
    if (userError) {
      console.error(userError)
      setTimeout(() => {
        if (loadedUserIdRef.current === userId) fetchProfile(userId)
      }, PROFILE_RETRY_MS)
      return
    }

    if (!userData) {
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

    if (['super_admin', 'admin', 'director'].includes(userData.role)) {
      setPermissions(['dashboard', 'students', 'groups', 'teachers', 'tuition', 'late_payments', 'teacher_salaries', 'expenses', 'net_profit', 'settings', 'reports', 'administration'])
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
    // onAuthStateChange émet INITIAL_SESSION dès l'abonnement : inutile de
    // lire la session une seconde fois avec getSession().
    //
    // Le rappel est volontairement synchrone. Supabase l'exécute en tenant son
    // verrou de session (notamment pendant le rafraîchissement du jeton, toutes
    // les heures) : y attendre une requête Supabase peut bloquer toutes les
    // requêtes suivantes. Le chargement du profil est donc reporté hors du
    // rappel avec setTimeout.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null

      if (!currentUser) {
        loadedUserIdRef.current = null
        setUser(null)
        setProfile(null)
        setRole(null)
        setPermissions([])
        setLoading(false)
        return
      }

      // TOKEN_REFRESHED, ou SIGNED_IN réémis au retour sur l'onglet : même
      // compte, rien à recharger. Repasser `loading` à true démonterait la page
      // affichée et ferait perdre un formulaire en cours de saisie.
      if (loadedUserIdRef.current === currentUser.id) {
        setUser((previous) => (previous?.id === currentUser.id ? previous : currentUser))
        return
      }

      loadedUserIdRef.current = currentUser.id
      setLoading(true)
      setUser(currentUser)
      setTimeout(() => fetchProfile(currentUser.id), 0)
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const can = useCallback((perm) => permissions.includes(perm), [permissions])

  const signOut = async () => {
    loadedUserIdRef.current = null
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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
