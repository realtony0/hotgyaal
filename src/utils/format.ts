const numberFormatter = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0,
})

export const formatCurrency = (value: number) =>
  `CFA${numberFormatter.format(value)} XOF`

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
