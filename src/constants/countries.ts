export type Country = {
  code: string
  name: string
  dialCode: string
  flag: string
}

export const COUNTRIES: Country[] = [
  { code: 'SN', name: 'Senegal', dialCode: '221', flag: '🇸🇳' },
  { code: 'CI', name: "Cote d'Ivoire", dialCode: '225', flag: '🇨🇮' },
  { code: 'ML', name: 'Mali', dialCode: '223', flag: '🇲🇱' },
  { code: 'GN', name: 'Guinee', dialCode: '224', flag: '🇬🇳' },
  { code: 'BF', name: 'Burkina Faso', dialCode: '226', flag: '🇧🇫' },
  { code: 'MR', name: 'Mauritanie', dialCode: '222', flag: '🇲🇷' },
  { code: 'GM', name: 'Gambie', dialCode: '220', flag: '🇬🇲' },
  { code: 'GW', name: 'Guinee-Bissau', dialCode: '245', flag: '🇬🇼' },
  { code: 'TG', name: 'Togo', dialCode: '228', flag: '🇹🇬' },
  { code: 'BJ', name: 'Benin', dialCode: '229', flag: '🇧🇯' },
  { code: 'NE', name: 'Niger', dialCode: '227', flag: '🇳🇪' },
  { code: 'CM', name: 'Cameroun', dialCode: '237', flag: '🇨🇲' },
  { code: 'GA', name: 'Gabon', dialCode: '241', flag: '🇬🇦' },
  { code: 'CG', name: 'Congo', dialCode: '242', flag: '🇨🇬' },
  { code: 'CD', name: 'RD Congo', dialCode: '243', flag: '🇨🇩' },
  { code: 'TD', name: 'Tchad', dialCode: '235', flag: '🇹🇩' },
  { code: 'MA', name: 'Maroc', dialCode: '212', flag: '🇲🇦' },
  { code: 'DZ', name: 'Algerie', dialCode: '213', flag: '🇩🇿' },
  { code: 'TN', name: 'Tunisie', dialCode: '216', flag: '🇹🇳' },
  { code: 'EG', name: 'Egypte', dialCode: '20', flag: '🇪🇬' },
  { code: 'NG', name: 'Nigeria', dialCode: '234', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana', dialCode: '233', flag: '🇬🇭' },
  { code: 'KE', name: 'Kenya', dialCode: '254', flag: '🇰🇪' },
  { code: 'ZA', name: 'Afrique du Sud', dialCode: '27', flag: '🇿🇦' },
  { code: 'FR', name: 'France', dialCode: '33', flag: '🇫🇷' },
  { code: 'BE', name: 'Belgique', dialCode: '32', flag: '🇧🇪' },
  { code: 'CH', name: 'Suisse', dialCode: '41', flag: '🇨🇭' },
  { code: 'CA', name: 'Canada', dialCode: '1', flag: '🇨🇦' },
  { code: 'US', name: 'Etats-Unis', dialCode: '1', flag: '🇺🇸' },
  { code: 'GB', name: 'Royaume-Uni', dialCode: '44', flag: '🇬🇧' },
  { code: 'ES', name: 'Espagne', dialCode: '34', flag: '🇪🇸' },
  { code: 'IT', name: 'Italie', dialCode: '39', flag: '🇮🇹' },
  { code: 'DE', name: 'Allemagne', dialCode: '49', flag: '🇩🇪' },
  { code: 'PT', name: 'Portugal', dialCode: '351', flag: '🇵🇹' },
  { code: 'CN', name: 'Chine', dialCode: '86', flag: '🇨🇳' },
  { code: 'IN', name: 'Inde', dialCode: '91', flag: '🇮🇳' },
  { code: 'AE', name: 'Emirats', dialCode: '971', flag: '🇦🇪' },
  { code: 'SA', name: 'Arabie Saoudite', dialCode: '966', flag: '🇸🇦' },
  { code: 'TR', name: 'Turquie', dialCode: '90', flag: '🇹🇷' },
  { code: 'BR', name: 'Bresil', dialCode: '55', flag: '🇧🇷' },
]

export const DEFAULT_COUNTRY_CODE = 'SN'

export const findCountryByCode = (code: string): Country | undefined =>
  COUNTRIES.find((country) => country.code === code)

export const findCountryByDialCode = (dial: string): Country | undefined => {
  const digits = dial.replace(/\D/g, '')
  return [...COUNTRIES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((country) => digits.startsWith(country.dialCode))
}
