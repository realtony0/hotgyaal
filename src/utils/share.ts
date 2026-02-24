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

  if (data.url && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(data.url)
      return 'copied'
    } catch {
      return 'failed'
    }
  }

  return 'failed'
}
