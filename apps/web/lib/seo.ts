// apps/web/lib/seo.ts
import type { Metadata } from "next";
import { capitalizeFirst } from "./text";

export const SITE_NAME = "МойДомПро";
export const SITE_URL = "https://moydompro.ru";

type RegionLike = {
  slug?: string | null;
  name?: string | null;
};

export type PriceInfo = {
  priceMin: number | null;
  priceMax: number | null;
  currency?: string; // "RUB"
};

export function absUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${p}`;
}

/**
 * Stable hash (FNV-1a 32-bit)
 */
export function hashKey(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function pickVariant<T>(key: string, variants: T[]): T {
  const idx = variants.length ? hashKey(key) % variants.length : 0;
  return variants[idx];
}

export function fmtRUB(n: number) {
  try {
    return new Intl.NumberFormat("ru-RU").format(Math.round(n));
  } catch {
    return String(Math.round(n));
  }
}

export function buildPriceRange(p: PriceInfo) {
  const cur = p.currency || "RUB";
  const sym = cur === "RUB" ? "₽" : cur;
  const min = p.priceMin;
  const max = p.priceMax;

  if (min == null && max == null) return "Цена уточняется";
  if (min != null && (max == null || max === min)) return `от ${fmtRUB(min)} ${sym}`;
  if (min == null && max != null) return `до ${fmtRUB(max)} ${sym}`;
  return `от ${fmtRUB(min!)} до ${fmtRUB(max!)} ${sym}`;
}

export function computeMinMaxFromCompanies(companies: any[]): PriceInfo {
  const numsMin: number[] = [];
  const numsMax: number[] = [];

  for (const c of companies || []) {
    const mn = c?.price_min;
    const mx = c?.price_max;
    const mnN = typeof mn === "number" ? mn : mn != null ? Number(mn) : NaN;
    const mxN = typeof mx === "number" ? mx : mx != null ? Number(mx) : NaN;

    if (Number.isFinite(mnN)) numsMin.push(mnN);
    if (Number.isFinite(mxN)) numsMax.push(mxN);
    else if (Number.isFinite(mnN)) numsMax.push(mnN);
  }

  const priceMin = numsMin.length ? Math.min(...numsMin) : null;
  const priceMax = numsMax.length ? Math.max(...numsMax) : null;
  return { priceMin, priceMax, currency: "RUB" };
}

/* =========================
   RUSSIAN CITY CASE HELPERS
========================= */

function normSpaces(s: string) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function isCyrillicText(s: string) {
  return /[А-Яа-яЁё]/.test(String(s || ""));
}

// склоняем ОДНО слово в предложный падеж (без "в ")
function toPrepositionalWord(word: string): string {
  const w = normSpaces(word);
  if (!w) return w;

  // Не склоняем "Сочи", "Улан-Удэ" и похожие (на гласную кроме а/я)
  if (/[оeёеиыую]$/i.test(w)) return w;

  // -ово/-ево/-ино/-ыно обычно не меняются: Домодедово, Иваново...
  if (/(ово|ево|ино|ыно)$/i.test(w)) return w;

  // -ь => -и (Тверь -> Твери)
  if (/ь$/i.test(w)) return w.slice(0, -1) + "и";

  // -а/-я => -е
  if (/а$/i.test(w)) return w.slice(0, -1) + "е";
  if (/я$/i.test(w)) return w.slice(0, -1) + "е";

  // -й => -е
  if (/й$/i.test(w)) return w.slice(0, -1) + "е";

  // -ск => +е (Томск -> Томске)
  if (/ск$/i.test(w)) return w + "е";

  // общий случай: согласная => +е (Арзамас -> Арзамасе)
  if (/[бвгджзйклмнпрстфхцчшщ]$/i.test(w)) return w + "е";

  return w;
}

// склоняем фразу-город (может быть с пробелами/дефисами) в предложный
export function cityToPrepositional(cityName: string, slug?: string | null): string {
  const name = normSpaces(cityName);
  const sl = String(slug || "").trim().toLowerCase();

  // точечные исключения (самые частые/сложные)
  const EX: Record<string, string> = {
    moskva: "Москве",
    "sankt-peterburg": "Санкт-Петербурге",
    spb: "Санкт-Петербурге",
    "rostov-na-donu": "Ростове-на-Дону",
    "nizhniy-novgorod": "Нижнем Новгороде",
    "velikiy-novgorod": "Великом Новгороде",
    "naberzhnye-chelny": "Набережных Челнах",
    "nizhniy-tagil": "Нижнем Тагиле",
    "novyy-urengoy": "Новом Уренгое",
    "yoshkar-ola": "Йошкар-Оле",
    "khanty-mansiysk": "Ханты-Мансийске",
    "komsomolsk-na-amure": "Комсомольске-на-Амуре",
    "staryy-oskol": "Старом Осколе",
    "yuzhno-sakhalinsk": "Южно-Сахалинске",
    "petropavlovsk-kamchatskiy": "Петропавловске-Камчатском",
    sochi: "Сочи",
    "ulan-ude": "Улан-Удэ",
  };
  if (sl && EX[sl]) return EX[sl];

  // если не кириллица — не сможем нормально склонять
  if (!isCyrillicText(name)) return name || "вашем городе";

  // дефисы
  if (name.includes("-")) {
    const tokens = name.split("-").map((t) => normSpaces(t));

    // если встречаем "на" — склоняем только первую часть
    const idxNa = tokens.findIndex((t) => t.toLowerCase() === "на");
    if (idxNa > 0) {
      const head = tokens.slice(0, idxNa).join("-");
      const tail = tokens.slice(idxNa).join("-");
      return `${toPrepositionalWord(head)}-${tail}`;
    }

    return tokens.map((t) => toPrepositionalWord(t)).join("-");
  }

  // пробелы: склоняем последнее слово
  if (name.includes(" ")) {
    const ws = name.split(" ").map((t) => normSpaces(t)).filter(Boolean);
    if (ws.length >= 2) {
      const last = ws[ws.length - 1];
      return [...ws.slice(0, -1), toPrepositionalWord(last)].join(" ");
    }
  }

  return toPrepositionalWord(name);
}

export function regionLoc(region: RegionLike): string {
  const name = normSpaces(String(region?.name || region?.slug || ""));
  const slug = String(region?.slug || "").trim().toLowerCase();

  const dict: Record<string, string> = {
    moskva: "Москве",
    "sankt-peterburg": "Санкт-Петербурге",
    spb: "Санкт-Петербурге",
    kazan: "Казани",
    "nizhniy-novgorod": "Нижнем Новгороде",
    "rostov-na-donu": "Ростове-на-Дону",
    sochi: "Сочи",
    "velikiy-novgorod": "Великом Новгороде",
    ulyanovsk: "Ульяновске",
  };

  const cityPrep = slug && dict[slug] ? dict[slug] : cityToPrepositional(name, slug);
  if (cityPrep && cityPrep !== "вашем городе") return `в ${cityPrep}`;
  return "в вашем городе";
}

export function normalizeText(s: string) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

/* =========================
   ENTITY NAME HELPERS
   (ВАЖНО: НЕ МЕНЯЕМ НАЗВАНИЕ, если оно уже пришло из БД)
========================= */

export function hasCyrillic(s: string) {
  return /[А-Яа-яЁё]/.test(String(s || ""));
}

/**
 * Оставляем как есть (если пришло из БД).
 * Если имени нет — возвращаем fallback (обычно slug) БЕЗ обратной транслитерации.
 */
export function ensureRussianName(nameOrSlug: string, fallbackSlug?: string) {
  const n = String(nameOrSlug || "").trim();
  if (n) return n;
  return String(fallbackSlug || "").trim();
}

/* =========================
   TEMPLATE ENGINE
========================= */

type TplCtx = {
  regionName: string; // "Санкт-Петербург"
  regionLoc: string; // "в Санкт-Петербурге"
  regionSlug: string; // "sankt-peterburg"
  entityName?: string; // услуга/товар/компания
  category?: string | null; // категория
  priceRange?: string; // "от 10 000 до 20 000 ₽" | "Цена уточняется"
  companiesCount?: number; // 0..n
};

type Tpl = (c: TplCtx) => string | null;

function chooseText(key: string, templates: Tpl[], ctx: TplCtx) {
  const usable = templates
    .map((fn) => fn(ctx))
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return pickVariant(key, usable.length ? usable : [""]).trim();
}

/* =========================
   TITLE/DESCRIPTION TEMPLATES
========================= */

const regionTitles: Tpl[] = [
  (c) => `Услуги и товары для дома ${c.regionLoc} — цены, отзывы, рейтинг | ${SITE_NAME}`,
  (c) => `Подбор мастеров и подрядчиков ${c.regionLoc} — услуги и товары | ${SITE_NAME}`,
  (c) => `Каталог услуг и товаров ${c.regionLoc}: сравнение цен и компаний | ${SITE_NAME}`,
  (c) => `Найти мастера ${c.regionLoc} — услуги для дома, рейтинг компаний | ${SITE_NAME}`,
];

const regionDescs: Tpl[] = [
  (c) => `Подбор исполнителей ${c.regionLoc}: услуги и товары для дома. Сравнение по цене, рейтингу и отзывам. ${SITE_NAME}.`,
  (c) => `Каталог услуг и товаров ${c.regionLoc}: проверенные компании, цены и отзывы. Выберите подрядчика за пару минут.`,
  (c) => `Ищете услуги для дома ${c.regionLoc}? Сравните предложения компаний по цене и рейтингу. ${SITE_NAME}.`,
];

const listTitles: Tpl[] = [
  (c) =>
    c.category
      ? `${c.entityName} “${c.category}” ${c.regionLoc} — цены и компании | ${SITE_NAME}`
      : `${c.entityName} ${c.regionLoc} — каталог, цены, компании | ${SITE_NAME}`,
  (c) =>
    c.category
      ? `${c.category}: ${c.entityName} ${c.regionLoc} — выбрать исполнителя | ${SITE_NAME}`
      : `${c.entityName} ${c.regionLoc} — подобрать по цене и отзывам | ${SITE_NAME}`,
  (c) =>
    c.category
      ? `${c.entityName} ${c.regionLoc}: ${c.category} — предложения компаний | ${SITE_NAME}`
      : `${c.entityName} ${c.regionLoc}: список и категории | ${SITE_NAME}`,
];

const listDescs: Tpl[] = [
  (c) =>
    c.category
      ? `Категория “${c.category}” ${c.regionLoc}: список, подбор по цене и отзывам. ${SITE_NAME}.`
      : `Каталог: ${c.entityName} ${c.regionLoc}. Фильтры по категориям, удобный подбор по цене и рейтингу.`,
  (c) =>
    c.category
      ? `Сравните компании по категории “${c.category}” ${c.regionLoc}. Цены и предложения — на ${SITE_NAME}.`
      : `Список и категории: ${c.entityName} ${c.regionLoc}. Найдите подходящее предложение.`,
];

const serviceTitles: Tpl[] = [
  (c) =>
    c.priceRange && c.priceRange !== "Цена уточняется"
      ? `${c.entityName} ${c.regionLoc} — ${c.priceRange}, рейтинг компаний | ${SITE_NAME}`
      : `${c.entityName} ${c.regionLoc} — подбор исполнителей, рейтинг | ${SITE_NAME}`,
  (c) =>
    c.priceRange && c.priceRange !== "Цена уточняется"
      ? `Заказать: ${c.entityName} ${c.regionLoc}. Стоимость ${c.priceRange} | ${SITE_NAME}`
      : `Заказать: ${c.entityName} ${c.regionLoc}. Сравнение компаний | ${SITE_NAME}`,
  (c) => `${c.entityName}: ${c.regionLoc} — предложения компаний и отзывы | ${SITE_NAME}`,
  (c) => `${c.entityName} ${c.regionLoc} — найти подрядчика по цене и рейтингу | ${SITE_NAME}`,
];

const serviceDescs: Tpl[] = [
  (c) =>
    `Услуга “${c.entityName}” ${c.regionLoc}: цены ${c.priceRange || "уточняются"}, рейтинг и отзывы. Подбор исполнителя на ${SITE_NAME}.`,
  (c) =>
    `Сравните компании по услуге “${c.entityName}” ${c.regionLoc}. ${
      c.companiesCount ? `Компаний: ${c.companiesCount}. ` : ""
    }Цены: ${c.priceRange || "уточняются"}.`,
  (c) => `Подбор исполнителей на “${c.entityName}” ${c.regionLoc}. Список компаний, цены и отзывы — ${SITE_NAME}.`,
];

const productTitles: Tpl[] = [
  (c) =>
    c.priceRange && c.priceRange !== "Цена уточняется"
      ? `${c.entityName} ${c.regionLoc} — ${c.priceRange}, предложения компаний | ${SITE_NAME}`
      : `${c.entityName} ${c.regionLoc} — предложения компаний | ${SITE_NAME}`,
  (c) => `${c.entityName}: ${c.regionLoc} — цены и где купить | ${SITE_NAME}`,
  (c) => `${c.entityName} ${c.regionLoc} — сравнить поставщиков по цене | ${SITE_NAME}`,
];

const productDescs: Tpl[] = [
  (c) =>
    `Товар “${c.entityName}” ${c.regionLoc}: предложения компаний, цены ${c.priceRange || "уточняются"}. Сравнение поставщиков на ${SITE_NAME}.`,
  (c) => `Сравните поставщиков “${c.entityName}” ${c.regionLoc}: цены и предложения компаний. ${SITE_NAME}.`,
];

const companyTitles: Tpl[] = [
  (c) => `${c.entityName} — услуги и товары ${c.regionLoc} | ${SITE_NAME}`,
  (c) => `Компания ${c.entityName} ${c.regionLoc} — прайс, услуги и товары | ${SITE_NAME}`,
  (c) => `${c.entityName}: предложения и цены ${c.regionLoc} | ${SITE_NAME}`,
];

const companyDescs: Tpl[] = [
  (c) => `Компания ${c.entityName} ${c.regionLoc}: услуги и товары, цены, прайс и контакты. ${SITE_NAME}.`,
  (c) => `Профиль компании “${c.entityName}” ${c.regionLoc}. Прайс на услуги и товары, список позиций и цены.`,
];

/* =========================
   BUILDERS
========================= */

export function buildRegionSeo(input: { regionSlug: string; regionName: string }) {
  const ctx: TplCtx = {
    regionSlug: input.regionSlug,
    regionName: input.regionName,
    regionLoc: regionLoc({ slug: input.regionSlug, name: input.regionName }),
  };

  const key = `region:${ctx.regionSlug}`;
  const title = capitalizeFirst(chooseText(key, regionTitles, ctx));
  const description = chooseText(`${key}:d`, regionDescs, ctx);
  const canonical = absUrl(`/${ctx.regionSlug}`);

  return { title, description, canonical, ctx };
}

export function buildListSeo(input: {
  type: "services" | "products";
  regionSlug: string;
  regionName: string;
  category?: string | null;
}) {
  const entityName = input.type === "services" ? "Услуги" : "Товары";
  const ctx: TplCtx = {
    regionSlug: input.regionSlug,
    regionName: input.regionName,
    regionLoc: regionLoc({ slug: input.regionSlug, name: input.regionName }),
    entityName,
    category: input.category || null,
  };

  const key = `list:${input.type}:${ctx.regionSlug}:${ctx.category || "all"}`;
  const title = capitalizeFirst(chooseText(key, listTitles, ctx));
  const description = chooseText(`${key}:d`, listDescs, ctx);

  const url =
    input.category
      ? `/${ctx.regionSlug}/${input.type}?category=${encodeURIComponent(input.category)}`
      : `/${ctx.regionSlug}/${input.type}`;

  return { title, description, canonical: absUrl(url), ctx };
}

export function buildServiceSeo(input: {
  regionSlug: string;
  regionName: string;
  serviceName: string;
  serviceSlug: string;
  price: PriceInfo;
  companiesCount: number;
}) {
  const ctx: TplCtx = {
    regionSlug: input.regionSlug,
    regionName: input.regionName,
    regionLoc: regionLoc({ slug: input.regionSlug, name: input.regionName }),
    // НЕ меняем название, которое пришло из БД
    entityName: ensureRussianName(input.serviceName, input.serviceSlug),
    priceRange: buildPriceRange(input.price),
    companiesCount: input.companiesCount,
  };

  const key = `service:${ctx.regionSlug}:${input.serviceSlug}`;
  const title = capitalizeFirst(chooseText(key, serviceTitles, ctx));
  const description = chooseText(`${key}:d`, serviceDescs, ctx);
  const canonical = absUrl(`/${ctx.regionSlug}/services/${input.serviceSlug}`);

  return { title, description, canonical, ctx };
}

export function buildProductSeo(input: {
  regionSlug: string;
  regionName: string;
  productName: string;
  productSlug: string;
  price: PriceInfo;
  companiesCount: number;
}) {
  const ctx: TplCtx = {
    regionSlug: input.regionSlug,
    regionName: input.regionName,
    regionLoc: regionLoc({ slug: input.regionSlug, name: input.regionName }),
    // НЕ меняем название, которое пришло из БД
    entityName: ensureRussianName(input.productName, input.productSlug),
    priceRange: buildPriceRange(input.price),
    companiesCount: input.companiesCount,
  };

  const key = `product:${ctx.regionSlug}:${input.productSlug}`;
  const title = capitalizeFirst(chooseText(key, productTitles, ctx));
  const description = chooseText(`${key}:d`, productDescs, ctx);
  const canonical = absUrl(`/${ctx.regionSlug}/products/${input.productSlug}`);

  return { title, description, canonical, ctx };
}

export function buildCompanySeo(input: {
  regionSlug: string;
  regionName: string;
  companyName: string;
  companyId: number;
}) {
  const ctx: TplCtx = {
    regionSlug: input.regionSlug,
    regionName: input.regionName,
    regionLoc: regionLoc({ slug: input.regionSlug, name: input.regionName }),
    entityName: input.companyName,
  };

  const key = `company:${ctx.regionSlug}:${input.companyId}`;
  const title = capitalizeFirst(chooseText(key, companyTitles, ctx));
  const description = chooseText(`${key}:d`, companyDescs, ctx);
  const canonical = absUrl(`/${ctx.regionSlug}/c/${input.companyId}`);

  return { title, description, canonical, ctx };
}

/* =========================
   METADATA HELPERS
========================= */

export function toNextMetadata(seo: { title: string; description: string; canonical: string }): Metadata {
  const ogImage = absUrl("/images/og-default.webp");
  return {
    title: normalizeText(seo.title),
    description: normalizeText(seo.description),
    alternates: { canonical: seo.canonical },
    openGraph: {
      title: normalizeText(seo.title),
      description: normalizeText(seo.description),
      url: seo.canonical,
      siteName: SITE_NAME,
      type: "website",
      locale: "ru_RU",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: normalizeText(seo.title),
      description: normalizeText(seo.description),
      images: [ogImage],
    },
  };
}

/* =========================
   JSON-LD BUILDERS
========================= */

export function jsonLdBreadcrumb(items: { name: string; item?: string }[], id?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    ...(id ? { "@id": id } : {}),
    itemListElement: items.map((x, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: x.name,
      ...(x.item ? { item: x.item } : {}),
    })),
  };
}

export function jsonLdOrganization(input: { name: string; url: string; logoUrl?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${input.url}#organization`,
    name: input.name,
    url: input.url,
    ...(input.logoUrl
      ? {
          logo: {
            "@type": "ImageObject",
            url: input.logoUrl,
          },
        }
      : {}),
  };
}

export function jsonLdWebSite(input: { name: string; url: string; searchTarget?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${input.url}#website`,
    url: input.url,
    name: input.name,
    publisher: { "@id": `${input.url}#organization` },
    ...(input.searchTarget
      ? {
          potentialAction: {
            "@type": "SearchAction",
            target: input.searchTarget,
            "query-input": "required name=search_term_string",
          },
        }
      : {}),
  };
}

export function jsonLdWebPage(input: {
  url: string;
  name: string;
  description?: string;
  imageUrl?: string | null;
  mainEntityId?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${input.url}#webpage`,
    url: input.url,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    isPartOf: { "@id": `${SITE_URL}#website` },
    inLanguage: "ru-RU",
    ...(input.imageUrl
      ? {
          primaryImageOfPage: {
            "@type": "ImageObject",
            url: input.imageUrl,
          },
        }
      : {}),
    ...(input.mainEntityId ? { mainEntity: { "@id": input.mainEntityId } } : {}),
  };
}

export function jsonLdService(input: {
  url: string;
  name: string;
  regionName: string;
  price: PriceInfo;
  companiesCount: number;
}) {
  const cur = (input.price.currency || "RUB").toUpperCase();

  const low =
    input.price.priceMin != null && Number.isFinite(Number(input.price.priceMin))
      ? Number(input.price.priceMin)
      : null;

  const high =
    input.price.priceMax != null && Number.isFinite(Number(input.price.priceMax))
      ? Number(input.price.priceMax)
      : null;

  const offerCount = Math.max(0, Number(input.companiesCount || 0));

  const obj: any = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    url: input.url,
  };

  // ✅ Для Service areaServed валиден
  if (String(input.regionName || "").trim()) {
    obj.areaServed = { "@type": "City", name: input.regionName };
    obj.availableChannel = {
      "@type": "ServiceChannel",
      serviceUrl: input.url,
      availableLanguage: "ru-RU",
      serviceLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: input.regionName,
        },
      },
    };
  }

  // ✅ Цена — только через offers
  if (low != null || high != null) {
    const aggregateOffer = {
      "@type": "AggregateOffer",
      priceCurrency: cur,
      offerCount: offerCount || 1,
      ...(low != null ? { lowPrice: low } : {}),
      ...(high != null ? { highPrice: high } : {}),
      url: input.url,
    };
    const directPrice = low ?? high;
    const offer =
      directPrice != null
        ? {
            "@type": "Offer",
            priceCurrency: cur,
            price: directPrice,
            url: input.url,
          }
        : null;
    obj.offers = offer ? [aggregateOffer, offer] : aggregateOffer;
  }

  return obj;
}


export function jsonLdProduct(input: {
  url: string;
  name: string;
  regionName: string; // оставляем в сигнатуре, вдруг пригодится
  price: PriceInfo;
  companiesCount: number;
  rating?: number | null;
  reviewsCount?: number | null;
  brandName?: string | null;
  modelName?: string | null;
  groupName?: string | null;
  availability?: "InStock" | "OutOfStock" | "PreOrder" | null;
}) {
  const cur = (input.price.currency || "RUB").toUpperCase();

  const low =
    input.price.priceMin != null && Number.isFinite(Number(input.price.priceMin))
      ? Number(input.price.priceMin)
      : null;

  const high =
    input.price.priceMax != null && Number.isFinite(Number(input.price.priceMax))
      ? Number(input.price.priceMax)
      : null;

  const offerCount = Math.max(0, Number(input.companiesCount || 0));

  const availabilityUrl = input.availability
    ? `https://schema.org/${input.availability}`
    : undefined;

  const obj: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    url: input.url,
  };

  if (input.brandName) {
    obj.brand = { "@type": "Brand", name: input.brandName };
  }

  if (input.modelName) {
    obj.model = { "@type": "ProductModel", name: input.modelName };
  }

  if (input.groupName) {
    obj.isVariantOf = { "@type": "ProductGroup", name: input.groupName };
  }

  // ✅ цену у Product показываем ТОЛЬКО через offers
  if (low != null || high != null) {
    const price = low ?? high;
    const priceSpecifications: any[] = [];

    if (price != null) {
      priceSpecifications.push({
        "@type": "UnitPriceSpecification",
        price,
        priceCurrency: cur,
        priceType: "https://schema.org/SalePrice",
      });
    }

    if (high != null && low != null && high > low) {
      priceSpecifications.push({
        "@type": "UnitPriceSpecification",
        price: high,
        priceCurrency: cur,
        priceType: "https://schema.org/ListPrice",
      });
    }

    const offer = {
      "@type": "Offer",
      ...(price != null ? { price } : {}),
      priceCurrency: cur,
      ...(availabilityUrl ? { availability: availabilityUrl } : {}),
      url: input.url,
      ...(priceSpecifications.length ? { priceSpecification: priceSpecifications } : {}),
    };

    const aggregateOffer = {
      "@type": "AggregateOffer",
      priceCurrency: cur,
      offerCount: offerCount || 1,
      ...(low != null ? { lowPrice: low } : {}),
      ...(high != null ? { highPrice: high } : {}),
      url: input.url,
      ...(availabilityUrl ? { availability: availabilityUrl } : {}),
    };

    obj.offers = [offer, aggregateOffer];
  }

  const rating = input.rating;
  const rc = input.reviewsCount;

  if (typeof rating === "number" && Number.isFinite(rating) && typeof rc === "number" && rc > 0) {
    obj.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: String(rating),
      reviewCount: String(rc),
    };
  }

  return obj;
}


/* =========================
   JSON-LD: Company
========================= */

export function jsonLdCompany(input: {
  url: string;
  name: string;
  regionName: string;
  rating?: number | null;
  reviewsCount?: number | null;
}) {
  const obj: any = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: input.name,
    url: input.url,
    areaServed: { "@type": "City", name: input.regionName },
  };

  const rating = input.rating;
  const rc = input.reviewsCount;

  if (typeof rating === "number" && Number.isFinite(rating) && typeof rc === "number" && rc > 0) {
    obj.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: String(rating),
      reviewCount: String(rc),
    };
  }

  return obj;
}

// lib/seo.ts



function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return null;
  try {
    return Math.round(Number(n)).toLocaleString("ru-RU");
  } catch {
    return String(Math.round(Number(n)));
  }
}

export function buildSeoText(args: {
  kind: "service" | "product";
  name: string;
  regionSlug: string;
  regionName: string;
  slug: string;
  companiesCount: number;
  priceFrom?: number | null;
  priceTo?: number | null;
  // если хочешь — можно прокинуть category позже
}) {
  const { kind, name, regionSlug, regionName, slug, companiesCount } = args;

  const pf = money(args.priceFrom ?? null);
  const pt = money(args.priceTo ?? null);

  const what = kind === "service" ? "услугу" : "товар";
  const where = `в ${regionName}`;

  const priceSentence =
    pf || pt
      ? `По предложениям компаний цены обычно в диапазоне от ${pf ?? "—"} до ${pt ?? "—"} ₽ (зависит от объёма и условий).`
      : `Цены зависят от характеристик и условий — сравните предложения компаний и уточните детали перед заказом.`;

  const variants = [
    {
      p1: `На этой странице собраны компании, которые предлагают ${what} «${name}» ${where}. Сравните условия, цены и выберите подходящего исполнителя/поставщика.`,
      p2: `${priceSentence} Сейчас доступно компаний: ${companiesCount}.`,
      bullets: [
        `сравнение предложений по цене и условиям`,
        `выбор компании по рейтингу и наличию подтверждения`,
        `быстрый переход к карточке компании и контактам`,
      ],
    },
    {
      p1: `Ищете ${what} «${name}» ${where}? Здесь вы можете быстро понять рынок: кто работает в регионе и какие условия предлагают компании.`,
      p2: `${priceSentence} Количество компаний в выдаче: ${companiesCount}.`,
      bullets: [
        `актуальные предложения по региону`,
        `возможность выбрать оптимальную цену`,
        `удобная навигация по компаниям`,
      ],
    },
    {
      p1: `Страница «${name}» ${where} создана для SEO и удобного выбора: даже если прямо сейчас нет предложений, URL остаётся постоянным, а данные будут появляться по мере добавления компаний.`,
      p2: `${priceSentence} Текущее число компаний: ${companiesCount}.`,
      bullets: [
        `страница услуги/товара привязана к региону`,
        `появление новых предложений без смены URL`,
        `корректная структура для поисковых систем`,
      ],
    },
    {
      p1: `Подбор ${what} «${name}» ${where}: сравнивайте компании, ориентируясь на стоимость, опыт и условия выполнения.`,
      p2: `${priceSentence} Вариантов компаний: ${companiesCount}.`,
      bullets: [
        `прозрачная витрина предложений`,
        `выбор по бюджету и диапазону цен`,
        `быстрый переход к исполнителю`,
      ],
    },
  ];

  const v = pickVariant(`${kind}:${regionSlug}:${slug}`, variants);
  return v;
}
