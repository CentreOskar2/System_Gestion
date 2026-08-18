import { useAuth } from '../context/AuthContext'

export default function NoAccess() {
  const { signOut } = useAuth()

  return (
    <div className="access-denied">
      <div>
        <h1>Aucun accès</h1>
        <p>Votre compte n'a pour l'instant accès à aucune fonctionnalité. Contactez un administrateur pour obtenir des permissions.</p>
        <button type="button" onClick={signOut}>Se déconnecter</button>
      </div>
    </div>
  )
}
