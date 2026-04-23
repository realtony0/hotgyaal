import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useCustomerAuth } from '../context/CustomerAuthContext'
import { useStoreSettings } from '../context/StoreSettingsContext'
import {
  COUNTRIES,
  DEFAULT_COUNTRY_CODE,
  findCountryByDialCode,
} from '../constants/countries'
import type { LoyaltyTransaction } from '../types'

type Tab = 'login' | 'register'

const POINT_VALUE_FCFA = 5

const sanitizePhone = (raw: string) => raw.replace(/\D/g, '')
const sanitizePin = (raw: string) => raw.replace(/\D/g, '').slice(0, 6)

const formatPhone = (raw: string) => {
  const digits = sanitizePhone(raw)
  const country = findCountryByDialCode(digits)

  if (country) {
    const local = digits.slice(country.dialCode.length)
    const chunks = local.match(/.{1,2}/g) ?? [local]
    return `+${country.dialCode} ${chunks.join(' ')}`.trim()
  }

  return digits.replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4')
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

export const AccountPage = () => {
  const { settings } = useStoreSettings()
  const {
    customer,
    ready,
    loading,
    login,
    register,
    logout,
    updateProfile,
    fetchHistory,
  } = useCustomerAuth()

  const [tab, setTab] = useState<Tab>('login')
  const [countryCode, setCountryCode] = useState<string>(DEFAULT_COUNTRY_CODE)
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [fullName, setFullName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profilePin, setProfilePin] = useState('')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [history, setHistory] = useState<LoyaltyTransaction[] | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const customerId = customer?.customer_id ?? null
  const customerFullName = customer?.full_name ?? ''
  const lastCustomerIdRef = useRef<string | null>(null)

  if (customerId !== lastCustomerIdRef.current) {
    lastCustomerIdRef.current = customerId
    setProfileName(customerFullName)
    if (!customerId) {
      setHistory(null)
      setHistoryError(null)
    }
  }

  useEffect(() => {
    if (!customerId) return

    let cancelled = false
    fetchHistory()
      .then((rows) => {
        if (!cancelled) setHistory(rows)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setHistoryError(error instanceof Error ? error.message : 'Erreur')
        }
      })

    return () => {
      cancelled = true
    }
  }, [customerId, fetchHistory])

  const resetFormFields = () => {
    setPhone('')
    setPin('')
    setConfirmPin('')
    setFullName('')
    setFormError(null)
  }

  const handleTabChange = (nextTab: Tab) => {
    setTab(nextTab)
    resetFormFields()
  }

  const selectedCountry = useMemo(
    () =>
      COUNTRIES.find((country) => country.code === countryCode) ?? COUNTRIES[0],
    [countryCode],
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const localDigits = sanitizePhone(phone).replace(
      new RegExp(`^${selectedCountry.dialCode}`),
      '',
    )

    if (localDigits.length < 6) {
      setFormError('Numero de telephone invalide.')
      return
    }

    const fullPhone = `${selectedCountry.dialCode}${localDigits}`

    if (pin.length < 4) {
      setFormError('Le code PIN doit contenir au moins 4 chiffres.')
      return
    }

    try {
      if (tab === 'register') {
        if (pin !== confirmPin) {
          setFormError('Les deux codes PIN ne correspondent pas.')
          return
        }
        await register({ phone: fullPhone, pin, fullName })
      } else {
        await login({ phone: fullPhone, pin })
      }
      resetFormFields()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Erreur inconnue')
    }
  }

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileError(null)
    setProfileSuccess(null)

    try {
      await updateProfile({
        fullName: profileName,
        newPin: profilePin ? profilePin : undefined,
      })
      setProfilePin('')
      setEditingProfile(false)
      setProfileSuccess('Profil mis a jour.')
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Erreur inconnue')
    }
  }

  const pointsValue = useMemo(() => {
    if (!customer) return 0
    return customer.points_balance * POINT_VALUE_FCFA
  }, [customer])

  if (!ready) {
    return (
      <section className="section account-page">
        <div className="container">
          <div className="account-card">
            <p>Chargement...</p>
          </div>
        </div>
      </section>
    )
  }

  if (!customer) {
    return (
      <section className="section account-page">
        <div className="container">
          <div className="account-card auth-card">
            <p className="eyebrow">Mon compte</p>
            <h1>
              {tab === 'login' ? 'Connexion' : 'Creer mon compte'}
            </h1>
            <p className="auth-intro">
              {tab === 'login'
                ? 'Entrez votre numero et votre PIN pour retrouver vos points.'
                : 'Creez un compte en quelques secondes avec votre numero de telephone.'}
            </p>

            <div className="auth-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'login'}
                className={tab === 'login' ? 'auth-tab is-active' : 'auth-tab'}
                onClick={() => handleTabChange('login')}
              >
                Connexion
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'register'}
                className={tab === 'register' ? 'auth-tab is-active' : 'auth-tab'}
                onClick={() => handleTabChange('register')}
              >
                Inscription
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {tab === 'register' ? (
                <label className="auth-field">
                  <span>Nom complet (optionnel)</span>
                  <input
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Prenom Nom"
                  />
                </label>
              ) : null}

              <label className="auth-field">
                <span>Pays</span>
                <select
                  className="country-select"
                  value={countryCode}
                  onChange={(event) => setCountryCode(event.target.value)}
                >
                  {COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.name} (+{country.dialCode})
                    </option>
                  ))}
                </select>
              </label>

              <label className="auth-field">
                <span>Numero de telephone</span>
                <div className="phone-field">
                  <span className="phone-field__prefix">
                    +{selectedCountry.dialCode}
                  </span>
                  <input
                    className="phone-field__input"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(event) => setPhone(sanitizePhone(event.target.value))}
                    placeholder="77 123 45 67"
                  />
                </div>
              </label>

              <label className="auth-field">
                <span>Code PIN (4 a 6 chiffres)</span>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={4}
                  maxLength={6}
                  value={pin}
                  onChange={(event) => setPin(sanitizePin(event.target.value))}
                  placeholder="••••"
                />
              </label>

              {tab === 'register' ? (
                <label className="auth-field">
                  <span>Confirmer le PIN</span>
                  <input
                    type="password"
                    inputMode="numeric"
                    required
                    minLength={4}
                    maxLength={6}
                    value={confirmPin}
                    onChange={(event) => setConfirmPin(sanitizePin(event.target.value))}
                    placeholder="••••"
                  />
                </label>
              ) : null}

              {formError ? <p className="auth-error">{formError}</p> : null}

              <button type="submit" className="button" disabled={loading}>
                {loading
                  ? 'Patientez...'
                  : tab === 'login'
                    ? 'Se connecter'
                    : 'Creer mon compte'}
              </button>
            </form>

            <div className="auth-help">
              <p>
                Besoin d&apos;aide ?{' '}
                <Link href="/contact">Contactez-nous</Link> ou appelez le{' '}
                <a href={`tel:${settings.contact_phone.replace(/\s+/g, '')}`}>
                  {settings.contact_phone}
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="section account-page">
      <div className="container account-grid">
        <div className="account-card loyalty-card">
          <p className="eyebrow">Programme fidelite HOTGYAAL</p>
          <div className="loyalty-hero">
            <div>
              <p className="loyalty-points-label">Mes points</p>
              <strong className="loyalty-points-value">
                {customer.points_balance.toLocaleString('fr-FR')}
              </strong>
              <p className="loyalty-points-hint">
                Soit <strong>{pointsValue.toLocaleString('fr-FR')} FCFA</strong> de reduction a utiliser sur une prochaine commande.
              </p>
            </div>
            <div className="loyalty-rules">
              <h3>Comment ca marche ?</h3>
              <ul>
                <li>1 point gagne pour 100 FCFA depenses</li>
                <li>Points crediter apres livraison de la commande</li>
                <li>1 point = {POINT_VALUE_FCFA} FCFA de reduction</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="account-card profile-card">
          <div className="profile-card__header">
            <div>
              <p className="eyebrow">Mes informations</p>
              <h2>{customer.full_name || 'Client HOTGYAAL'}</h2>
              <p className="profile-phone">{formatPhone(customer.phone)}</p>
            </div>
            <div className="profile-actions">
              {!editingProfile ? (
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setEditingProfile(true)}
                >
                  Modifier
                </button>
              ) : null}
              <button type="button" className="button button--ghost" onClick={logout}>
                Se deconnecter
              </button>
            </div>
          </div>

          {editingProfile ? (
            <form className="auth-form" onSubmit={handleProfileSubmit}>
              <label className="auth-field">
                <span>Nom complet</span>
                <input
                  type="text"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="Prenom Nom"
                />
              </label>
              <label className="auth-field">
                <span>Nouveau PIN (laisser vide pour ne pas changer)</span>
                <input
                  type="password"
                  inputMode="numeric"
                  minLength={4}
                  maxLength={6}
                  value={profilePin}
                  onChange={(event) => setProfilePin(sanitizePin(event.target.value))}
                  placeholder="••••"
                />
              </label>
              {profileError ? <p className="auth-error">{profileError}</p> : null}
              <div className="profile-actions">
                <button type="submit" className="button" disabled={loading}>
                  Enregistrer
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => {
                    setEditingProfile(false)
                    setProfileName(customer.full_name ?? '')
                    setProfilePin('')
                    setProfileError(null)
                  }}
                >
                  Annuler
                </button>
              </div>
            </form>
          ) : null}

          {profileSuccess ? <p className="auth-success">{profileSuccess}</p> : null}
        </div>

        <div className="account-card history-card">
          <h2>Historique des points</h2>
          {historyError ? <p className="auth-error">{historyError}</p> : null}
          {history === null ? (
            <p>Chargement...</p>
          ) : history.length === 0 ? (
            <p className="history-empty">
              Aucune transaction pour le moment. Passez votre premiere commande pour gagner des points !
            </p>
          ) : (
            <ul className="history-list">
              {history.map((tx) => (
                <li key={tx.id} className={`history-item history-item--${tx.kind}`}>
                  <div>
                    <strong>
                      {tx.kind === 'credit' ? '+' : '-'}
                      {Math.abs(tx.amount).toLocaleString('fr-FR')} pts
                    </strong>
                    <span>{tx.reason || (tx.kind === 'credit' ? 'Credit' : 'Debit')}</span>
                  </div>
                  <time dateTime={tx.created_at}>{formatDate(tx.created_at)}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
