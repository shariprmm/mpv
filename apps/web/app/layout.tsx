// apps/web/app/layout.tsx
import SiteHeader from "@/components/SiteHeader";
import SeoJsonLd from "@/components/SeoJsonLd";
import { SiteFooter } from "@/components/SiteFooter";
import { RegionProvider } from "@/context/RegionContext";
import { SITE_NAME, SITE_URL, absUrl, jsonLdOrganization, jsonLdWebSite } from "@/lib/seo";
import styles from "./layout.module.css";
import "./globals.css";

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://api.moydompro.ru";

async function apiGet(path: string) {
  try {
    const url = `${API_BASE}`.replace(/\/$/, "") + path;
    const r = await fetch(url, { next: { revalidate: 60 } });
    if (!r.ok) return null;
    return await r.json();
  } catch (error) {
    return null;
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Загружаем данные из вашего обновленного index.js
  const [regionsData, prodCatsData, servCatsData] = await Promise.all([
    apiGet("/public/regions"),
    apiGet("/public/product-categories"),
    apiGet("/public/service-categories"),
  ]);

  const regions = Array.isArray(regionsData?.items) ? regionsData.items : [];
  const productCats = Array.isArray(prodCatsData?.items) ? prodCatsData.items : [];
  const serviceCats = Array.isArray(servCatsData?.items) ? servCatsData.items : [];

  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `(function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=106687922', 'ym');

ym(106687922, 'init', {ssr:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});`,
          }}
        />
        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-5353J9FX');`,
          }}
        />
        {/* End Google Tag Manager */}
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-6H00X5416S" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());

gtag('config', 'G-6H00X5416S');`,
          }}
        />
      </head>

      <body className={styles.body}>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-5353J9FX"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        <noscript>
          <div>
            <img
              src="https://mc.yandex.ru/watch/106687922"
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>
        <SeoJsonLd
          data={{
            "@context": "https://schema.org",
            "@graph": [
              jsonLdOrganization({
                name: SITE_NAME,
                url: SITE_URL,
                logoUrl: absUrl("/images/og-default.png"),
              }),
              jsonLdWebSite({
                name: SITE_NAME,
                url: SITE_URL,
                searchTarget: `${SITE_URL}/search?q={search_term_string}`,
              }),
            ],
          }}
        />
        <RegionProvider initialRegions={regions}>
          <SiteHeader regions={regions} />

          {/* flex-grow: 1 растягивает контент, прижимая футер к низу */}
          <main className={styles.main}>{children}</main>

          <SiteFooter productCats={productCats} serviceCats={serviceCats} />
        </RegionProvider>
      </body>
    </html>
  );
}
