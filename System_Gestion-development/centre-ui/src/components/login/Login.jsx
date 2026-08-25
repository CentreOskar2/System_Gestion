import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { firstAllowedPath } from '../../permissionRoutes'
import './Login.css'

function GraduationCap() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m3 9 9-4.5L21 9l-9 4.5L3 9Z" />
      <path d="M6.5 10.8v4.1c0 1.2 2.5 2.6 5.5 2.6s5.5-1.4 5.5-2.6v-4.1M21 9v5" />
    </svg>
  )
}

function FieldIcon({ type }) {
  if (type === 'mail') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="1.5" /><path d="m4.5 7 7.5 5.5L19.5 7" /></svg>
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="10" width="13" height="10" rx="1.8" /><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v2" /></svg>
}

export default function Login() {
  const navigate = useNavigate()
  const { user, permissions, loading: authLoading } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Already signed in (fresh login or an existing session) — leave the login
  // page instead of letting it be used again, once we know what the account
  // is allowed to see.
  useEffect(() => {
    if (!authLoading && user) {
      navigate(firstAllowedPath(permissions), { replace: true })
    }
  }, [authLoading, user, permissions, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setSubmitting(false)
      return
    }

    // Redirect happens once AuthContext resolves the account's permissions (see effect above).
  }

  if (authLoading || user) {
    return null
  }

  return (
    <main className="login-page">
      <section className="login-showcase" aria-label="Présentation Centre Oskar">
        <div className="login-brand">
          <GraduationCap />
          <span>Centre Oskar</span>
        </div>

        <div className="login-showcase__content">
          <img src="/image-login.png" alt="Plateforme Centre Oskar" className="login-showcase__image" />
          <h1>Plateforme de Gestion<br />Administrative</h1>
          <p>Centralisez vos dossiers étudiants, professeurs et<br />comptabilité en un seul endroit sécurisé.</p>
        </div>

        <small>© 2024 Centre Oskar. Tous droits réservés.</small>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <form className="login-form" onSubmit={handleSubmit}>
          <header>
            <h2 id="login-title">Bienvenue</h2>
            <p>Veuillez vous connecter pour accéder à votre espace.</p>
          </header>

          <label>
            <span>Adresse Email</span>
            <div className="login-input">
              <FieldIcon type="mail" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </label>

          <label>
            <span>Mot de passe</span>
            <div className="login-input">
              <FieldIcon type="password" />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 12s3.7-5.8 9.2-5.8 9.2 5.8 9.2 5.8-3.7 5.8-9.2 5.8S2.8 12 2.8 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>
              </button>
            </div>
          </label>

          {error && <p className="login-error">{error}</p>}

          <label className="remember-me">
            <input type="checkbox" />
            <span>Se souvenir de moi</span>
          </label>

          <button className="login-submit" type="submit" disabled={submitting}>{submitting ? 'Connexion...' : 'Se connecter'} <span aria-hidden="true">→</span></button>
        </form>
      </section>
    </main>
  )
}
