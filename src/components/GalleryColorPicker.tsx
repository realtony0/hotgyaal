import type { GalleryColorsResponse } from '../services/galleryColors'
import { isLightHex } from '../utils/colors'

type GalleryColorPickerProps = {
  /** Photos de la fiche, dans l'ordre : chacune est un coloris */
  images: string[]
  data: GalleryColorsResponse | null
  loading: boolean
  activeIndex: number | null
  onSelect: (index: number) => void
  size?: 'sm' | 'md'
  /** Nombre maximum de pastilles (les autres sont comptees) */
  limit?: number
}

/*
 * Palette des coloris d'une fiche dont chaque photo montre une couleur.
 *
 * En mode "couleurs", chaque photo devient une pastille de sa teinte. En mode
 * "photos" (teintes trop proches pour des pastilles unies), ou si la mesure
 * a echoue, on montre des vignettes : le client choisit alors sur la photo.
 */
export const GalleryColorPicker = ({
  images,
  data,
  loading,
  activeIndex,
  onSelect,
  size = 'md',
  limit,
}: GalleryColorPickerProps) => {
  if (images.length < 2) {
    return null
  }

  const shown = typeof limit === 'number' ? images.slice(0, limit) : images
  const hidden = images.length - shown.length
  const asPhotos = !loading && (!data || data.mode === 'photos')

  const classNames = [
    'gallery-colors',
    size === 'sm' ? 'gallery-colors--sm' : '',
    asPhotos ? 'gallery-colors--photos' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classNames} role="group" aria-label="Coloris disponibles">
      {shown.map((url, index) => {
        if (loading) {
          return <span key={url} className="gallery-color gallery-color--loading" aria-hidden="true" />
        }

        const color = data?.colors[index]
        const isActive = index === activeIndex
        const label = color?.name
          ? `Coloris ${index + 1} : ${color.name}`
          : `Coloris ${index + 1}`

        if (asPhotos || !color?.hex) {
          return (
            <button
              key={url}
              type="button"
              className={isActive ? 'gallery-color gallery-color--photo is-active' : 'gallery-color gallery-color--photo'}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onSelect(index)
              }}
              title={label}
              aria-label={label}
              aria-pressed={isActive}
            >
              <img src={url} alt="" loading="lazy" decoding="async" />
            </button>
          )
        }

        return (
          <button
            key={url}
            type="button"
            className={[
              'gallery-color',
              isLightHex(color.hex) ? 'gallery-color--light' : '',
              isActive ? 'is-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ background: color.hex }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onSelect(index)
            }}
            title={label}
            aria-label={label}
            aria-pressed={isActive}
          />
        )
      })}
      {hidden > 0 ? <span className="gallery-colors__more">+{hidden}</span> : null}
    </div>
  )
}
