import type { Product } from '../types'
import { resolveSwatchColor } from '../utils/colors'
import { getProductVariantMeta } from '../utils/products'

type ColorSwatchesProps = {
  variants: Product[]
  activeId: string
  onSelect: (variant: Product) => void
  /** Pastilles plus grandes, avec le nom du coloris affiche a cote */
  size?: 'sm' | 'md'
  /** Nombre maximum de pastilles affichees (les autres sont comptees) */
  limit?: number
}

/*
 * Palette de coloris d'un produit : une pastille par declinaison.
 * Cliquer une pastille affiche la photo et la fiche de cette couleur.
 */
export const ColorSwatches = ({
  variants,
  activeId,
  onSelect,
  size = 'sm',
  limit,
}: ColorSwatchesProps) => {
  if (variants.length < 2) {
    return null
  }

  const shown = typeof limit === 'number' ? variants.slice(0, limit) : variants
  const hidden = variants.length - shown.length

  return (
    <div
      className={size === 'md' ? 'color-swatches color-swatches--md' : 'color-swatches'}
      role="group"
      aria-label="Coloris disponibles"
    >
      {shown.map((variant) => {
        const { color } = getProductVariantMeta(variant)
        const label = color || 'Standard'
        const swatch = resolveSwatchColor(color)
        const isActive = variant.id === activeId

        const className = [
          'color-swatch',
          isActive ? 'is-active' : '',
          swatch?.value === 'multi' ? 'color-swatch--multi' : '',
          swatch?.light ? 'color-swatch--light' : '',
          !swatch ? 'color-swatch--unknown' : '',
          variant.is_out_of_stock ? 'color-swatch--out' : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <button
            key={variant.id}
            type="button"
            className={className}
            style={swatch && swatch.value !== 'multi' ? { background: swatch.value } : undefined}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onSelect(variant)
            }}
            title={label}
            aria-label={`Coloris ${label}`}
            aria-pressed={isActive}
          >
            {!swatch ? <span aria-hidden="true">{label.slice(0, 1)}</span> : null}
          </button>
        )
      })}
      {hidden > 0 ? <span className="color-swatches__more">+{hidden}</span> : null}
    </div>
  )
}
