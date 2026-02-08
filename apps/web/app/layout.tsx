// apps/web/app/layout.tsx
import Script from "next/script";

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
  } catch {
    return null;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
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
      </head>

      <body className={styles.body}>
        {/* Yandex Metrika */}
        <Script
          id="yandex-metrika"
          strategy="afterInteractive"
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

        {/* Google tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-6H00X5416S"
          strategy="afterInteractive"
        />
        <Script
          id="gtag-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-6H00X5416S');`,
          }}
        />

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
                logoUrl: absUrl("/images/og-default.webp"),
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
          <main className={styles.main}>{children}</main>
          <SiteFooter productCats={productCats} serviceCats={serviceCats} />
        </RegionProvider>
      </body>
    </html>
  );
}
