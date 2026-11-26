import type { Dispatch, SetStateAction } from 'react'
import { fetchGalleryColors } from '../../services/galleryColors'
import type { Product } from '../../types'
import { readColorTag, stripColorTag, writeColorTag, type ColorDisplay } from '../../utils/colorTag'
import { isLightHex, nameForHex } from '../../utils/colors'
import { detectColorFromFile } from '../../utils/detectColor'

/*
 * Gestion des coloris d'une fiche dans l'administration.
 *
 * Une photo = un coloris. Pour chacun, la teinte est detectee
 * automatiquement ; la boutique peut la corriger, donner un nom, changer
 * l'ordre (la premiere photo est la photo principale) ou retirer la photo.
 */

export type ColorEntry = {
  key: string
  /** Adresse de la photo en ligne, ou apercu local d'un fichier a envoyer */
  src: string
  /** Fichier a envoyer a l'enregistrement (photo ajoutee) */
  file?: File
  /** Nom saisi ; vide = nom devine a partir de la teinte */
  name: string
  /** Teinte fixee a la main */
  hex: string | null
  /** Teinte detectee sur la photo */
  autoHex: string | null
  detecting: boolean
}

export type DisplayChoice = 'auto' | ColorDisplay

type ColorGalleryEditorProps = {
  entries: ColorEntry[]
  setEntries: Dispatch<SetStateAction<ColorEntry[]>>
  display: DisplayChoice
  onDisplayChange: (display: DisplayChoice) => void
  /**
   * "coloris" : chaque photo est un coloris (cas general).
   * "photos" : fiche deja limitee a une couleur ("Top Azur - Noir"), ses
   * photos sont des vues de cette couleur.
   */
  kind: 'coloris' | 'photos'
  disabled?: boolean
}

const createKey = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

/** Coloris d'une fiche existante, avec les teintes deja connues. */
export const entriesFromProduct = (product: Product): ColorEntry[] =>
  Array.from(
    new Set([product.image_url, ...(product.gallery_urls ?? [])].filter(Boolean) as string[]),
  ).map((url) => {
    const tag = readColorTag(url)
    return {
      key: createKey(),
      src: stripColorTag(url),
      name: tag.name ?? '',
      hex: tag.hex ?? null,
      autoHex: null,
      detecting: !tag.hex,
    }
  })

export const displayFromProduct = (product: Product): DisplayChoice =>
  (product.image_url ? readColorTag(product.image_url).display : undefined) ?? 'auto'

/*
 * Complete les teintes manquantes d'une fiche existante avec celles mesurees
 * par le serveur (deja en cache pour les fiches publiees).
 */
export const loadMeasuredColors = async (
  product: Product,
  setEntries: Dispatch<SetStateAction<ColorEntry[]>>,
) => {
  const response = await fetchGalleryColors(product.id, product.updated_at)
  const measured = new Map(
    (response?.colors ?? []).map((color) => [stripColorTag(color.url), color.hex]),
  )

  setEntries((current) =>
    current.map((entry) =>
      entry.file
        ? entry
        : { ...entry, autoHex: measured.get(entry.src) ?? entry.autoHex, detecting: false },
    ),
  )
}

/** Adresses a enregistrer, dans l'ordre, avec nom et teinte de chaque coloris. */
export const serializeEntries = (
  entries: ColorEntry[],
  uploadedUrls: string[],
  display: DisplayChoice,
  kind: 'coloris' | 'photos',
) =>
  entries.map((entry, index) => {
    const url = uploadedUrls[index]
    if (kind === 'photos') {
      return stripColorTag(url)
    }

    return writeColorTag(url, {
      name: entry.name,
      hex: entry.hex ?? entry.autoHex ?? undefined,
      display: index === 0 && display !== 'auto' ? display : undefined,
    })
  })

export const releaseEntries = (entries: ColorEntry[]) => {
  entries.forEach((entry) => {
    if (entry.file) URL.revokeObjectURL(entry.src)
  })
}

export const ColorGalleryEditor = ({
  entries,
  setEntries,
  display,
  onDisplayChange,
  kind,
  disabled = false,
}: ColorGalleryEditorProps) => {
  const isColors = kind === 'coloris'

  const addFiles = (files: File[]) => {
    const added = files.map<ColorEntry>((file) => ({
      key: createKey(),
      src: URL.createObjectURL(file),
      file,
      name: '',
      hex: null,
      autoHex: null,
      detecting: isColors,
    }))

    setEntries((current) => [...current, ...added])

    if (!isColors) {
      return
    }

    added.forEach((entry) => {
      void detectColorFromFile(entry.file as File).then((hex) => {
        setEntries((current) =>
          current.map((item) =>
            item.key === entry.key ? { ...item, autoHex: hex, detecting: false } : item,
          ),
        )
      })
    })
  }

  const update = (key: string, patch: Partial<ColorEntry>) =>
    setEntries((current) =>
      current.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry)),
    )

  const move = (index: number, offset: -1 | 1) =>
    setEntries((current) => {
      const target = index + offset
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const remove = (key: string) =>
    setEntries((current) => {
      const entry = current.find((item) => item.key === key)
      if (entry?.file) URL.revokeObjectURL(entry.src)
      return current.filter((item) => item.key !== key)
    })

  return (
    <div className="admin-colors full-width">
      <div className="admin-colors__head">
        <div>
          <h3>{isColors ? `Coloris (${entries.length})` : `Photos (${entries.length})`}</h3>
          <p className="admin-help">
            {isColors
              ? 'Une photo par coloris. La teinte est détectée toute seule : cliquez sur la pastille pour la corriger, et donnez un nom si vous voulez. La première photo est la photo principale.'
              : 'Photos de cette couleur. La première est la photo principale.'}
          </p>
        </div>

        {isColors ? (
          <label className="admin-colors__display">
            Affichage sur le site
            <select
              value={display}
              onChange={(event) => onDisplayChange(event.target.value as DisplayChoice)}
              disabled={disabled}
            >
              <option value="auto">Automatique</option>
              <option value="pastilles">Pastilles de couleur</option>
              <option value="photos">Vignettes photo</option>
            </select>
          </label>
        ) : null}
      </div>

      {entries.length ? (
        <ol className="admin-colors__list">
          {entries.map((entry, index) => {
            const swatch = entry.hex ?? entry.autoHex
            const guessedName = swatch ? nameForHex(swatch) : null

            return (
              <li key={entry.key} className="admin-colors__item">
                <div className="admin-colors__photo">
                  <img src={entry.src} alt={`Coloris ${index + 1}`} loading="lazy" />
                  <span className="admin-colors__badge">
                    {index === 0 ? 'Principale' : index + 1}
                  </span>
                  {entry.file ? <span className="admin-colors__new">Nouvelle</span> : null}
                </div>

                {isColors ? (
                  <div className="admin-colors__fields">
                    <span
                      className={[
                        'admin-colors__swatch',
                        swatch && isLightHex(swatch) ? 'is-light' : '',
                        entry.detecting ? 'is-loading' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={swatch ? { background: swatch } : undefined}
                      title="Changer la teinte"
                    >
                      <input
                        type="color"
                        aria-label={`Teinte du coloris ${index + 1}`}
                        value={swatch ?? '#cccccc'}
                        onChange={(event) => update(entry.key, { hex: event.target.value })}
                        disabled={disabled}
                      />
                    </span>
                    <input
                      className="admin-colors__name"
                      value={entry.name}
                      placeholder={
                        entry.detecting ? 'Détection…' : (guessedName ?? 'Nom du coloris')
                      }
                      aria-label={`Nom du coloris ${index + 1}`}
                      onChange={(event) => update(entry.key, { name: event.target.value })}
                      disabled={disabled}
                    />
                  </div>
                ) : null}

                <div className="admin-colors__actions">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={disabled || index === 0}
                    aria-label="Avancer"
                    title="Avancer"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={disabled || index === entries.length - 1}
                    aria-label="Reculer"
                    title="Reculer"
                  >
                    →
                  </button>
                  {isColors && entry.hex ? (
                    <button
                      type="button"
                      onClick={() => update(entry.key, { hex: null })}
                      disabled={disabled}
                      title="Revenir à la teinte détectée"
                    >
                      Auto
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="danger"
                    onClick={() => remove(entry.key)}
                    disabled={disabled}
                    aria-label="Retirer la photo"
                    title="Retirer"
                  >
                    ✕
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="admin-colors__empty">Aucune photo pour l&apos;instant.</p>
      )}

      <label className="admin-colors__add">
        {isColors ? '+ Ajouter des coloris (photos)' : '+ Ajouter des photos'}
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={disabled}
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []))
            event.target.value = ''
          }}
        />
      </label>
    </div>
  )
}
