import { getSiteUrl } from './site'

const withLeadingSlash = (path: string) => (path.startsWith('/') ? path : `/${path}`)

const removeTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const resolveBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.origin) {
    return removeTrailingSlash(window.location.origin)
  }

  return getSiteUrl()
}

export const buildShareUrl = (path: string) => `${resolveBaseUrl()}${withLeadingSlash(path)}`

type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed'

/**
 * Copie un texte dans le presse-papiers.
 *
 * `navigator.clipboard` exige une page servie en HTTPS et n'existe pas sur
 * tous les navigateurs mobiles : on retombe alors sur un champ temporaire et
 * `execCommand`, qui reste la methode la plus largement supportee.
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // on tente la methode de repli ci-dessous
    }
  }

  if (typeof document === 'undefined') {
    return false
  }

  try {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    // hors ecran : le champ ne doit ni s'afficher ni faire defiler la page
    field.style.position = 'fixed'
    field.style.top = '-1000px'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.select()
    field.setSelectionRange(0, text.length)
    const copied = document.execCommand('copy')
    document.body.removeChild(field)
    return copied
  } catch {
    return false
  }
}

/** Lien d'envoi WhatsApp, sans destinataire : l'expediteur choisit son contact. */
export const buildWhatsAppShareUrl = (text: string, url: string) =>
  `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`

/** Vrai si l'appareil propose son propre menu de partage (surtout sur mobile). */
export const canUseNativeShare = () =>
  typeof navigator !== 'undefined' &&
  typeof (navigator as ShareCapableNavigator).share === 'function'

type ShareCapableNavigator = Navigator & {
  share?: (data: ShareData) => Promise<void>
}

export const shareWithFallback = async (data: ShareData): Promise<ShareResult> => {
  if (typeof navigator === 'undefined') {
    return 'failed'
  }

  const nativeNavigator = navigator as ShareCapableNavigator

  if (typeof nativeNavigator.share === 'function') {
    try {
      await nativeNavigator.share(data)
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled'
      }
    }
  }

  return 'failed'
}
