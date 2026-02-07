import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export const AdminLoginPage = () => {
  const navigate = useNavigate()
  const { isAdmin, unlockAdminByCode } = useAuth()

  const [accessCode, setAccessCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAdmin) {
      navigate('/admin', { replace: true })
    }
  }, [isAdmin, navigate])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setLoading(true)
      setError(null)
      await unlockAdminByCode(accessCode)
      navigate('/admin', { replace: true })
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
