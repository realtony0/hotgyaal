import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useStoreSettings } from '../context/StoreSettingsContext'
import { isSupabaseConfigured, resolveOrderErrorMessage } from '../lib/supabase'
import { createOrder } from '../services/orders'
import type { CartItem } from '../types'
import { stripColorTag } from '../utils/colorTag'
import {
  COUNTRIES,
  DEFAULT_COUNTRY_CODE,
  FREQUENT_COUNTRY_CODES,
  countryName,
  type Country,
} from '../constants/countries'
import { formatCurrency } from '../utils/format'

type CheckoutFormState = {
  customerName: string
  customerPhone: string
  line1: string
  city: string
  country: string
  note: string
}

const initialCheckoutState: CheckoutFormState = {
  customerName: '',
  customerPhone: '',
  line1: '',
  city: '',
  country: DEFAULT_COUNTRY_CODE,
  note: '',
}

const frequentCountries = FREQUENT_COUNTRY_CODES.map((code) =>
  COUNTRIES.find((country) => country.code === code),
).filter((country): country is Country => Boolean(country))

type ShippingOption = {
  id: string
  name: string
  priceLabel: string
  timeline: string
  summary: string
}

const SHIPPING_OPTIONS: ShippingOption[] = [
  {
    id: 'gp-express',
    name: 'GP Express',
    priceLabel: '10 000 FCFA / kg',
    timeline: '7 jours',
    summary: 'Le plus rapide, idéal pour une ou deux pièces.',
  },
  {
    id: 'freight-aerien',
    name: 'Fret aérien',
    priceLabel: '7 000 FCFA / kg',
    timeline: '10 à 12 jours',
    summary: 'Le meilleur rapport délai/prix pour une commande moyenne.',
  },
  {
    id: 'container',
    name: 'Conteneur',
    priceLabel: '117 000 FCFA / m³',
    timeline: '1 à 2 mois',
    summary: 'Réservé aux gros volumes, sur devis après échange.',
  },
]

const normalizeChatNumber = (rawNumber: string) => {
  const digits = rawNumber.replace(/\D/g, '')

  if (digits.length === 9 && digits.startsWith('7')) {
    return `221${digits}`
  }

  if (digits.length === 10 && digits.startsWith('0')) {
    const local = digits.slice(1)
    if (local.length === 9 && local.startsWith('7')) {
      return `221${local}`
    }
  }

  return digits
}

const getShippingOptionById = (shippingId: string) =>
  SHIPPING_OPTIONS.find((option) => option.id === shippingId) ?? null

const getFallbackEmail = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  const safeDigits = digits || 'client'
  return `commande-${safeDigits}@hotgyaal.local`
}

const buildOrderMessage = (
  formState: CheckoutFormState,
  items: CartItem[],
  subtotal: number,
  shippingOption: ShippingOption,
  orderNumber: string | null,
) => {
  const lines = [
    'Nouvelle commande HOTGYAAL',
    orderNumber ? `Référence: ${orderNumber}` : 'Référence: En attente',
    '',
    `Nom: ${formState.customerName}`,
    `Téléphone: ${formState.customerPhone || 'Non renseigné'}`,
    '',
    'Articles:',
  ]

  items.forEach((item, index) => {
    const options = item.selected_color
      ? `${item.selected_size} · ${item.selected_color.label}`
      : item.selected_size
    lines.push(
      `${index + 1}. ${item.product.name} [${options}] x${item.quantity} - ${formatCurrency(item.product.price * item.quantity)}`,
    )
    // La photo du coloris leve toute ambiguite sur la teinte commandee.
    if (item.selected_color?.image_url) {
      lines.push(`   Photo du coloris : ${stripColorTag(item.selected_color.image_url)}`)
    }
  })

  lines.push('')
  lines.push(`Sous-total produits: ${formatCurrency(subtotal)}`)
  lines.push(`Option transit choisie: ${shippingOption.name} (${shippingOption.timeline})`)
  lines.push('Montant du transit confirmé après pesée réelle du colis.')
  lines.push('')
  lines.push(
    `Adresse de livraison: ${[formState.line1, formState.city, countryName(formState.country)]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ')}`,
  )
  if (formState.note.trim()) {
    lines.push(`Note cliente: ${formState.note.trim()}`)
  }

  return lines.join('\n')
}

export const CartPage = () => {
  const { user } = useAuth()
  const { settings } = useStoreSettings()
  const { items, subtotal, removeFromCart, updateQuantity, clearCart } = useCart()

  const [formState, setFormState] = useState<CheckoutFormState>(
    initialCheckoutState,
  )
  const [selectedShippingId, setSelectedShippingId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const selectedShippingOption = getShippingOptionById(selectedShippingId)
  const orderChatNumber = normalizeChatNumber(
    settings.order_chat_number ||
      (
        process.env.NEXT_PUBLIC_ORDER_CHAT_NUMBER ??
        process.env.VITE_ORDER_CHAT_NUMBER ??
        '221770000000'
      ).toString(),
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!items.length) {
      setError('Le panier est vide.')
      return
    }

    if (!selectedShippingOption) {
      setError('Choisissez une option de transit.')
      return
    }

    if (!orderChatNumber) {
      setError('Le numéro de confirmation est absent.')
      return
    }

    if (!isSupabaseConfigured) {
      setError(resolveOrderErrorMessage('Supabase non configure'))
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccessMessage(null)

      const customerEmail = getFallbackEmail(formState.customerPhone)
      const line2 = [
        formState.note.trim(),
        `Transit: ${selectedShippingOption.name} (${selectedShippingOption.timeline})`,
      ]
        .filter(Boolean)
        .join(' | ')

      const order = await createOrder({
        userId: user?.id ?? null,
        customerName: formState.customerName,
        customerEmail,
        customerPhone: formState.customerPhone,
        shippingAddress: {
          line1: formState.line1,
          line2,
          city: formState.city.trim(),
          postal_code: '00000',
          country: countryName(formState.country),
        },
        items,
      })

      const message = buildOrderMessage(
        formState,
        items,
        subtotal,
        selectedShippingOption,
        order.order_number,
      )

      clearCart()
      setFormState(initialCheckoutState)
      setSelectedShippingId('')
      setSuccessMessage('Commande en cours de confirmation...')

      if (typeof window !== 'undefined') {
        window.location.assign(
          `https://wa.me/${orderChatNumber}?text=${encodeURIComponent(message)}`,
        )
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : resolveOrderErrorMessage(submitError),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="section cart-v2">
      <div className="container cart-layout">
        <div>
          <div className="section__header section__header--v2">
            <div>
              <p className="eyebrow">Panier</p>
              <h1>Votre sélection</h1>
            </div>
            <Link href="/boutique">Continuer mes achats</Link>
          </div>

          {!items.length ? (
            <div className="empty-state">
              <p>Votre panier est vide.</p>
              <Link className="button" href="/boutique">
                Explorer la boutique
              </Link>
            </div>
          ) : (
            <div className="cart-items">
              {items.map((item) => (
                <article className="cart-item" key={item.line_id}>
                  <img
                    src={
                      item.selected_color?.image_url ||
                      item.product.image_url ||
                      '/placeholder-produit.svg'
                    }
                    alt={item.product.name}
                    loading="lazy"
                  />

                  <div>
                    <h3>{item.product.name}</h3>
                    <p>
                      {item.product.main_category} · {item.product.sub_category}
                    </p>
                    <p className="cart-item__size">Taille: {item.selected_size}</p>
                    {item.selected_color ? (
                      <p className="cart-item__color">
                        {item.selected_color.hex ? (
                          <span
                            className="cart-item__color-dot"
                            style={{ background: item.selected_color.hex }}
                            aria-hidden="true"
                          />
                        ) : null}
                        {item.selected_color.label}
                      </p>
                    ) : null}
                    <strong>{formatCurrency(item.product.price)}</strong>
                  </div>

                  <div className="quantity-actions">
                    <label>
                      Qté
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(event) =>
                          updateQuantity(
                            item.line_id,
                            Math.max(1, Number(event.target.value) || 1),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() => removeFromCart(item.line_id)}
                    >
                      Supprimer
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {items.length ? (
        <aside className="checkout-card checkout-card-v2">
          <h2>Finaliser</h2>
          <dl>
            <div>
              <dt>Sous-total produits</dt>
              <dd>{formatCurrency(subtotal)}</dd>
            </div>
            <div>
              <dt>Transit</dt>
              <dd>
                {selectedShippingOption ? selectedShippingOption.name : 'À choisir'}
              </dd>
            </div>
          </dl>

          <p className="shipping-note">
            Le transit est facturé au poids réel du colis. Nous vous confirmons son
            montant sur WhatsApp après pesée, avant tout paiement.
          </p>

          <form className="checkout-form checkout-form--simple" onSubmit={handleSubmit}>
            <fieldset className="shipping-selector">
              <legend>Choix transit</legend>
              <div className="shipping-options">
                {SHIPPING_OPTIONS.map((option) => (
                  <label
                    key={option.id}
                    className={
                      selectedShippingId === option.id
                        ? 'shipping-option is-active'
                        : 'shipping-option'
                    }
                  >
                    <input
                      required
                      type="radio"
                      name="shipping-option"
                      value={option.id}
                      checked={selectedShippingId === option.id}
                      onChange={(event) => setSelectedShippingId(event.target.value)}
                    />
                    <span className="shipping-option__body">
                      <strong>{option.name}</strong>
                      <small>
                        {option.priceLabel} · {option.timeline}
                      </small>
                      <small className="shipping-option__summary">{option.summary}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label>
              Nom complet
              <input
                required
                value={formState.customerName}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, customerName: event.target.value }))
                }
                placeholder="Ex: Aissatou Ndiaye"
              />
            </label>

            <label>
              Pays de livraison
              <select
                required
                value={formState.country}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, country: event.target.value }))
                }
                autoComplete="country"
              >
                <optgroup label="Pays fréquents">
                  {frequentCountries.map((country) => (
                    <option key={`frequent-${country.code}`} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Tous les pays">
                  {COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>

            <label>
              Téléphone
              <input
                required
                value={formState.customerPhone}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, customerPhone: event.target.value }))
                }
                placeholder={
                  formState.country === 'SN'
                    ? 'Ex : 77 000 00 00'
                    : "Avec l'indicatif, ex : +33 6 12 34 56 78"
                }
                type="tel"
                autoComplete="tel"
              />
            </label>

            <label>
              Ville
              <input
                required
                value={formState.city}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, city: event.target.value }))
                }
                placeholder={formState.country === 'SN' ? 'Ex : Dakar, Thiès, Saint-Louis' : 'Ex : Paris, Abidjan'}
                autoComplete="address-level2"
              />
            </label>

            <label>
              Adresse de livraison
              <input
                required
                value={formState.line1}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, line1: event.target.value }))
                }
                placeholder="Quartier, rue, point de repère (ex : Parcelles Assainies U10)"
                autoComplete="street-address"
              />
            </label>

            <label>
              Note (optionnel)
              <input
                value={formState.note}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, note: event.target.value }))
                }
                placeholder="Ex: Appeler avant livraison (optionnel)"
              />
            </label>

            {error ? <p className="error-text">{error}</p> : null}
            {successMessage ? <p className="success-text">{successMessage}</p> : null}

            <button className="button" type="submit" disabled={loading || !items.length}>
              {loading ? 'Validation...' : 'Valider la commande'}
            </button>
          </form>
        </aside>
        ) : null}
      </div>
    </section>
  )
}
