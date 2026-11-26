/*
 * Reseaux sociaux de la boutique.
 *
 * L'adresse Instagram peut etre changee sans toucher au code avec la variable
 * NEXT_PUBLIC_INSTAGRAM_URL dans Vercel (puis redeploiement).
 */
export const INSTAGRAM_URL =
  process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim() || 'https://www.instagram.com/hotgyaal/'
