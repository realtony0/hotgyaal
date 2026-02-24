const DEFAULT_SITE_URL = 'https://hotgyaal.com'

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i

const withLeadingSlash = (path: string) => (path.startsWith('/') ? path : `/${path}`)

const removeTrailingSlash = (value: string) => value.replace(/\/+$/, '')

export const stripQueryAndHash = (path: string) => path.split('#')[0].split('?')[0] || '/'

export const getSiteUrl = () =>
  removeTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL)

export const toAbsoluteUrl = (pathOrUrl: string) => {
  if (ABSOLUTE_URL_PATTERN.test(pathOrUrl)) {
    return pathOrUrl
  }

  return `${getSiteUrl()}${withLeadingSlash(pathOrUrl)}`
}
