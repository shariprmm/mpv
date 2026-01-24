import type { Metadata } from "next";
import { SITE_NAME, absUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${SITE_NAME} — услуги и товары для дома`,
  description: "Каталог услуг, товаров и компаний для загородного дома по регионам.",
  alternates: { canonical: absUrl("/") },
  openGraph: {
    title: `${SITE_NAME} — услуги и товары для дома`,
    description: "Каталог услуг, товаров и компаний для загородного дома по регионам.",
    url: absUrl("/"),
    siteName: SITE_NAME,
    type: "website",
    locale: "ru_RU",
    images: [absUrl("/images/og-default.png")],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — услуги и товары для дома`,
    description: "Каталог услуг, товаров и компаний для загородного дома по регионам.",
    images: [absUrl("/images/og-default.png")],
  },
};

async function getHome(region_slug: string) {
  // ВАЖНО:
  // - API_BASE_URL: для server-side внутри docker (http://api:8080)
  // - NEXT_PUBLIC_API_BASE_URL: для клиента/браузера (https://api.moydompro.ru)
  const API =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://api:8080";

  const url = `${API}/home?region_slug=${encodeURIComponent(region_slug)}`;

  const r = await fetch(url, { cache: "no-store" });
  const text = await r.text();

  let data: any = null;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!r.ok) {
    const msg = data?.error || data?.message || `HTTP ${r.status}`;
    throw new Error(`${msg} @ ${url}`);
  }

  return data;
}

function money(v: any) {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("ru-RU").format(Number(v)) + " ₽";
}

export default async function Page({ searchParams }: { searchParams?: { region?: string } }) {
  const region_slug = searchParams?.region || "sankt-peterburg";

  let data: any = null;
  let err: string | null = null;

  try {
    data = await getHome(region_slug);
  } catch (e: any) {
    err = e?.message || String(e);
  }

  if (err) {
    return (
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 28 }}>MoyDomPro</h1>
        <p style={{ opacity: 0.8 }}>Главная временно не загрузилась.</p>
        <pre style={{ whiteSpace: "pre-wrap", padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
{err}
        </pre>
        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <a href="/" style={{ textDecoration: "none" }}><button>Обновить</button></a>
          <a href="https://admin.moydompro.ru/login" style={{ textDecoration: "none" }}><button>Вход для компаний</button></a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>{data?.seo?.h1 || "MoyDomPro"}</h1>
      <p style={{ opacity: 0.8, marginTop: 0 }}>
        Регион: <b>{data.region?.name}</b>
      </p>

      <section style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: 16, border: "1px solid #eee", borderRadius: 12, marginTop: 16 }}>
        <a href={`/?region=${encodeURIComponent(data.region?.slug || region_slug)}`} style={{ textDecoration: "none" }}>
          <button>Обновить</button>
        </a>
        <a href="https://admin.moydompro.ru/login" style={{ textDecoration: "none" }}>
          <button>Вход для компаний</button>
        </a>
      </section>

      <h2 style={{ fontSize: 22, marginTop: 28 }}>Популярные услуги</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
        {(data.top_services || []).map((s: any) => (
          <div key={s.slug} style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 700 }}>{s.name}</div>
            <div style={{ opacity: 0.85, marginTop: 6 }}>
              от <b>{money(s.price_min)}</b> до <b>{money(s.price_max)}</b>
            </div>
            <div style={{ opacity: 0.7, marginTop: 6 }}>{s.companies_count} компаний</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 22, marginTop: 28 }}>Рекомендуемые компании</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
        {(data.featured_companies || []).map((c: any) => (
          <div key={c.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 700 }}>{c.name}</div>
              {c.is_verified ? <span style={{ fontSize: 12, padding: "2px 8px", border: "1px solid #ddd", borderRadius: 999 }}>Проверенная</span> : null}
            </div>
            <div style={{ opacity: 0.8, marginTop: 6 }}>
              ⭐ {c.rating ?? "—"} ({c.reviews_count ?? 0})
            </div>
            <div style={{ opacity: 0.85, marginTop: 6 }}>
              Цены: от <b>{money(c.price_min)}</b> до <b>{money(c.price_max)}</b>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {(c.service_tags || []).slice(0, 5).map((t: any) => (
                <span key={t.slug} style={{ fontSize: 12, padding: "2px 8px", background: "#f6f6f6", borderRadius: 999 }}>
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 22, marginTop: 28 }}>Лучшие предложения</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
        {(data.best_deals || []).map((d: any) => (
          <div key={d.slug} style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 700 }}>{d.name}</div>
            <div style={{ opacity: 0.85, marginTop: 6 }}>от <b>{money(d.price_from)}</b></div>
          </div>
        ))}
      </div>
    </main>
  );
}
