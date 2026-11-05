import Link from 'next/link'
import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description: string
  action?: {
    label: string
    href: string
  }
  children?: ReactNode
}

/*
 * Bloc affiche quand une grille n'a rien a montrer.
 * Une boutique qui demarre, une recherche sans resultat ou un filtre trop
 * etroit ne doivent pas se traduire par une phrase seule au milieu de la page :
 * on garde une mise en forme, on explique, et on propose une suite.
 */
export const EmptyState = ({ title, description, action, children }: EmptyStateProps) => (
  <div className="empty-block">
    <span className="empty-block__mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" strokeLinejoin="round" />
        <path d="m4 8.5 8 4.5 8-4.5M12 13v7" strokeLinejoin="round" />
      </svg>
    </span>
    <h3>{title}</h3>
    <p>{description}</p>
    {action ? (
      <Link className="button" href={action.href}>
        {action.label}
      </Link>
    ) : null}
    {children}
  </div>
)
