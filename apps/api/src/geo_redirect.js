import maxmind from "maxmind";
import path from "node:path";

const DB_PATH =
  process.env.DBIP_MMDB_PATH ||
  path.resolve(process.cwd(), "data/dbip/dbip-city-lite.mmdb");

// откуда брать список регионов (у тебя это тот же домен api)
const REGIONS_URL =
  process.env.REGIONS_URL || "https://api.moydompro.ru/public/regions";

// дефолтный регион
const DEFAULT_SLUG = process.env.DEFAULT_REGION_SLUG || "sankt-peterburg";

// --- MMDB reader (лениво, один раз) ---
let readerPromise = null;
function getReader() {
  if (!readerPromise) readerPromise = maxmind.open(DB_PATH);
  return readerPromise;
}

// --- helpers ---
function normKey(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/ё/g, "е")
    .replace(/[."']/g, "")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ");
}

// простой транслит, достаточный для совпадения "Санкт-Петербург" -> "sankt peterburg"
function ruToLat(s) {
  const map = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
    ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "",
    э: "e", ю: "yu", я: "ya",
  };
  const n = normKey(s);
  let out = "";
  for (const ch of n) out += map[ch] ?? ch;
  return out;
}

// --- cache regions index for 60 minutes ---
const REGIONS_TTL_MS = 60 * 60 * 1000;

let regionsCache = {
  ts: 0,
  idx: null, // Map
};

function buildAliases() {
  // Небольшой ручной словарь для типовых вариантов DB-IP (EN)
  // Всё остальное покрываем индексом из /public/regions
  return {
    "saint petersburg": "sankt-peterburg",
    "st petersburg": "sankt-peterburg",
    "st petersburg city": "sankt-peterburg",
    "moscow": "moskva",
    "yekaterinburg": "ekaterinburg",
    "nizhny novgorod": "nizhniy-novgorod",
    "orel": "oryol",
    "korolev": "korolyov",
    "yoshkar ola": "yoshkar-ola",
    "cheboksary": "cheboksary",
    // дополняем по факту логами
  };
}

async function getRegionsIndexCached() {
  const now = Date.now();
  if (regionsCache.idx && now - regionsCache.ts < REGIONS_TTL_MS) {
    return regionsCache.idx;
  }

  const r = await fetch(REGIONS_URL, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`REGIONS_URL ${r.status}`);
  const j = await r.json();
  const items = j?.ok && Array.isArray(j.items) ? j.items : [];

  const idx = new Map();

  for (const it of items) {
    const name = it?.name || "";
    const slug = it?.slug || "";
    if (!slug) continue;

    const kName = normKey(name); // "санкт петербург"
    const kSlug = normKey(slug); // "sankt peterburg"
    const kSlugNoDash = normKey(slug.replace(/-/g, "")); // "sanktpeterburg"
    const kTrans = ruToLat(name); // "sankt peterburg"

    if (kName) idx.set(kName, slug);
    if (kSlug) idx.set(kSlug, slug);
    if (kSlugNoDash) idx.set(kSlugNoDash, slug);
    if (kTrans) idx.set(kTrans, slug);
  }

  // ручные алиасы (EN → slug)
  const aliases = buildAliases();
  for (const [k, v] of Object.entries(aliases)) {
    idx.set(normKey(k), v);
  }

  regionsCache = { ts: now, idx };
  return idx;
}

async function geoToRegionSlug(geo) {
  const country = geo?.country?.iso_code || "";
  if (country && country !== "RU") return null;

  const cityRu = geo?.city?.names?.ru || "";
  const cityEn = geo?.city?.names?.en || "";
  const regRu = geo?.subdivisions?.[0]?.names?.ru || "";
  const regEn = geo?.subdivisions?.[0]?.names?.en || "";

  const idx = await getRegionsIndexCached();

  const candidates = [cityRu, cityEn, regRu, regEn].filter(Boolean);

  for (const raw of candidates) {
    const k = normKey(raw);

    // прямое попадание
    const hit = idx.get(k);
    if (hit) return hit;

    // дополнительные "мягкие" варианты (на случай сокращений)
    // st. petersburg -> saint petersburg
    const k2 = normKey(raw.replace(/^st\s+/i, "saint "));
    const hit2 = idx.get(k2);
    if (hit2) return hit2;

    // пробуем транслит (если пришло ru, а совпадение в индексе через trans)
    const kt = ruToLat(raw);
    const hit3 = idx.get(kt);
    if (hit3) return hit3;
  }

  return null;
}

function getClientIp(req) {
  const xff = (req.headers["x-forwarded-for"] || "").toString();
  const ip =
    xff.split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.ip ||
    req.socket?.remoteAddress ||
    "";
  return ip.toString().replace(/^::ffff:/, "");
}

export function registerGeoRedirect(app) {
  app.get("/public/geo-redirect", async (req, res) => {
    // чтобы кеш обновлялся и работал предсказуемо
    res.setHeader("Cache-Control", "no-store");

    try {
      const ip = getClientIp(req);
      const reader = await getReader();
      const geo = reader.get(ip);

      const slug = (await geoToRegionSlug(geo)) || DEFAULT_SLUG;

      res.setHeader(
        "Set-Cookie",
        `region=${encodeURIComponent(slug)}; Path=/; Max-Age=31536000; SameSite=Lax`
      );

      return res.redirect(302, `/${slug}/`);
    } catch (e) {
      const slug = DEFAULT_SLUG;

      res.setHeader(
        "Set-Cookie",
        `region=${encodeURIComponent(slug)}; Path=/; Max-Age=31536000; SameSite=Lax`
      );

      return res.redirect(302, `/${slug}/`);
    }
  });
}
