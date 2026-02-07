import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../../context/AuthContext'

export const AdminLoginPage = () => {
  const router = useRouter()
  const { isAdmin, unlockAdminByCode } = useAuth()

  const [accessCode, setAccessCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) {
      void router.replace('/admin')
    }
  }, [isAdmin, router])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setLoading(true)
      setError(null)
      await unlockAdminByCode(accessCode)
      await router.replace('/admin')
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Connexion impossible.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">HOTGYAAL Back Office</p>
        <h1>Connexion Admin</h1>
        <p>Entrez le code d'accès pour ouvrir le dashboard.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Code
            <input
              required
              type="password"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="Entrez le code"
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button type="submit" className="button" disabled={loading}>
            {loading ? 'Connexion...' : 'Entrer'}
          </button>
        </form>
      </div>
    </section>
  )
}
