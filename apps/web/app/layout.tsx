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
      </head>

      <body className={styles.body}>
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
