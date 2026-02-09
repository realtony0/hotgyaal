import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { createOrder } from '../services/orders'
import type { CartItem } from '../types'
import { formatCurrency } from '../utils/format'

type CheckoutFormState = {
  customerName: string
  customerPhone: string
  line1: string
  line2: string
  city: string
}

const initialCheckoutState: CheckoutFormState = {
  customerName: '',
  customerPhone: '',
  line1: '',
  line2: '',
  city: '',
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
    priceLabel: '10.000fcfa le kg',
    timeline: '7 jours',
  },
  {
    id: 'freight-aerien',
    name: 'Freight aerien',
    priceLabel: '7.000fcfa le kg',
    timeline: '10-12 jours',
  },
  {
    id: 'container',
    name: 'Contener',
    priceLabel: '117.000fcfa /CBM',
    timeline: '1-2 mois',
  },
]

const ORDER_CHAT_NUMBER = (
  process.env.NEXT_PUBLIC_ORDER_CHAT_NUMBER ??
  process.env.VITE_ORDER_CHAT_NUMBER ??
  '221770000000'
)
  .toString()
  .replace(/\D/g, '')

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
    `Option transport: ${shippingOption.name} - ${shippingOption.priceLabel} (${shippingOption.timeline})`,
  )
  lines.push('Frais transport exacts: confirmes apres calcul du poids/volume.')
  lines.push('Vente au Senegal, sourcing import-export depuis la Chine.')
  lines.push('')
  lines.push(`Adresse: ${formState.line1}, ${formState.city}`)
  if (formState.line2.trim()) {
    lines.push(`Note cliente: ${formState.line2.trim()}`)
  }

  return lines.join('\n')
}

export const CartPage = () => {
  const { user } = useAuth()
  const { items, subtotal, removeFromCart, updateQuantity, clearCart } = useCart()

  const [formState, setFormState] = useState<CheckoutFormState>(
    initialCheckoutState,
  )
  const [selectedShippingId, setSelectedShippingId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const productsTotal = subtotal
  const selectedShippingOption = getShippingOptionById(selectedShippingId)
  const normalizedCustomerEmail = getFallbackEmail(formState.customerPhone)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!items.length) {
      setError('Le panier est vide.')
      return
    }

    const shippingOption = getShippingOptionById(selectedShippingId)
    if (!shippingOption) {
      setError('Choisissez une option de transport.')
      return
    }

    if (!ORDER_CHAT_NUMBER) {
      setError('Le numéro de confirmation n’est pas configuré.')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccessMessage(null)

      let orderNumber: string | null = null
      let orderStorageError = false

      if (isSupabaseConfigured) {
        try {
          const line2Parts = [
            formState.line2.trim(),
            `Transport: ${shippingOption.name} (${shippingOption.priceLabel}, ${shippingOption.timeline})`,
          ].filter(Boolean)

          const order = await createOrder({
            userId: user?.id ?? null,
            customerName: formState.customerName,
            customerEmail: normalizedCustomerEmail,
            customerPhone: formState.customerPhone,
            shippingAddress: {
              line1: formState.line1,
              line2: line2Parts.join(' | '),
              city: formState.city,
              postal_code: '00000',
              country: 'Senegal',
            },
            items,
          })

          orderNumber = order.order_number
        } catch (saveError) {
          orderStorageError = true
          console.error('Enregistrement de commande impossible', saveError)
        }
      }

      const orderMessage = buildOrderMessage(
        formState,
        items,
        subtotal,
        shippingOption,
        orderNumber,
      )

      clearCart()
      setFormState(initialCheckoutState)
      setSelectedShippingId('')
      setSuccessMessage(
        orderStorageError
          ? 'Commande envoyée. Une confirmation vous sera transmise.'
          : 'Commande prête. Redirection en cours...',
      )

      if (typeof window !== 'undefined') {
        window.location.assign(
          `https://wa.me/${ORDER_CHAT_NUMBER}?text=${encodeURIComponent(orderMessage)}`,
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
    <section className="section">
      <div className="container cart-layout">
        <div>
          <div className="section__header">
            <h1>Panier</h1>
            <Link href="/boutique">Continuer mes achats</Link>
          </div>

          {items.length === 0 ? (
            <div className="empty-state">
              <p>Votre panier est vide.</p>
              <Link className="button" href="/boutique">
                Découvrir la boutique
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
                    decoding="async"
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

        <aside className="checkout-card">
          <h2>Résumé</h2>
          <dl>
            <div>
              <dt>Sous-total</dt>
              <dd>{formatCurrency(subtotal)}</dd>
            </div>
            <div>
              <dt>Transport</dt>
              <dd>
                {selectedShippingOption
                  ? `${selectedShippingOption.name} (${selectedShippingOption.timeline})`
                  : 'A choisir'}
              </dd>
            </div>
            <div>
              <dt>Total produits</dt>
              <dd>{formatCurrency(productsTotal)}</dd>
            </div>
          </dl>
          <p className="shipping-note">
            Le tarif final du transport est confirmé apres verification du poids
            ou du volume.
          </p>

          <p className="checkout-card__lead">
            Remplissez ces 4 infos et validez. La commande part directement en confirmation.
          </p>

          <form className="checkout-form checkout-form--simple" onSubmit={handleSubmit}>
            <fieldset className="shipping-selector">
              <legend>Choix transport</legend>
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
                      onChange={(event) =>
                        setSelectedShippingId(event.target.value)
                      }
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
              <p className="shipping-note">
                L'activité est basee entre la Chine (sourcing) et le Senegal
                (vente locale).
              </p>
            </fieldset>

            <div className="checkout-customer-grid">
              <label>
                Nom complet
                <input
                  required
                  placeholder="Ex: Aissatou Ndiaye"
                  value={formState.customerName}
                  onChange={(event) =>
                    setFormState((state) => ({
                      ...state,
                      customerName: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Téléphone
                <input
                  required
                  placeholder="Ex: 77 000 00 00"
                  value={formState.customerPhone}
                  onChange={(event) =>
                    setFormState((state) => ({
                      ...state,
                      customerPhone: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <label>
              Quartier / Adresse
              <input
                required
                placeholder="Ex: Parcelles Assainies Unite 10"
                value={formState.line1}
                onChange={(event) =>
                  setFormState((state) => ({
                    ...state,
                    line1: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Ville
              <input
                required
                placeholder="Ex: Dakar"
                value={formState.city}
                onChange={(event) =>
                  setFormState((state) => ({
                    ...state,
                    city: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              Note (optionnel)
              <input
                placeholder="Ex: Disponible apres 17h"
                value={formState.line2}
                onChange={(event) =>
                  setFormState((state) => ({
                    ...state,
                    line2: event.target.value,
                  }))
                }
              />
            </label>

            {error ? <p className="error-text">{error}</p> : null}
            {successMessage ? <p className="success-text">{successMessage}</p> : null}

            <button
              className="button"
              type="submit"
              disabled={loading || items.length === 0}
            >
              {loading ? 'Validation...' : 'Finaliser la commande'}
            </button>
          </form>
        </aside>
      </div>
    </section>
  )
}
