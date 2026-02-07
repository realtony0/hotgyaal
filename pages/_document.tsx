import { Head, Html, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="fr">
      <Head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/hotgyaal-icon.svg" />
        <meta name="theme-color" content="#111111" />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="HOTGYAAL" />
        <meta
          property="og:image"
          content="https://hotgyaal.com/products/chrysalide-nocturne-01.webp"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:image"
          content="https://hotgyaal.com/products/chrysalide-nocturne-01.webp"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
