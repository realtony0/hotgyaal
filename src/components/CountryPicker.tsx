import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  COUNTRIES,
  filterCountries,
  findCountryByCode,
  type Country,
} from '../constants/countries'

type CountryPickerProps = {
  value: string
  onChange: (nextCode: string) => void
  id?: string
}

export const CountryPicker = ({ value, onChange, id }: CountryPickerProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selected = useMemo<Country>(
    () => findCountryByCode(value) ?? COUNTRIES[0],
    [value],
  )

  const filtered = useMemo(() => filterCountries(query), [query])

  const open = () => {
    setIsOpen(true)
    setQuery('')
  }

  const close = () => {
    setIsOpen(false)
    setQuery('')
  }

  const handleSelect = (code: string) => {
    onChange(code)
    close()
  }

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        close()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  useLayoutEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      const selectedItem = listRef.current?.querySelector<HTMLLIElement>(
        '.country-picker__item.is-selected',
      )
      selectedItem?.scrollIntoView({ block: 'nearest' })
    }
  }, [isOpen])

  return (
    <div className="country-picker" ref={wrapperRef}>
      <button
        type="button"
        id={id}
        className="country-picker__trigger"
        onClick={() => (isOpen ? close() : open())}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="country-picker__flag">{selected.flag}</span>
        <span className="country-picker__dial">+{selected.dialCode}</span>
        <span className="country-picker__caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {isOpen ? (
        <div className="country-picker__panel" role="dialog">
          <input
            ref={inputRef}
            type="search"
            className="country-picker__search"
            placeholder="Rechercher un pays..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Rechercher un pays"
          />

          <ul ref={listRef} className="country-picker__list" role="listbox">
            {filtered.length === 0 ? (
              <li className="country-picker__empty">Aucun pays trouve</li>
            ) : (
              filtered.map((country) => {
                const isSelected = country.code === selected.code
                return (
                  <li
                    key={country.code}
                    className={
                      isSelected
                        ? 'country-picker__item is-selected'
                        : 'country-picker__item'
                    }
                    role="option"
                    aria-selected={isSelected}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(country.code)}
                    >
                      <span className="country-picker__flag">{country.flag}</span>
                      <span className="country-picker__name">{country.name}</span>
                      <span className="country-picker__item-dial">
                        +{country.dialCode}
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
