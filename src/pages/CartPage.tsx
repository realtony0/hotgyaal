import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useStoreSettings } from '../context/StoreSettingsContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { createOrder } from '../services/orders'
import type { CartItem } from '../types'
import { formatCurrency } from '../utils/format'

type CheckoutFormState = {
  customerName: string
  customerPhone: string
  line1: string
  city: string
  note: string
}

const initialCheckoutState: CheckoutFormState = {
  customerName: '',
  customerPhone: '',
  line1: '',
  city: '',
  note: '',
}

type ShippingOption = {
  id: string
  name: string
  priceLabel: string
  timeline: string
}

const SHIPPING_OPTIONS: ShippingOption[] = [
  {
    id: 'gp-express',
    name: 'Gp Express',
    priceLabel: '10.000 FCFA / kg',
    timeline: '7 jours',
  },
  {
    id: 'freight-aerien',
    name: 'Freight aerien',
    priceLabel: '7.000 FCFA / kg',
    timeline: '10-12 jours',
  },
  {
    id: 'container',
    name: 'Contener',
    priceLabel: '117.000 FCFA / CBM',
    timeline: '1-2 mois',
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
    orderNumber ? `Reference: ${orderNumber}` : 'Reference: En attente',
    '',
    `Nom: ${formState.customerName}`,
    `Telephone: ${formState.customerPhone || 'Non renseigne'}`,
    '',
    'Articles:',
  ]

  items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.product.name} [${item.selected_size}] x${item.quantity} - ${formatCurrency(item.product.price * item.quantity)}`,
    )
  })

  lines.push('')
  lines.push(`Sous-total produits: ${formatCurrency(subtotal)}`)
  lines.push(
    `Option transit: ${shippingOption.name} - ${shippingOption.priceLabel} (${shippingOption.timeline})`,
  )
  lines.push('Frais exacts confirms apres verification poids/volume.')
  lines.push('')
  lines.push(`Adresse: ${formState.line1}, ${formState.city}`)
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
      setError('Le numero de confirmation est absent.')
      return
    }

    if (!isSupabaseConfigured) {
      setError(
        "Supabase n'est pas configure. Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
      )
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccessMessage(null)

      const customerEmail = getFallbackEmail(formState.customerPhone)
      const line2 = [
        formState.note.trim(),
        `Transit: ${selectedShippingOption.name} (${selectedShippingOption.priceLabel}, ${selectedShippingOption.timeline})`,
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
          city: formState.city,
          postal_code: '00000',
          country: 'Senegal',
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
          : 'Impossible de finaliser la commande.',
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
              <h1>Votre selection</h1>
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
                      item.product.image_url ||
                      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=500&q=80'
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
                    <strong>{formatCurrency(item.product.price)}</strong>
                  </div>

                  <div className="quantity-actions">
                    <label>
                      Qte
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

        <aside className="checkout-card checkout-card-v2">
          <h2>Finaliser</h2>
          <dl>
            <div>
              <dt>Sous-total</dt>
              <dd>{formatCurrency(subtotal)}</dd>
            </div>
            <div>
              <dt>Transit</dt>
              <dd>
                {selectedShippingOption
                  ? `${selectedShippingOption.name} (${selectedShippingOption.timeline})`
                  : 'A choisir'}
              </dd>
            </div>
          </dl>

          <p className="shipping-note">
            Le cout final du transit est confirme apres verification du poids ou du volume.
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
                    <span>
                      <strong>{option.name}</strong>
                      <small>
                        {option.priceLabel} ({option.timeline})
                      </small>
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
              Telephone
              <input
                required
                value={formState.customerPhone}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, customerPhone: event.target.value }))
                }
                placeholder="Ex: 77 000 00 00"
              />
            </label>

            <label>
              Adresse / Quartier
              <input
                required
                value={formState.line1}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, line1: event.target.value }))
                }
                placeholder="Ex: Parcelles Assainies U10"
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
                placeholder="Ex: Dakar"
              />
            </label>

            <label>
              Note (optionnel)
              <input
                value={formState.note}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, note: event.target.value }))
                }
                placeholder="Ex: Appeler avant livraison"
              />
            </label>

            {error ? <p className="error-text">{error}</p> : null}
            {successMessage ? <p className="success-text">{successMessage}</p> : null}

            <button className="button" type="submit" disabled={loading || !items.length}>
              {loading ? 'Validation...' : 'Valider la commande'}
            </button>
          </form>
        </aside>
      </div>
    </section>
  )
}
