import Head from 'next/head'

export default function Custom404() {
  return (
    <>
      <Head>
        <title>404 | HOTGYAAL</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <section className="section">
        <div className="container">
          <h1>Page introuvable</h1>
        </div>
      </section>
    </>
  )
}
