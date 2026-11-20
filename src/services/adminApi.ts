/*
 * Appels aux routes d'administration cote serveur.
 *
 * Le navigateur n'ecrit plus directement en base : il passe par /api/admin/*,
 * qui verifie le cookie de session admin et agit avec la cle service_role. Le
 * cookie part automatiquement (meme origine), d'ou `credentials: 'same-origin'`.
 */

export const adminFetch = async <T>(
  url: string,
  init: RequestInit = {},
): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  if (response.status === 401) {
    throw new Error("Session administrateur expirée. Reconnectez-vous.")
  }

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null

  if (!response.ok) {
    throw new Error(payload?.error || "L'opération a échoué.")
  }

  return payload as T
}
