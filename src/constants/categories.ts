export type CategoryGroup = {
  slug: string
  name: string
  description: string
  subcategories: string[]
}

export const CATEGORY_TREE: CategoryGroup[] = [
  {
    slug: 'vetements-femmes',
    name: 'Vêtements Femmes',
    description: 'Silhouettes chic du quotidien au soir.',
    subcategories: [
      'Robes',
      'Tops',
      'T-shirts',
      'Pantalons',
      'Jupes',
      'Shorts',
      'Vestes',
      'Pulls',
      'Tenues de sport',
    ],
  },
  {
    slug: 'bijoux-accessoires',
    name: 'Bijoux & Accessoires',
    description: 'Touches premium qui signent un look.',
    subcategories: [
      'Colliers',
      'Bracelets',
      'Boucles d’oreilles',
      'Bagues',
      'Montres',
      'Chapeaux',
      'Écharpes',
      'Ceintures',
      'Lunettes',
      'Sacs',
    ],
  },
  {
    slug: 'chaussures',
    name: 'Chaussures',
    description: 'Du confort sport aux pièces statement.',
    subcategories: [
      'Baskets',
      'Bottes',
      'Sandales & Crocs',
      'Talons',
      'Plates',
      'Sport',
      'Mocassins',
      'Intérieur',
      'Enfants',
    ],
  },
  {
    slug: 'telephone-accessoires',
    name: 'Téléphone & Accessoires',
    description: 'Style et utilité pour vos appareils.',
    subcategories: [
      'iPad',
      'Coques',
      'Chargeurs',
      'Écouteurs',
      'Supports',
      'Power banks',
      'Protections écran',
    ],
  },
  {
    slug: 'sacs-bagages',
    name: 'Sacs & Bagages',
    description: 'Capsules pratiques pour ville et voyage.',
    subcategories: [
      'Sacs à main',
      'Sacs à dos',
      'Valises',
      'Voyage',
      'Sport',
      'Bandoulière',
      'Trousse',
      'Ordinateur',
    ],
  },
  {
    slug: 'sous-vetements-pyjamas',
    name: 'Sous-vêtements & Pyjamas',
    description: 'Confort premium, coupe et douceur.',
    subcategories: ['Femme', 'Enfant', 'Lingerie', 'Nuisettes'],
  },
  {
    slug: 'home-living',
    name: 'Home & Living',
    description: 'Un intérieur raffiné et vivant.',
    subcategories: [
      'Décoration murale',
      'Textiles',
      'Mobilier',
      'Luminaires',
      'Cuisine',
      'Salle de bain',
      'Objets déco',
      'Rangement',
      'Plantes',
    ],
  },
  {
    slug: 'beaute',
    name: 'Beauté',
    description: 'Soins, maquillage et essentials premium.',
    subcategories: [
      'Maquillage',
      'Soins visage',
      'Soins corps',
      'Cheveux',
      'Parfums',
      'Accessoires beauté',
    ],
  },
]

export const MAIN_CATEGORY_NAMES = CATEGORY_TREE.map((category) => category.name)

export const getSubcategoriesByMainCategory = (mainCategory: string): string[] => {
  const category = CATEGORY_TREE.find((entry) => entry.name === mainCategory)
  return category?.subcategories ?? []
}
