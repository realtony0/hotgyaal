export type QuickCategoryLink = {
  label: string
  icon: string
  href: string
}

export const QUICK_CATEGORY_LINKS: QuickCategoryLink[] = [
  {
    label: 'Nouveautes',
    icon: '🔥',
    href: '/boutique?q=nouveau',
  },
  {
    label: 'Robes',
    icon: '👗',
    href: '/boutique?q=robe',
  },
  {
    label: 'Ensembles',
    icon: '✨',
    href: '/boutique?q=ensemble',
  },
  {
    label: 'Sacs',
    icon: '👜',
    href: '/boutique?categorie=Sacs%20%26%20Bagages',
  },
  {
    label: 'Chaussures',
    icon: '👠',
    href: '/boutique?categorie=Chaussures',
  },
  {
    label: 'Bijoux',
    icon: '💎',
    href: '/boutique?categorie=Bijoux%20%26%20Accessoires',
  },
]
