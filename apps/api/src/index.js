// /api/src/index.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";
import { fileURLToPath } from "node:url";
import { registerMasterRoutes } from "./master.js";
import { registerAdminSeoGenerate } from "./admin_seo_generate.js";
import sharp from "sharp";

import { registerGeoRedirect } from "./geo_redirect.js";
import { registerLeadsRoutes } from "./leads.js";

/* =========================================================
   GLOBAL PROCESS HANDLERS (debug)
========================================================= */
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT_EXCEPTION:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED_REJECTION:", reason);
});

const { Pool } = pg;
const app = express();
// после app = express()
registerGeoRedirect(app);
app.set("trust proxy", 1);

const ADMIN_BASE_URL = (process.env.ADMIN_BASE_URL || "https://admin.moydompro.ru").replace(/\/+$/, "");
const API_BASE_URL = (process.env.API_BASE_URL || "https://api.moydompro.ru").replace(/\/+$/, "");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================================================
   DB
========================================================= */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on("error", (err) => {
  console.error("PG_POOL_ERROR:", err);
});

/* =========================================================
   UPLOADS (logos + company item photos)
========================================================= */
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join("/app", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// отдаём файлы загрузок
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d", etag: true }));

/* =========================================================
   MIDDLEWARES
========================================================= */

const LOG_REQUESTS = process.env.LOG_REQUESTS === "true";
// лог запросов
app.use((req, _res, next) => {
  if (LOG_REQUESTS) {
    console.log("REQ", req.method, req.url);
  }
  next();
});

// body + cookies
app.use(express.json({ limit: "25mb" }));
app.use(cookieParser());

// CORS
const DEFAULT_CORS = new Set([
  "https://admin.moydompro.ru",
  "https://moydompro.ru",
  "https://www.moydompro.ru",
]);

const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED = new Set([...DEFAULT_CORS, ...CORS_ORIGINS]);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/postman
      if (ALLOWED.size === 0) return cb(null, true);
      return cb(null, ALLOWED.has(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options("*", cors());

/* =========================================================
   HELPERS
========================================================= */


function slugifyRu(input) {
  const s = String(input || "").trim().toLowerCase();
  const map = {
    а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",
    и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",
    с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",
    ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
  };

  return (
    s.split("").map(c => map[c] ?? c).join("")
     .replace(/[^a-z0-9]+/g,"-")
     .replace(/-+/g,"-")
     .replace(/^-|-$/g,"")
  ) || "service";
}


/* --------- product specs (master) --------- */
// specs: [{name, value}] max 10
function normalizeSpecs(input) {
  const arr = Array.isArray(input) ? input : [];
  return arr
    .map((x) => ({
      name: String(x?.name ?? "").trim(),
      value: String(x?.value ?? "").trim(),
    }))
    .filter((x) => x.name && x.value)
    .slice(0, 10);
}

// для чтения из БД, если вдруг придёт строкой
function parseSpecsDb(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}


function getByPath(obj, pathStr) {
  const parts = String(pathStr || "").split(".").map((s) => s.trim()).filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) cur = cur[p];
    else return "";
  }
  return cur == null ? "" : String(cur);
}

function renderTemplate(str, ctx) {
  const s = String(str ?? "");
  if (!s) return s;
  // {{ region.name }} / {{price.from}}
  return s.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, key) => getByPath(ctx, key));
}


const aw = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function hasOwn(o, k) {
  return Object.prototype.hasOwnProperty.call(o, k);
}
function pick(o, keys) {
  for (const k of keys) if (hasOwn(o, k)) return o[k];
  return undefined;
}

function cleanStr(v) {
  if (v === undefined) return undefined; // undefined => "не трогать"
  if (v === null) return null; // null => "очистить"
  const s = String(v).trim();
  return s.length ? s : null;
}

function toNumOrNull(v) {
  if (v === undefined) return undefined; // undefined => "не трогать"
  if (v === null) return null;
  const t = String(v).trim();
  if (!t) return null;
  const n = Number(t.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function isIntLike(v) {
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n);
}

function normKind(k) {
  const t = String(k ?? "").trim().toLowerCase();
  if (!t) return "";
  if (["service", "services", "svc", "услуга", "услуги"].includes(t)) return "service";
  if (["product", "products", "товар", "товары"].includes(t)) return "product";
  if (["custom", "кастом", "прочее", "другое"].includes(t)) return "custom";
  return t;
}

function isEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function cleanUrl(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^t\.me\//i.test(s)) return "https://" + s;
  return s;
}

function parseDataUrlBase64(dataUrl) {
  const m = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
}

function extFromMime(mime, fallbackName = "") {
  const byMime = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  if (byMime[mime]) return byMime[mime];
  const m = String(fallbackName).toLowerCase().match(/\.([a-z0-9]{2,6})$/);
  return m ? m[1] : "png";
}

/* --------- text --------- */

function sanitizeText(v, maxLen = 5000) {
  if (v === undefined) return undefined; // не трогать
  if (v === null) return null; // очистить
  const s = String(v).trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/* --------- images (company items) --------- */

function normalizeListInput(v) {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((x) => String(x || "").trim()).filter(Boolean);
}

function normalizeFilenamesInput(v) {
  if (v === undefined || v === null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((x) => String(x || "").trim());
}

async function saveDataUrlImageGeneric({ prefix, dataUrl, filenameHint, maxBytes }) {
  const parsed = parseDataUrlBase64(dataUrl);
  if (!parsed) return { ok: false, error: "bad_image_base64" };
  if (!isAllowedImageMime(parsed.mime)) return { ok: false, error: "bad_image_type" };

  const ext = extFromMime(parsed.mime, String(filenameHint || ""));
  const safeExt = ["png", "jpg", "jpeg", "webp", "svg"].includes(ext) ? ext : "png";

  const buf = Buffer.from(parsed.b64, "base64");
  if (!buf?.length) return { ok: false, error: "bad_image_data" };
  if (buf.length > maxBytes) return { ok: false, error: "image_too_large" };

  const fname = `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${safeExt}`;
  const fpath = path.join(UPLOAD_DIR, fname);
  await fs.promises.writeFile(fpath, buf);

  return { ok: true, url: `/uploads/${fname}` };
}

async function saveDataUrlImageAsWebp({ prefix, dataUrl, filenameHint, maxBytes }) {
  const parsed = parseDataUrlBase64(dataUrl);
  if (!parsed) return { ok: false, error: "bad_image_base64" };
  if (!isAllowedImageMime(parsed.mime)) return { ok: false, error: "bad_image_type" };

  const buf = Buffer.from(parsed.b64, "base64");
  if (!buf?.length) return { ok: false, error: "bad_image_data" };
  if (buf.length > maxBytes) return { ok: false, error: "image_too_large" };

  // SVG оставляем как есть (не трогаем)
  if (String(parsed.mime).toLowerCase() === "image/svg+xml") {
    const fname = `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.svg`;
    const fpath = path.join(UPLOAD_DIR, fname);
    await fs.promises.writeFile(fpath, buf);
    return { ok: true, url: `/uploads/${fname}` };
  }

  // Все растровые => WEBP
  const fname = `${prefix}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.webp`;
  const fpath = path.join(UPLOAD_DIR, fname);

  try {
    await sharp(buf)
      .rotate() // учитывает EXIF orientation
      .webp({ quality: 82 }) // можно потом подкрутить
      .toFile(fpath);

    return { ok: true, url: `/uploads/${fname}` };
  } catch (e) {
    console.error("sharp_convert_failed:", e);
    return { ok: false, error: "convert_failed" };
  }
}

function isAllowedImageMime(m) {
  const mm = String(m || "").toLowerCase();
  return ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"].includes(mm);
}

async function saveDataUrlImage({ companyId, prefix, dataUrl, filenameHint, maxBytes }) {
  const parsed = parseDataUrlBase64(dataUrl);
  if (!parsed) return { ok: false, error: "bad_image_base64" };
  if (!isAllowedImageMime(parsed.mime)) return { ok: false, error: "bad_image_type" };

  const ext = extFromMime(parsed.mime, String(filenameHint || ""));
  const safeExt = ["png", "jpg", "jpeg", "webp", "svg"].includes(ext) ? ext : "png";

  const buf = Buffer.from(parsed.b64, "base64");
  if (!buf?.length) return { ok: false, error: "bad_image_data" };
  if (buf.length > maxBytes) return { ok: false, error: "image_too_large" };

  const fname = `${prefix}-company-${companyId}-${Date.now()}-${crypto
    .randomBytes(6)
    .toString("hex")}.${safeExt}`;
  const fpath = path.join(UPLOAD_DIR, fname);
  await fs.promises.writeFile(fpath, buf);

  return { ok: true, url: `/uploads/${fname}` };
}

async function saveImagesFromDataUrls({ companyId, itemId, photos_base64, photos_filenames }) {
  // photos_base64: undefined => не трогать (PATCH)
  // null => очистить
  // [] => очистить
  const list = normalizeListInput(photos_base64);

  if (list === undefined) return undefined;
  if (list === null) return [];

  if (list.length > 5) {
    const err = new Error("too_many_photos");
    err.statusCode = 400;
    throw err;
  }

  const names = normalizeFilenamesInput(photos_filenames);
  const urls = [];
  const MAX_BYTES = 3 * 1024 * 1024; // 3MB

  for (let i = 0; i < list.length; i++) {
    const saved = await saveDataUrlImage({
      companyId,
      prefix: `item-${itemId}`,
      dataUrl: list[i],
      filenameHint: names[i] || `photo-${i + 1}.jpg`,
      maxBytes: MAX_BYTES,
    });

    if (!saved.ok) {
      const err = new Error(saved.error || "bad_photo");
      err.statusCode = 400;
      throw err;
    }
    urls.push(saved.url);
  }

  return urls;
}

/* --------- ids resolvers --------- */

async function resolveServiceId({ service_id, service_slug }) {
  if (isIntLike(service_id)) return Number(service_id);
  const slug = cleanStr(service_slug);
  if (!slug) return null;
  const r = await pool.query("select id from services_catalog where slug=$1 limit 1", [slug]);
  return r.rows[0]?.id ?? null;
}

async function resolveProductId({ product_id, product_slug }) {
  if (isIntLike(product_id)) return Number(product_id);
  const slug = cleanStr(product_slug);
  if (!slug) return null;
  const r = await pool.query("select id from products where slug=$1 limit 1", [slug]);
  return r.rows[0]?.id ?? null;
}

async function getRegionBySlugOr404(res, regionSlug) {
  const rr = await pool.query("select id, slug, name from regions where slug=$1 limit 1", [regionSlug]);
  if (!rr.rowCount) {
    res.status(404).json({ ok: false, error: "region_not_found" });
    return null;
  }
  return rr.rows[0];
}

/* =========================================================
   AUTH (JWT in cookie)
========================================================= */
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const COOKIE_NAME = "mpv_auth";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || ".moydompro.ru";
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || "1") !== "0";

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function signEmailToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

const SMTP_HOST = process.env.SMTP_HOST || "smtp.timeweb.ru";
const SMTP_PORT = Number(process.env.SMTP_PORT || "465");
const SMTP_SECURE = String(process.env.SMTP_SECURE || "1") !== "0";
const SMTP_USER = process.env.SMTP_USER || "no-reply@moydompro.ru";
const SMTP_PASS = process.env.SMTP_PASS || "";
const MAIL_FROM = process.env.MAIL_FROM || `МойДомПро <${SMTP_USER}>`;

function extractEmailAddress(input, fallback) {
  const raw = String(input || "").trim();
  const match = raw.match(/<([^>]+)>/);
  if (match?.[1]) return match[1];
  if (raw.includes("@")) return raw;
  return fallback;
}

function buildEmailMessage({ from, to, subject, text, html }) {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
  ];

  if (html) {
    const boundary = `--mdp-${crypto.randomBytes(8).toString("hex")}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    return [
      ...headers,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      text || "",
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      html,
      `--${boundary}--`,
      "",
    ].join("\r\n");
  }

  headers.push("Content-Type: text/plain; charset=utf-8");
  headers.push("Content-Transfer-Encoding: 8bit");
  return [...headers, "", text || "", ""].join("\r\n");
}

async function smtpSend(commandSocket, command) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (data) => {
      buffer += data.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line) continue;
        if (/^[45]\d{2}\s/.test(line)) {
          commandSocket.off("data", onData);
          reject(new Error(line.trim()));
          return;
        }
        if (/^\d{3}\s/.test(line)) {
          commandSocket.off("data", onData);
          resolve(line.trim());
          return;
        }
      }
    };
    commandSocket.on("data", onData);
    if (command) {
      commandSocket.write(`${command}\r\n`);
    }
  });
}

async function sendEmail({ to, subject, text, html }) {
  if (!SMTP_PASS) {
    console.warn("SMTP_PASS is not configured. Skip sending email.");
    return { ok: false, error: "smtp_not_configured" };
  }

  const envelopeFrom = extractEmailAddress(MAIL_FROM, SMTP_USER);
  const envelopeTo = extractEmailAddress(to, to);
  const message = buildEmailMessage({ from: MAIL_FROM, to, subject, text, html });

  const socket = SMTP_SECURE
    ? tls.connect({ host: SMTP_HOST, port: SMTP_PORT })
    : net.connect({ host: SMTP_HOST, port: SMTP_PORT });

  socket.setTimeout(15000);
  socket.on("timeout", () => socket.destroy(new Error("SMTP timeout")));

  await smtpSend(socket, null);
  await smtpSend(socket, `EHLO ${SMTP_HOST}`);
  await smtpSend(socket, "AUTH LOGIN");
  await smtpSend(socket, Buffer.from(SMTP_USER).toString("base64"));
  await smtpSend(socket, Buffer.from(SMTP_PASS).toString("base64"));
  await smtpSend(socket, `MAIL FROM:<${envelopeFrom}>`);
  await smtpSend(socket, `RCPT TO:<${envelopeTo}>`);
  await smtpSend(socket, "DATA");
  await smtpSend(socket, `${message}\r\n.`);
  await smtpSend(socket, "QUIT");

  socket.end();
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject,
    text,
    html,
  });

  return { ok: true };
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "Lax",
    domain: COOKIE_DOMAIN,
    path: "/",
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

function clearAuthCookie(res) {
  res.cookie(COOKIE_NAME, "", {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "Lax",
    domain: COOKIE_DOMAIN,
    path: "/",
    expires: new Date(0),
  });
}

function authMiddleware(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
}

function requireAuth(req, res, next) {
  return authMiddleware(req, res, () => {
    if (!req.user) return res.status(401).json({ ok: false, error: "unauthorized" });
    return next();
  });
}

function requireSuperadmin(req, res, next) {
  return authMiddleware(req, res, () => {
    if (!req.user) return res.status(401).json({ ok: false, error: "unauthorized" });
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    return next();
  });
}

// master access by email list (env MASTER_ADMIN_EMAILS="a@b.com,c@d.com")
async function requireMaster(req, res, next) {
  return authMiddleware(req, res, async () => {
    if (!req.user?.sub) return res.status(401).json({ ok: false, error: "unauthorized" });

    const allowed = String(process.env.MASTER_ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (!allowed.length) {
      return res.status(403).json({ ok: false, error: "master_admin_emails_not_set" });
    }

    const r = await pool.query(`select email from company_users where id=$1 limit 1`, [req.user.sub]);
    const email = String(r.rows?.[0]?.email || "").toLowerCase();

    if (!email || !allowed.includes(email)) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    return next();
  });
}

/* =========================================================
   BASIC
========================================================= */

app.get(
  "/health",
  aw(async (_req, res) => {
    try {
      const r = await pool.query("select 1 as ok");
      res.json({ ok: true, db: r.rows?.[0]?.ok === 1, ts: new Date().toISOString() });
    } catch (e) {
      res.status(500).json({ ok: false, db: false, error: String(e?.message || e) });
    }
  })
);

// ✅ один обработчик на два пути (НЕ дубль роутов, общий handler)
const listRegionsHandler = aw(async (_req, res) => {
  const r = await pool.query("select id, name, slug from regions order by name asc");
  res.json({ ok: true, items: r.rows });
});
app.get("/regions", listRegionsHandler);
app.get("/public/regions", listRegionsHandler);

app.get(
  "/services",
  aw(async (_req, res) => {
    const r = await pool.query(`
      select
        s.id,
        s.name,
        s.slug,
        coalesce(sc.name, s.category_slug, '') as category,
        s.cover_image as image_url
      from services_catalog s
      left join service_categories sc on sc.id = s.category_id
      where s.show_on_site = true
      order by category asc, s.name asc
    `);
    res.json({ ok: true, items: r.rows });
  })
);

// POST /services
app.post(
  "/services",
  aw(async (req, res) => {
    try {
      const name = sanitizeText(req.body?.name, 500);
      const slugRaw = cleanStr(req.body?.slug);
      const categoryId = Number(req.body?.category_id || 0);

      if (!name) return res.status(400).json({ ok: false, error: "bad_name" });
      if (!Number.isFinite(categoryId) || categoryId <= 0)
        return res.status(400).json({ ok: false, error: "bad_category_id" });

      const cat = await pool.query("select slug from service_categories where id=$1", [
        categoryId,
      ]);
      const categorySlug = cat.rows?.[0]?.slug || "general";

      const slugBase = slugifyRu(slugRaw || name);
      if (!slugBase) return res.status(400).json({ ok: false, error: "bad_slug" });

      const dupeName = await pool.query(
        "select id from services_catalog where lower(trim(name))=lower(trim($1)) limit 1",
        [name]
      );
      if (dupeName.rowCount) return res.status(409).json({ ok: false, error: "name_exists" });

      let slug = slugBase;
      for (let i = 0; i < 50; i++) {
        const dupe = await pool.query("select id from services_catalog where slug=$1 limit 1", [
          slug,
        ]);
        if (!dupe.rowCount) break;
        slug = `${slugBase}-${i + 1}`;
      }

      const description = sanitizeText(req.body?.description, 50000);
      const cover_image = cleanStr(req.body?.cover_image);
      const seo_h1 = sanitizeText(req.body?.seo_h1, 300);
      const seo_title = sanitizeText(req.body?.seo_title, 700);
      const seo_description = sanitizeText(req.body?.seo_description, 1500);
      const seo_text = sanitizeText(req.body?.seo_text, 50000);

      const ins = await pool.query(
        `insert into services_catalog (name, slug, category_id, category_slug, description, cover_image, seo_h1, seo_title, seo_description, seo_text)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         returning id, name, slug, category_id`,
        [
          name,
          slug,
          categoryId,
          categorySlug,
          description ?? null,
          cover_image ?? null,
          seo_h1 ?? null,
          seo_title ?? null,
          seo_description ?? null,
          seo_text ?? null,
        ]
      );

      res.json({ ok: true, item: ins.rows[0] });
    } catch (e) {
      console.error("POST /services failed", e);
      res.status(500).json({ ok: false, error: "services_create_failed" });
    }
  })
);

app.get(
  "/company/services",
  requireAuth,
  aw(async (_req, res) => {
    const r = await pool.query(`
      select
        s.id,
        s.name,
        s.slug,
        coalesce(sc.name, s.category_slug, '') as category,
        s.cover_image as image_url
      from services_catalog s
      left join service_categories sc on sc.id = s.category_id
      order by category asc, s.name asc
    `);
    res.json({ ok: true, items: r.rows });
  })
);

app.get(
  "/company/products",
  requireAuth,
  aw(async (req, res) => {
    try {
      const categoryIdRaw = req.query.category_id;
      const categoryId =
        categoryIdRaw !== undefined && categoryIdRaw !== null && String(categoryIdRaw).trim()
          ? Number(categoryIdRaw)
          : null;

      if (!categoryId || !Number.isFinite(categoryId) || categoryId <= 0) {
        const r = await pool.query(
          `select id, name, slug, category, category_id, cover_image as image_url
           from products
           order by category_id nulls last, name asc`
        );
        return res.json({ ok: true, items: r.rows });
      }

      const r = await pool.query(
        `
        WITH RECURSIVE tree AS (
          SELECT id FROM product_categories WHERE id = $1
          UNION ALL
          SELECT c.id
          FROM product_categories c
          JOIN tree t ON c.parent_id = t.id
        )
        SELECT p.id, p.name, p.slug, p.category, p.category_id, p.cover_image as image_url
        FROM products p
        WHERE p.category_id IN (SELECT id FROM tree)
        ORDER BY p.name asc
        `,
        [categoryId]
      );

      return res.json({ ok: true, items: r.rows });
    } catch (e) {
      console.error("GET /company/products error", e);
      return res.status(500).json({ ok: false, error: "company_products_failed" });
    }
  })
);

/* =========================================================
   PRODUCTS
   ✅ РОВНО ОДИН GET /products
========================================================= */

app.get(
  "/products",
  aw(async (req, res) => {
    try {
      const categoryIdRaw = req.query.category_id;
      const categoryId =
        categoryIdRaw !== undefined && categoryIdRaw !== null && String(categoryIdRaw).trim()
          ? Number(categoryIdRaw)
          : null;

      if (!categoryId || !Number.isFinite(categoryId) || categoryId <= 0) {
        const r = await pool.query(
          `select id, name, slug, category, category_id, cover_image as image_url
           from products
           where show_on_site = true -- ✅ Фильтр только для опубликованных товаров
           order by category_id nulls last, name asc`
        );
        return res.json({ ok: true, items: r.rows });
      }

      const r = await pool.query(
        `
        WITH RECURSIVE tree AS (
          SELECT id FROM product_categories WHERE id = $1
          UNION ALL
          SELECT c.id
          FROM product_categories c
          JOIN tree t ON c.parent_id = t.id
        )
        SELECT p.id, p.name, p.slug, p.category, p.category_id, p.cover_image as image_url
        FROM products p
        WHERE p.category_id IN (SELECT id FROM tree)
          AND p.show_on_site = true -- ✅ Фильтр для товаров внутри категорий
        ORDER BY p.name asc
        `,
        [categoryId]
      );

      return res.json({ ok: true, items: r.rows });
    } catch (e) {
      console.error("GET /products error", e);
      return res.status(500).json({ ok: false, error: "products_failed" });
    }
  })
);

// =========================================================
// PUBLIC: Service Category SEO (base + region override merged)
// GET /public/region/:region_slug/service-category/:category_slug
// =========================================================
app.get("/public/region/:region_slug/service-category/:category_slug", async (req, res, next) => {
  try {
    const regionSlug = String(req.params.region_slug || "").trim();
    const catSlug = String(req.params.category_slug || "").trim();

    if (!regionSlug) return res.status(400).json({ ok: false, error: "bad_region_slug" });
    if (!catSlug) return res.status(400).json({ ok: false, error: "bad_category_slug" });

    const rr = await pool.query(`select id, slug, name from regions where slug=$1 limit 1`, [regionSlug]);
    const region = rr.rows[0];
    if (!region) return res.status(404).json({ ok: false, error: "region_not_found" });

    // ВАЖНО: у вас service_categories теперь с parent_id/seo_*
    const cr = await pool.query(
      `select id, slug, name, parent_id, sort_order, is_active,
              seo_h1, seo_title, seo_description, seo_text
       from service_categories
       where slug=$1
       limit 1`,
      [catSlug]
    );
    const category = cr.rows[0];
    if (!category) return res.status(404).json({ ok: false, error: "category_not_found" });

    const or = await pool.query(
      `select seo_h1, seo_title, seo_description, seo_text
       from service_category_region_seo
       where region_id=$1 and category_id=$2
       limit 1`,
      [region.id, category.id]
    );
    const ovr = or.rows[0] || null;

    // merge: override если не null/не пусто, иначе base
    const pick = (ov, base) => (ov !== null && ov !== undefined ? ov : base);

    const seo = {
      seo_h1: pick(ovr?.seo_h1, category.seo_h1) ?? null,
      seo_title: pick(ovr?.seo_title, category.seo_title) ?? null,
      seo_description: pick(ovr?.seo_description, category.seo_description) ?? null,
      seo_text: pick(ovr?.seo_text, category.seo_text) ?? null,
    };

    return res.json({
      ok: true,
      region,
      category: { id: category.id, slug: category.slug, name: category.name, parent_id: category.parent_id ?? null },
      seo,
    });
  } catch (e) {
    return next(e);
  }
});

/* =========================================================
   PUBLIC SERVICES CATALOG
========================================================= */

app.get(
  "/public/services/categories",
  aw(async (_req, res) => {
    const r = await pool.query(
      `
      select
        id,
        slug,
        name,
        parent_id,
        sort_order,
        is_active,
        image_url,
        image_thumb_url
      from service_categories
      where is_active = true
      order by sort_order nulls last, name asc
      `
    );

    res.json({ ok: true, categories: r.rows });
  })
);


app.get(
  "/public/services",
  aw(async (req, res) => {
    const category = String(req.query.category || "").trim();

    const q = category
      ? {
          text: `
            select
              sc.slug as category_slug,
              sc.name as category_name,
              sc.image_url as category_image_url,
              sc.image_thumb_url as category_image_thumb_url,
              s.slug, s.name,
              s.default_unit
            from services_catalog s
            left join service_categories sc on sc.id = s.category_id
            where sc.slug = $1
            order by s.name asc
          `,
          values: [category],
        }
      : {
          text: `
            select
              sc.slug as category_slug,
              sc.name as category_name,
              sc.image_url as category_image_url,
              sc.image_thumb_url as category_image_thumb_url,
              s.slug, s.name,
              s.default_unit
            from services_catalog s
            left join service_categories sc on sc.id = s.category_id
            order by sc.name asc nulls last, s.name asc
          `,
          values: [],
        };

    const r = await pool.query(q.text, q.values);
    res.json({ ok: true, services: r.rows });
  })
);


app.get(
  "/public/services/:slug",
  aw(async (req, res) => {
    const slug = String(req.params.slug || "").trim();
    if (!slug) return res.status(400).json({ ok: false, error: "bad_request" });

    const r = await pool.query(
      `
      select
        s.slug, s.name,
        s.default_unit,
        s.lead_form_key,
        s.synonyms,
        s.seo_title_template,
        s.seo_description_template,
        s.faq_template,

        sc.slug as category_slug,
        sc.name as category_name,

        -- ✅ category images from master admin
        sc.image_url as category_image_url,
        sc.image_thumb_url as category_image_thumb_url

      from services_catalog s
      left join service_categories sc on sc.id = s.category_id
      where s.slug = $1
      limit 1
      `,
      [slug]
    );

    if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, service: r.rows[0] });
  })
);


/* =========================================================
   PUBLIC REGION -> SEARCH
   GET /public/region/:region/search?q=...
========================================================= */
app.get(
  "/public/region/:region/search",
  aw(async (req, res) => {
    const regionSlug = String(req.params.region || "").trim();
    const qRaw = String(req.query.q || "").trim();

    if (!regionSlug) return res.status(400).json({ ok: false, error: "bad_region" });

    const region = await getRegionBySlugOr404(res, regionSlug);
    if (!region) return; // helper уже отправил ответ

    const q = qRaw.replace(/\s+/g, " ").trim();
    if (q.length < 2) {
      return res.json({ ok: true, region, q, services: [], products: [], companies: [] });
    }

    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20) || 20));
    const like = `%${q}%`;

    // SERVICES (✅ сначала каноника cover_image, затем fallback на company_items.photos[0])
    const servicesR = await pool.query(
      `
      select
        s.slug,
        s.name,
        sc.slug as category_slug,
        sc.name as category_name,
        count(distinct c.id)::int as companies_count,
        min(ci.price_min) filter (where ci.price_min is not null) as price_min,

        coalesce(
          nullif(s.cover_image,''),
          max(
            case
              when jsonb_typeof(ci.photos)='array' and jsonb_array_length(ci.photos) > 0
                then nullif(ci.photos->>0,'')
              else null
            end
          )
        ) as image_url,

        'RUB'::text as currency
      from services_catalog s
      left join service_categories sc on sc.id = s.category_id
      left join company_items ci
        on ci.kind='service' and ci.service_id = s.id
      left join companies c
        on c.id = ci.company_id and c.region_id = $1
      where
        (
          s.name ilike $2
          or coalesce(s.synonyms::text,'') ilike $2
        )
      group by s.slug, s.name, sc.slug, sc.name, s.cover_image
      order by
        (s.name ilike $3) desc,
        companies_count desc,
        s.name asc
      limit $4
      `,
      [region.id, like, q, limit]
    );

    // PRODUCTS (✅ сначала каноника cover_image, затем fallback на company_items.photos[0])
    const productsR = await pool.query(
      `
      select
        p.slug,
        p.name,
        pc.slug as category_slug,
        pc.name as category_name,
        count(distinct c.id)::int as companies_count,
        min(ci.price_min) filter (where ci.price_min is not null) as price_min,

        coalesce(
          nullif(p.cover_image,''),
          max(
            case
              when jsonb_typeof(ci.photos)='array' and jsonb_array_length(ci.photos) > 0
                then nullif(ci.photos->>0,'')
              else null
            end
          )
        ) as image_url,

        'RUB'::text as currency
      from products p
      left join product_categories pc on pc.id = p.category_id
      left join company_items ci
        on ci.kind='product' and ci.product_id = p.id
      left join companies c
        on c.id = ci.company_id and c.region_id = $1
      where p.name ilike $2
      group by p.slug, p.name, pc.slug, pc.name, p.cover_image
      order by
        (p.name ilike $3) desc,
        companies_count desc,
        p.name asc
      limit $4
      `,
      [region.id, like, q, limit]
    );

    // COMPANIES
    const companiesR = await pool.query(
      `
      select
        c.id,
        c.name,
        c.is_verified,
        c.rating,
        c.reviews_count,
        c.logo_url
      from companies c
      where c.region_id = $1
        and c.name ilike $2
      order by
        (c.name ilike $3) desc,
        c.is_verified desc,
        c.rating desc nulls last,
        c.reviews_count desc nulls last,
        c.id desc
      limit $4
      `,
      [region.id, like, q, limit]
    );

    return res.json({
      ok: true,
      region,
      q,
      services: servicesR.rows,
      products: productsR.rows,
      companies: companiesR.rows,
    });
  })
);

/* =========================================================
   PUBLIC REGION -> PRODUCT CATEGORY SEO
   ✅ один роут (уникальный путь)
========================================================= */
app.get(
  "/public/region/:region/product-category/:slug",
  aw(async (req, res) => {
    const regionSlug = String(req.params.region || "").trim();
    const catSlug = String(req.params.slug || "").trim();

    if (!regionSlug || !catSlug) {
      return res.status(400).json({ ok: false, error: "bad_request" });
    }

    const region = await getRegionBySlugOr404(res, regionSlug);
    if (!region) return;

    const cr = await pool.query(
      `select id, slug, name, parent_id, seo_h1, seo_text, seo_title, seo_description
       from product_categories
       where slug=$1 and is_active=true
       limit 1`,
      [catSlug]
    );
    if (!cr.rowCount) return res.status(404).json({ ok: false, error: "category_not_found" });
    const category = cr.rows[0];

    const sr = await pool.query(
      `select seo_h1, seo_text, seo_title, seo_description
       from product_category_region_seo
       where region_id=$1 and category_id=$2
       limit 1`,
      [region.id, category.id]
    );

    const seo = sr.rows[0] || {};

    return res.json({
      ok: true,
      region,
      category: {
        id: category.id,
        slug: category.slug,
        name: category.name,
        parent_id: category.parent_id,
        seo_h1: seo.seo_h1 ?? category.seo_h1 ?? null,
        seo_text: seo.seo_text ?? category.seo_text ?? null,
        seo_title: seo.seo_title ?? category.seo_title ?? null,
        seo_description: seo.seo_description ?? category.seo_description ?? null,
      },
    });
  })
);

/* =========================================================
   PUBLIC PRODUCT CATEGORY (base SEO)
   ✅ один роут
========================================================= */
app.get(
  "/public/product-category/:slug",
  aw(async (req, res) => {
    const slug = String(req.params.slug || "").trim();
    if (!slug) return res.status(400).json({ ok: false, error: "No slug" });

    const r = await pool.query(
      `select id, slug, name, parent_id, seo_h1, seo_text, seo_title, seo_description
       from product_categories
       where slug=$1 and is_active=true
       limit 1`,
      [slug]
    );

    const cat = r.rows[0];
    if (!cat) return res.status(404).json({ ok: false, error: "Not found" });

    return res.json({ ok: true, category: cat });
  })
);

/* =========================================================
   PUBLIC REGION -> PRODUCTS
   ✅ РОВНО ОДИН GET /public/region/:region/products
========================================================= */
app.get(
  "/public/region/:region/products",
  aw(async (req, res) => {
    const regionSlug = String(req.params.region || "").trim();
    if (!regionSlug) return res.status(400).json({ ok: false, error: "bad_region" });

    const region = await getRegionBySlugOr404(res, regionSlug);
    if (!region) return;

    const categorySlug = String(req.query.category_slug || req.query.category || "").trim() || "";

    const categoryIdRaw = req.query.category_id;
    const categoryId =
      categoryIdRaw !== undefined && categoryIdRaw !== null && String(categoryIdRaw).trim()
        ? Number(categoryIdRaw)
        : null;

    // 1) фильтр по дереву category_id
    // ✅ базовая таблица = products, компании через LEFT JOIN,
    //    показываем если есть компании в регионе ИЛИ p.show_on_site=true
    // ✅ FIX: price_min/image_url считаем ТОЛЬКО по компаниям этого региона (c.id is not null)
    if (categoryId && Number.isFinite(categoryId) && categoryId > 0) {
      const r = await pool.query(
        `
        WITH RECURSIVE tree AS (
          SELECT id FROM product_categories WHERE id = $2
          UNION ALL
          SELECT c2.id
          FROM product_categories c2
          JOIN tree t ON c2.parent_id = t.id
        )
        select
          p.id, p.slug, p.name,
          p.category_id,
          pc.slug as category_slug,
          pc.name as category_name,
          coalesce(p.category, pc.slug, '') as category,

          count(distinct c.id)::int as companies_count,

          min(ci.price_min) filter (
            where ci.price_min is not null
              and c.id is not null
          ) as price_min,

          coalesce(
            nullif(p.cover_image,''),
            max(
              case
                when c.id is not null
                 and jsonb_typeof(ci.photos)='array'
                 and jsonb_array_length(ci.photos) > 0
                  then nullif(ci.photos->>0,'')
                else null
              end
            )
          ) as image_url,

          'RUB'::text as currency
        from products p
        left join product_categories pc on pc.id = p.category_id
        left join company_items ci
          on ci.kind='product' and ci.product_id = p.id
        left join companies c
          on c.id = ci.company_id and c.region_id = $1
        where p.category_id in (select id from tree)
        group by
          p.id, p.slug, p.name,
          p.category_id,
          pc.slug, pc.name,
          category,
          p.cover_image,
          p.show_on_site
        having
          count(distinct c.id) > 0
          or p.show_on_site = true
        order by pc.name asc nulls last, p.name asc
        `,
        [region.id, categoryId]
      );
      return res.json({ ok: true, region, products: r.rows });
    }

    // 2) фильтр по category_slug (или legacy category=)
    // ✅ базовая таблица = products, компании через LEFT JOIN,
    //    показываем если есть компании в регионе ИЛИ p.show_on_site=true
    // ✅ FIX: price_min/image_url считаем ТОЛЬКО по компаниям этого региона (c.id is not null)
    if (categorySlug) {
      const r = await pool.query(
        `
        select
          p.id, p.slug, p.name,
          p.category_id,
          pc.slug as category_slug,
          pc.name as category_name,
          coalesce(p.category, pc.slug, '') as category,

          count(distinct c.id)::int as companies_count,

          min(ci.price_min) filter (
            where ci.price_min is not null
              and c.id is not null
          ) as price_min,

          coalesce(
            nullif(p.cover_image,''),
            max(
              case
                when c.id is not null
                 and jsonb_typeof(ci.photos)='array'
                 and jsonb_array_length(ci.photos) > 0
                  then nullif(ci.photos->>0,'')
                else null
              end
            )
          ) as image_url,

          'RUB'::text as currency
        from products p
        left join product_categories pc on pc.id = p.category_id
        left join company_items ci
          on ci.kind='product' and ci.product_id = p.id
        left join companies c
          on c.id = ci.company_id and c.region_id = $1
        where pc.slug = $2
        group by
          p.id, p.slug, p.name,
          p.category_id,
          pc.slug, pc.name,
          category,
          p.cover_image,
          p.show_on_site
        having
          count(distinct c.id) > 0
          or p.show_on_site = true
        order by p.name asc
        `,
        [region.id, categorySlug]
      );
      return res.json({ ok: true, region, products: r.rows });
    }

    // 3) без фильтра
    // ✅ базовая таблица = products, компании через LEFT JOIN,
    //    показываем если есть компании в регионе ИЛИ p.show_on_site=true
    // ✅ FIX: price_min/image_url считаем ТОЛЬКО по компаниям этого региона (c.id is not null)
    const r = await pool.query(
      `
      select
        p.id, p.slug, p.name,
        p.category_id,
        pc.slug as category_slug,
        pc.name as category_name,
        coalesce(p.category, pc.slug, '') as category,

        count(distinct c.id)::int as companies_count,

        min(ci.price_min) filter (
          where ci.price_min is not null
            and c.id is not null
        ) as price_min,

        coalesce(
          nullif(p.cover_image,''),
          max(
            case
              when c.id is not null
               and jsonb_typeof(ci.photos)='array'
               and jsonb_array_length(ci.photos) > 0
                then nullif(ci.photos->>0,'')
              else null
            end
          )
        ) as image_url,

        'RUB'::text as currency
      from products p
      left join product_categories pc on pc.id = p.category_id
      left join company_items ci
        on ci.kind='product' and ci.product_id = p.id
      left join companies c
        on c.id = ci.company_id and c.region_id = $1
      group by
        p.id, p.slug, p.name,
        p.category_id,
        pc.slug, pc.name,
        category,
        p.cover_image,
        p.show_on_site
      having
        count(distinct c.id) > 0
        or p.show_on_site = true
      order by pc.name asc nulls last, p.name asc
      `,
      [region.id]
    );

    return res.json({ ok: true, region, products: r.rows });
  })
);



app.get(
  "/public/region/:region/products/:slug",
  aw(async (req, res) => {
    const regionSlug = String(req.params.region || "").trim();
    const productSlug = String(req.params.slug || "").trim();

    if (!regionSlug || !productSlug) {
      return res.status(400).json({ ok: false, error: "bad_request" });
    }

    const region = await getRegionBySlugOr404(res, regionSlug);
    if (!region) return;

    let pr;
    try {
      pr = await pool.query(
        `
        select
          p.id,
          p.slug,
          p.name,
          p.rating,
          p.reviews_count,
          p.category_id,
          pc.slug as category_slug,
          pc.name as category_name,
          coalesce(p.category, pc.slug, '') as category,

          p.description,
          p.cover_image,
          p.gallery,
          p.specs,
          p.seo_h1,
          p.seo_title,
          p.seo_description,
          p.seo_text

        from products p
        left join product_categories pc on pc.id = p.category_id
        where p.slug = $1
          and (
            p.show_on_site = true
            or exists (
              -- Show product if ANY company in this region sells it, regardless of global flag
              select 1
              from company_items ci
              join companies c on c.id = ci.company_id
              where ci.product_id = p.id
                and ci.kind = 'product'
                and c.region_id = $2
            )
          )
        limit 1
        `,
        [productSlug, region.id] // ✅ Added region.id as the second parameter
      );
    } catch (e) {
      const msg = String(e?.message || "");
      const missingRating = msg.includes("column \"rating\"") || msg.includes("column \"reviews_count\"");
      if (!missingRating) throw e;
      pr = await pool.query(
        `
        select
          p.id,
          p.slug,
          p.name,
          p.category_id,
          pc.slug as category_slug,
          pc.name as category_name,
          coalesce(p.category, pc.slug, '') as category,

          p.description,
          p.cover_image,
          p.gallery,
          p.specs,
          p.seo_h1,
          p.seo_title,
          p.seo_description,
          p.seo_text

        from products p
        left join product_categories pc on pc.id = p.category_id
        where p.slug = $1
          and (
            p.show_on_site = true
            or exists (
              -- Show product if ANY company in this region sells it, regardless of global flag
              select 1
              from company_items ci
              join companies c on c.id = ci.company_id
              where ci.product_id = p.id
                and ci.kind = 'product'
                and c.region_id = $2
            )
          )
        limit 1
        `,
        [productSlug, region.id]
      );
    }

    if (!pr.rowCount) return res.status(404).json({ ok: false, error: "product_not_found" });
    const product = pr.rows[0];
    if (product.rating === undefined) product.rating = null;
    if (product.reviews_count === undefined) product.reviews_count = null;

    product.specs = normalizeSpecs(parseSpecsDb(product.specs));

    // ✅ fallback PREVIEW from company_items (if no canonical data)
    const prevR = await pool.query(
      `
      select
        ci.description,
        ci.photos
      from company_items ci
      join companies c on c.id = ci.company_id
      where c.region_id = $1
        and ci.kind = 'product'
        and ci.product_id = $2
      order by
        ci.price_min asc nulls last,
        ci.id desc
      limit 1
      `,
      [region.id, product.id]
    );

    const prev = prevR.rows?.[0] || null;

    const canonicalDesc = String(product.description ?? "").trim();
    const canonicalCover = String(product.cover_image ?? "").trim();
    const fallbackDesc = String(prev?.description ?? "").trim();

    const fallbackImage = (() => {
      const p = prev?.photos;
      let arr = null;
      if (Array.isArray(p)) arr = p;
      else if (typeof p === "string") {
        try {
          const parsed = JSON.parse(p);
          if (Array.isArray(parsed)) arr = parsed;
        } catch {}
      }
      const first = arr && arr.length ? String(arr[0] || "").trim() : "";
      return first || "";
    })();

    const finalDesc = canonicalDesc || fallbackDesc || "";
    const finalCover = canonicalCover || fallbackImage || "";

    product.short_description = finalDesc
      ? finalDesc.length > 240
        ? finalDesc.slice(0, 240).trim() + "…"
        : finalDesc
      : null;

    product.image_url = finalCover || null;

    product.seo = {
      h1: String(product.seo_h1 ?? "").trim() || null,
      title: String(product.seo_title ?? "").trim() || null,
      description: String(product.seo_description ?? "").trim() || null,
      text: String(product.seo_text ?? "").trim() || null,
    };

    // ✅ companies for product + work examples
    const cr = await pool.query(
      `
      select
        c.id,
        c.name,
        c.logo_url,
        c.address,
        c.description,
        c.is_verified,
        c.rating,
        c.reviews_count,
        c.photos as photos,

        min(ci.price_min) filter (where ci.price_min is not null) as price_min,
        null::numeric as price_max,
        'RUB'::text as currency,
        count(ci.id)::int as items_count

      from companies c
      join company_items ci on ci.company_id = c.id
      where c.region_id = $1
        and ci.kind = 'product'
        and ci.product_id = $2
      group by
        c.id, c.name, c.logo_url, c.address, c.description,
        c.is_verified, c.rating, c.reviews_count, c.photos
      order by
        c.is_verified desc,
        c.rating desc nulls last,
        c.reviews_count desc nulls last,
        price_min asc nulls last,
        c.id desc
      limit 200
      `,
      [region.id, product.id]
    );

    const companies = cr.rows || [];

    const prices = companies
      .map((x) => Number(x.price_min))
      .filter((n) => Number.isFinite(n) && n > 0);

    const priceFrom = prices.length ? Math.min(...prices) : null;

    return res.json({
      ok: true,
      region: { id: region.id, slug: region.slug, name: region.name },
      product,
      companies,
      price: { from: priceFrom },
    });
  })
);


app.get(
  "/public/products/:id/reviews",
  aw(async (req, res) => {
    const productId = Number(req.params.id);
    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ ok: false, error: "bad_product_id" });
    }

    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20) || 20));
    const offset = Math.max(0, Number(req.query.offset || 0) || 0);

    const itemsR = await pool.query(
      `
      select
        id,
        rating,
        text,
        created_at
      from product_reviews
      where product_id = $1
        and is_hidden = false
      order by created_at desc, id desc
      limit $2 offset $3
      `,
      [productId, limit, offset]
    );

    const statsR = await pool.query(
      `
      select
        count(*)::int as total_count,
        count(*) filter (where nullif(trim(coalesce(text, '')), '') is null)::int as ratings_count,
        count(*) filter (where nullif(trim(coalesce(text, '')), '') is not null)::int as reviews_count,
        coalesce(round(avg(rating)::numeric, 2), 0) as rating_avg
      from product_reviews
      where product_id = $1
        and is_hidden = false
      `,
      [productId]
    );

    return res.json({
      ok: true,
      product_id: productId,
      stats: statsR.rows[0],
      items: itemsR.rows,
    });
  })
);

app.post(
  "/public/products/:id/reviews",
  aw(async (req, res) => {
    const productId = Number(req.params.id);
    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ ok: false, error: "bad_product_id" });
    }

    const rating = Number(req.body?.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ ok: false, error: "bad_rating" });
    }

    const text = normalizeReviewText(req.body?.text, 2000);
    if (text && hasLinks(text)) {
      return res.status(400).json({ ok: false, error: "links_not_allowed" });
    }

    // антиспам (минимальный): 1 отзыв в сутки с одного IP на один товар
    const ip = req.ip || null;
    const ua = String(req.headers["user-agent"] || "").slice(0, 300) || null;

    if (ip) {
      const spamR = await pool.query(
        `
        select count(*)::int as cnt
        from product_reviews
        where product_id = $1
          and author_ip = $2::inet
          and created_at > now() - interval '24 hours'
        `,
        [productId, ip]
      );
      if ((spamR.rows?.[0]?.cnt || 0) >= 1) {
        return res.status(429).json({ ok: false, error: "too_many_reviews" });
      }
    }

    // транзакция: вставили отзыв -> пересчитали рейтинг/кол-во -> обновили products
    const client = await pool.connect();
    try {
      await client.query("begin");

      const ins = await client.query(
        `
        insert into product_reviews (product_id, rating, text, author_ip, user_agent)
        values ($1, $2, $3, $4::inet, $5)
        returning id, rating, text, created_at
        `,
        [productId, Math.trunc(rating), text, ip, ua]
      );

      const stats = await client.query(
        `
        select
          count(*)::int as total_count,
          count(*) filter (where nullif(trim(coalesce(text, '')), '') is null)::int as ratings_count,
          count(*) filter (where nullif(trim(coalesce(text, '')), '') is not null)::int as reviews_count,
          coalesce(round(avg(rating)::numeric, 2), 0) as rating_avg
        from product_reviews
        where product_id = $1
          and is_hidden = false
        `,
        [productId]
      );

      await client.query(
        `
        update products
        set
          reviews_count = $2,
          rating = $3
        where id = $1
        `,
        [productId, stats.rows[0].total_count, stats.rows[0].rating_avg]
      );

      await client.query("commit");

      return res.json({
        ok: true,
        item: ins.rows[0],
        stats: stats.rows[0],
      });
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
  })
);





/* =========================================================
   PRODUCT CATEGORIES
========================================================= */
app.get(
  "/product-categories",
  aw(async (req, res) => {
    try {
      const flat = String(req.query.flat || "") === "1";

      const { rows } = await pool.query(
        `
        SELECT
          id,
          slug,
          name,
          parent_id,
          sort_order,

          -- ✅ SEO
          seo_h1,
          seo_title,
          seo_description,
          seo_text,

          -- ✅ Images (from master admin)
          image_url,
          image_thumb_url

        FROM product_categories
        WHERE is_active = true
        ORDER BY sort_order, name;
        `
      );

      const byId = new Map(rows.map((r) => [r.id, { ...r, children: [] }]));
      const roots = [];
      for (const r of byId.values()) {
        if (r.parent_id && byId.has(r.parent_id)) byId.get(r.parent_id).children.push(r);
        else roots.push(r);
      }

      if (!flat) return res.json({ ok: true, result: roots });

      const out = [];
      const walk = (node, depth, pathArr) => {
        const path2 = [...pathArr, node.name];
        out.push({
          id: node.id,
          slug: node.slug,
          name: node.name,
          parent_id: node.parent_id,
          sort_order: node.sort_order,

          // ✅ пробрасываем SEO
          seo_h1: node.seo_h1 ?? null,
          seo_title: node.seo_title ?? null,
          seo_description: node.seo_description ?? null,
          seo_text: node.seo_text ?? null,

          // ✅ пробрасываем картинки
          image_url: node.image_url ?? null,
          image_thumb_url: node.image_thumb_url ?? null,

          // computed
          depth,
          path_name: path2.join(" → "),
        });
        (node.children || []).forEach((ch) => walk(ch, depth + 1, path2));
      };
      roots.forEach((r) => walk(r, 0, []));

      return res.json({ ok: true, result: out });
    } catch (e) {
      console.error("GET /product-categories error", e);
      res.status(500).json({ ok: false, error: "Internal error" });
    }
  })
);

/* =========================================================
   ADMIN: PRODUCT CATEGORY REGION SEO (override per region)
   - read:   GET    /admin/product-category-region-seo?region_id=&category_id=
   - upsert: PUT    /admin/product-category-region-seo
   - delete: DELETE /admin/product-category-region-seo?region_id=&category_id=
========================================================= */
app.get(
  "/admin/product-category-region-seo",
  requireAuth,
  aw(async (req, res) => {
    const region_id = Number(req.query.region_id);
    const category_id = Number(req.query.category_id);

    if (!Number.isFinite(region_id) || region_id <= 0) {
      return res.status(400).json({ ok: false, error: "bad_region_id" });
    }
    if (!Number.isFinite(category_id) || category_id <= 0) {
      return res.status(400).json({ ok: false, error: "bad_category_id" });
    }

    const r = await pool.query(
      `select id, region_id, category_id, seo_h1, seo_title, seo_description, seo_text
       from product_category_region_seo
       where region_id=$1 and category_id=$2
       limit 1`,
      [region_id, category_id]
    );

    return res.json({ ok: true, item: r.rows[0] || null });
  })
);

app.put(
  "/admin/product-category-region-seo",
  requireAuth,
  aw(async (req, res) => {
    const region_id = Number(req.body?.region_id);
    const category_id = Number(req.body?.category_id);

    if (!Number.isFinite(region_id) || region_id <= 0) {
      return res.status(400).json({ ok: false, error: "bad_region_id" });
    }
    if (!Number.isFinite(category_id) || category_id <= 0) {
      return res.status(400).json({ ok: false, error: "bad_category_id" });
    }

    const seo_h1 = sanitizeText(req.body?.seo_h1, 300);
    const seo_title = sanitizeText(req.body?.seo_title, 500);
    const seo_description = sanitizeText(req.body?.seo_description, 1000);
    const seo_text = sanitizeText(req.body?.seo_text, 20000);

    const r = await pool.query(
      `
      insert into product_category_region_seo
        (region_id, category_id, seo_h1, seo_title, seo_description, seo_text)
      values
        ($1,$2,$3,$4,$5,$6)
      on conflict (region_id, category_id)
      do update set
        seo_h1 = excluded.seo_h1,
        seo_title = excluded.seo_title,
        seo_description = excluded.seo_description,
        seo_text = excluded.seo_text,
        updated_at = now()
      returning id, region_id, category_id, seo_h1, seo_title, seo_description, seo_text
      `,
      [
        region_id,
        category_id,
        seo_h1 ?? null,
        seo_title ?? null,
        seo_description ?? null,
        seo_text ?? null,
      ]
    );

    return res.json({ ok: true, item: r.rows[0] });
  })
);

app.delete(
  "/admin/product-category-region-seo",
  requireAuth,
  aw(async (req, res) => {
    const region_id = Number(req.query.region_id);
    const category_id = Number(req.query.category_id);

    if (!Number.isFinite(region_id) || region_id <= 0) {
      return res.status(400).json({ ok: false, error: "bad_region_id" });
    }
    if (!Number.isFinite(category_id) || category_id <= 0) {
      return res.status(400).json({ ok: false, error: "bad_category_id" });
    }

    await pool.query(
      `delete from product_category_region_seo
       where region_id=$1 and category_id=$2`,
      [region_id, category_id]
    );

    return res.json({ ok: true });
  })
);

/* =========================================================
   PUBLIC REGION -> SERVICES
========================================================= */
app.get(
  "/public/region/:region/services",
  aw(async (req, res) => {
    const regionSlug = String(req.params.region || "").trim();
    if (!regionSlug) return res.status(400).json({ ok: false, error: "bad_region" });

    const region = await getRegionBySlugOr404(res, regionSlug);
    if (!region) return;

    // ✅ NEW: опциональные фильтры
    const categorySlug = String(req.query.category_slug || req.query.category || "").trim() || "";

    const categoryIdRaw = req.query.category_id;
    const categoryId =
      categoryIdRaw !== undefined && categoryIdRaw !== null && String(categoryIdRaw).trim()
        ? Number(categoryIdRaw)
        : null;

    // 1) фильтр по дереву category_id
    // ✅ показываем если есть компании в регионе ИЛИ s.show_on_site=true
    if (categoryId && Number.isFinite(categoryId) && categoryId > 0) {
      const r = await pool.query(
        `
        WITH RECURSIVE tree AS (
          SELECT id FROM service_categories WHERE id = $2
          UNION ALL
          SELECT c2.id
          FROM service_categories c2
          JOIN tree t ON c2.parent_id = t.id
        )
        select
          s.id,
          s.slug,
          s.name,
          s.default_unit,
          sc.slug as category_slug,
          sc.name as category_name,

          count(distinct c.id)::int as companies_count,
          min(ci.price_min) filter (where ci.price_min is not null) as price_min,
          'RUB'::text as currency,

          coalesce(
            nullif(s.cover_image,''),
            max(
              case
                when jsonb_typeof(ci.photos)='array' and jsonb_array_length(ci.photos) > 0
                  then nullif(ci.photos->>0,'')
                else null
              end
            )
          ) as image_url

        from services_catalog s
        left join service_categories sc on sc.id = s.category_id
        left join company_items ci
          on ci.kind='service' and ci.service_id = s.id
        left join companies c
          on c.id = ci.company_id and c.region_id = $1

        where s.category_id in (select id from tree)

        group by
          s.id, s.slug, s.name, s.default_unit,
          sc.slug, sc.name,
          s.cover_image,
          s.show_on_site

        having
          count(distinct c.id) > 0
          or s.show_on_site = true

        order by
          sc.name asc nulls last,
          s.name asc
        `,
        [region.id, categoryId]
      );

      return res.json({ ok: true, region, services: r.rows });
    }

    // 2) фильтр по category_slug
    if (categorySlug) {
      const r = await pool.query(
        `
        select
          s.id,
          s.slug,
          s.name,
          s.default_unit,
          sc.slug as category_slug,
          sc.name as category_name,

          count(distinct c.id)::int as companies_count,
          min(ci.price_min) filter (where ci.price_min is not null) as price_min,
          'RUB'::text as currency,

          coalesce(
            nullif(s.cover_image,''),
            max(
              case
                when jsonb_typeof(ci.photos)='array' and jsonb_array_length(ci.photos) > 0
                  then nullif(ci.photos->>0,'')
                else null
              end
            )
          ) as image_url

        from services_catalog s
        left join service_categories sc on sc.id = s.category_id
        left join company_items ci
          on ci.kind='service' and ci.service_id = s.id
        left join companies c
          on c.id = ci.company_id and c.region_id = $1

        where sc.slug = $2

        group by
          s.id, s.slug, s.name, s.default_unit,
          sc.slug, sc.name,
          s.cover_image,
          s.show_on_site

        having
          count(distinct c.id) > 0
          or s.show_on_site = true

        order by
          s.name asc
        `,
        [region.id, categorySlug]
      );

      return res.json({ ok: true, region, services: r.rows });
    }

    // 3) без фильтра (как было), но оставляем having show_on_site
    const r = await pool.query(
      `
      select
        s.id,
        s.slug,
        s.name,
        s.default_unit,
        sc.slug as category_slug,
        sc.name as category_name,

        count(distinct c.id)::int as companies_count,
        min(ci.price_min) filter (where ci.price_min is not null) as price_min,
        'RUB'::text as currency,

        coalesce(
          nullif(s.cover_image,''),
          max(
            case
              when jsonb_typeof(ci.photos)='array' and jsonb_array_length(ci.photos) > 0
                then nullif(ci.photos->>0,'')
              else null
            end
          )
        ) as image_url

      from services_catalog s
      left join service_categories sc on sc.id = s.category_id
      left join company_items ci
        on ci.kind='service' and ci.service_id = s.id
      left join companies c
        on c.id = ci.company_id and c.region_id = $1

      group by
        s.id, s.slug, s.name, s.default_unit,
        sc.slug, sc.name,
        s.cover_image,
        s.show_on_site

      having
        count(distinct c.id) > 0
        or s.show_on_site = true

      order by
        sc.name asc nulls last,
        s.name asc
      `,
      [region.id]
    );

    return res.json({ ok: true, region, services: r.rows });
  })
);


app.get(
  "/public/region/:region/services/:slug",
  aw(async (req, res) => {
    const regionSlug = String(req.params.region || "").trim();
    const serviceSlug = String(req.params.slug || "").trim();

    if (!regionSlug || !serviceSlug) {
      return res.status(400).json({ ok: false, error: "bad_request" });
    }

    const region = await getRegionBySlugOr404(res, regionSlug);
    if (!region) return;

    const sr = await pool.query(
      `
      select
        s.id,
        s.slug,
        s.name,
        s.default_unit,
        s.lead_form_key,
        s.synonyms,
        s.seo_title_template,
        s.seo_description_template,
        s.faq_template,
        sc.slug as category_slug,
        sc.name as category_name,
        s.description,
        s.cover_image,
        s.gallery,
        s.seo_h1,
        s.seo_title,
        s.seo_description,
        s.seo_text,

        coalesce(
          nullif(s.cover_image,''),
          (
            select min(ci.photos->>0)
            from company_items ci
            join companies c on c.id = ci.company_id
            where ci.kind = 'service'
              and ci.service_id = s.id
              and c.region_id = $2
              and ci.photos is not null
              and jsonb_typeof(ci.photos) = 'array'
              and ci.photos->>0 is not null
              and length(ci.photos->>0) > 0
          )
        ) as image_url

      from services_catalog s
      left join service_categories sc on sc.id = s.category_id
      where s.slug = $1 
        and (
          s.show_on_site = true
          or exists (
            -- Показываем услугу, если есть хотя бы одна компания в этом регионе, которая её оказывает
            select 1
            from company_items ci
            join companies c on c.id = ci.company_id
            where ci.service_id = s.id
              and ci.kind = 'service'
              and c.region_id = $2
          )
        )
      limit 1
      `,
      [serviceSlug, region.id]
    );

    if (!sr.rowCount) return res.status(404).json({ ok: false, error: "service_not_found" });
    const service = sr.rows[0];

    const d = String(service.description ?? "").trim();
    service.short_description = d ? (d.length > 240 ? d.slice(0, 240).trim() + "…" : d) : null;

    service.seo = {
      h1: String(service.seo_h1 ?? "").trim() || null,
      title: String(service.seo_title ?? "").trim() || null,
      description: String(service.seo_description ?? "").trim() || null,
      text: String(service.seo_text ?? "").trim() || null,
    };

    const cr = await pool.query(
      `
      select
        c.id,
        c.name,
        c.logo_url,
        c.address,
        c.description,
        c.is_verified,
        c.rating,
        c.reviews_count,
        c.photos as photos,

        min(ci.price_min) filter (where ci.price_min is not null) as price_min,
        null::numeric as price_max,
        'RUB'::text as currency,
        count(ci.id)::int as items_count

      from companies c
      join company_items ci on ci.company_id = c.id
      where c.region_id = $1
        and ci.kind = 'service'
        and ci.service_id = $2

      group by
        c.id, c.name, c.logo_url, c.address, c.description,
        c.is_verified, c.rating, c.reviews_count, c.photos

      order by
        c.is_verified desc,
        c.rating desc nulls last,
        c.reviews_count desc nulls last,
        price_min asc nulls last,
        c.id desc
      limit 200
      `,
      [region.id, service.id]
    );

    // Если компаний 0, мы всё равно возвращаем ok: true и данные услуги
    return res.json({ ok: true, region, service, companies: cr.rows });
  })
);
/* =========================================================
   AUTH
========================================================= */




// POST /products
app.post(
  "/products",
  aw(async (req, res) => {
    try {
      const name = sanitizeText(req.body?.name, 500);
      const slugRaw = cleanStr(req.body?.slug);
      const categoryId = Number(req.body?.category_id || 0);

      if (!name) return res.status(400).json({ ok: false, error: "bad_name" });
      if (!Number.isFinite(categoryId) || categoryId <= 0)
        return res.status(400).json({ ok: false, error: "bad_category_id" });

      const c = await pool.query("select slug from product_categories where id=$1", [categoryId]);
      const category = c.rows?.[0]?.slug || "general";

      const slugBase = slugifyRu(slugRaw || name);
      if (!slugBase) return res.status(400).json({ ok: false, error: "bad_slug" });

      const dupeName = await pool.query(
        "select id from products where lower(trim(name))=lower(trim($1)) limit 1",
        [name]
      );
      if (dupeName.rowCount) return res.status(409).json({ ok: false, error: "name_exists" });

      let slug = slugBase;
      for (let i = 0; i < 50; i++) {
        const dupe = await pool.query("select id from products where slug=$1 limit 1", [slug]);
        if (!dupe.rowCount) break;
        slug = `${slugBase}-${i + 1}`;
      }

      const description = sanitizeText(req.body?.description, 50000);
      const cover_image = cleanStr(req.body?.cover_image);
      let specs = undefined;
      if (req.body?.specs !== undefined) specs = normalizeSpecs(req.body?.specs);
      const seo_h1 = sanitizeText(req.body?.seo_h1, 300);
      const seo_title = sanitizeText(req.body?.seo_title, 700);
      const seo_description = sanitizeText(req.body?.seo_description, 1500);
      const seo_text = sanitizeText(req.body?.seo_text, 50000);

      const ins = await pool.query(
        `insert into products (name, slug, category, category_id, description, cover_image, specs, seo_h1, seo_title, seo_description, seo_text, show_on_site)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
         returning id, name, slug, category, category_id`,
        [
          name,
          slug,
          category,
          categoryId,
          description ?? null,
          cover_image ?? null,
          specs ? JSON.stringify(specs) : null,
          seo_h1 ?? null,
          seo_title ?? null,
          seo_description ?? null,
          seo_text ?? null,
        ]
      );

      res.json({ ok: true, item: ins.rows[0] });
    } catch (e) {
      console.error("POST /products failed", e);
      res.status(500).json({ ok: false, error: "products_create_failed" });
    }
  })
);

app.post(
  "/auth/register",
  aw(async (req, res) => {
    try {
      const { email, password, company_name, region_slug } = req.body || {};

      if (!isEmail(email)) return res.status(400).json({ ok: false, error: "invalid_email" });
      if (typeof password !== "string" || password.length < 8)
        return res.status(400).json({ ok: false, error: "password_min_8" });
      if (typeof company_name !== "string" || company_name.trim().length < 2)
        return res.status(400).json({ ok: false, error: "invalid_company_name" });
      if (typeof region_slug !== "string" || !region_slug.trim())
        return res.status(400).json({ ok: false, error: "invalid_region" });

      const r1 = await pool.query("SELECT id, name, slug FROM regions WHERE slug=$1 LIMIT 1", [
        region_slug,
      ]);
      if (!r1.rowCount) return res.status(400).json({ ok: false, error: "region_not_found" });
      const region = r1.rows[0];

      const r2 = await pool.query("SELECT id FROM company_users WHERE email=$1 LIMIT 1", [
        email.toLowerCase(),
      ]);
      if (r2.rowCount) return res.status(409).json({ ok: false, error: "email_exists" });

      const c = await pool.query(
        `INSERT INTO companies (name, region_id, is_verified, rating, reviews_count)
         VALUES ($1, $2, false, 0, 0)
         RETURNING id, name, region_id`,
        [company_name.trim(), region.id]
      );
      const company = c.rows[0];

      const password_hash = await bcrypt.hash(password, 12);
      const u = await pool.query(
        `INSERT INTO company_users (company_id, email, password_hash, role)
         VALUES ($1, $2, $3, 'owner')
         RETURNING id, email, role, company_id`,
        [company.id, email.toLowerCase(), password_hash]
      );
      const user = u.rows[0];

      const token = signToken({ sub: user.id, company_id: user.company_id, role: user.role });
      setAuthCookie(res, token);

      return res.json({
        ok: true,
        user,
        company: { ...company, region_slug: region.slug, region_name: region.name },
      });
    } catch (e) {
      console.error("register error", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  })
);

app.post(
  "/auth/register-company",
  aw(async (req, res) => {
    try {
      const { companyName, email, password, region_slug } = req.body || {};

      if (!companyName || String(companyName).trim().length < 2)
        return res.status(400).json({ ok: false, error: "invalid_company_name" });
      if (!isEmail(email)) return res.status(400).json({ ok: false, error: "invalid_email" });
      if (typeof password !== "string" || password.length < 8)
        return res.status(400).json({ ok: false, error: "password_min_8" });

      let region = null;
      if (region_slug && String(region_slug).trim()) {
        const r1 = await pool.query("SELECT id, name, slug FROM regions WHERE slug=$1 LIMIT 1", [
          String(region_slug).trim(),
        ]);
        region = r1.rows[0] || null;
        if (!region) return res.status(400).json({ ok: false, error: "region_not_found" });
      } else {
        const r1 = await pool.query("SELECT id, name, slug FROM regions ORDER BY id LIMIT 1");
        region = r1.rows[0] || null;
        if (!region) return res.status(500).json({ ok: false, error: "no_regions" });
      }

      const r2 = await pool.query("SELECT id FROM company_users WHERE email=$1 LIMIT 1", [
        String(email).toLowerCase(),
      ]);
      if (r2.rowCount) return res.status(409).json({ ok: false, error: "email_exists" });

      const c = await pool.query(
        `INSERT INTO companies (name, region_id, is_verified, rating, reviews_count)
         VALUES ($1, $2, false, 0, 0)
         RETURNING id, name, region_id`,
        [String(companyName).trim(), region.id]
      );
      const company = c.rows[0];

      const password_hash = await bcrypt.hash(String(password), 12);
      const u = await pool.query(
        `INSERT INTO company_users (company_id, email, password_hash, role)
         VALUES ($1, $2, $3, 'owner')
         RETURNING id, email, role, company_id`,
        [company.id, String(email).toLowerCase(), password_hash]
      );
      const user = u.rows[0];

      const emailToken = signEmailToken({
        sub: user.id,
        company_id: user.company_id,
        email: user.email,
        type: "email_verify",
      });
      const verifyUrl = `${API_BASE_URL}/auth/verify-email?token=${encodeURIComponent(emailToken)}`;
      const subject = "Подтверждение регистрации компании";
      const text = `Здравствуйте!\n\nВы зарегистрировали компанию "${company.name}". Подтвердите email по ссылке:\n${verifyUrl}\n\nЕсли это были не вы, просто проигнорируйте письмо.`;
      const html = `<p>Здравствуйте!</p>
<p>Вы зарегистрировали компанию <strong>${company.name}</strong>. Подтвердите email по ссылке:</p>
<p><a href="${verifyUrl}">${verifyUrl}</a></p>
<p>Если это были не вы, просто проигнорируйте письмо.</p>`;

      let emailSent = false;
      try {
        const sendResult = await sendEmail({ to: user.email, subject, text, html });
        emailSent = sendResult.ok;
      } catch (e) {
        console.error("register-company email failed", e);
        emailSent = false;
      }

      return res.json({
        ok: true,
        user,
        company: { ...company, region_slug: region.slug, region_name: region.name },
        email_sent: emailSent,
      });
    } catch (e) {
      console.error("register-company error", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  })
);

app.get(
  "/auth/verify-email",
  aw(async (req, res) => {
    const token = String(req.query?.token || "");
    if (!token) return res.status(400).send("Missing token");

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (!payload || payload.type !== "email_verify") {
        return res.status(400).send("Invalid token");
      }

      const userId = Number(payload.sub);
      const companyId = Number(payload.company_id);
      if (!Number.isFinite(userId) || !Number.isFinite(companyId)) {
        return res.status(400).send("Invalid token");
      }

      const r = await pool.query(
        "SELECT company_id FROM company_users WHERE id=$1 LIMIT 1",
        [userId]
      );
      const userCompanyId = Number(r.rows?.[0]?.company_id || 0);
      if (!r.rowCount || userCompanyId !== companyId) {
        return res.status(400).send("Invalid token");
      }

      await pool.query("UPDATE companies SET is_verified=true WHERE id=$1", [companyId]);

      return res.redirect(`${ADMIN_BASE_URL}/login?verified=1`);
    } catch (e) {
      console.error("verify-email error", e);
      return res.status(400).send("Invalid or expired token");
    }
  })
);

app.post(
  "/auth/login",
  aw(async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!isEmail(email)) return res.status(400).json({ ok: false, error: "invalid_email" });
      if (typeof password !== "string")
        return res.status(400).json({ ok: false, error: "invalid_password" });

      const r = await pool.query(
        `SELECT u.id, u.email, u.password_hash, u.role, u.company_id,
                c.name as company_name, c.is_verified,
                rg.slug as region_slug, rg.name as region_name
         FROM company_users u
         JOIN companies c ON c.id = u.company_id
         JOIN regions rg ON rg.id = c.region_id
         WHERE u.email=$1
         LIMIT 1`,
        [email.toLowerCase()]
      );

      if (!r.rowCount) return res.status(401).json({ ok: false, error: "bad_credentials" });

      const row = r.rows[0];
      const ok = await bcrypt.compare(password, row.password_hash);
      if (!ok) return res.status(401).json({ ok: false, error: "bad_credentials" });

      if (!row.is_verified) {
        return res.status(403).json({ ok: false, error: "email_not_verified" });
      }

      const token = signToken({ sub: row.id, company_id: row.company_id, role: row.role });
      setAuthCookie(res, token);

      return res.json({
        ok: true,
        user: { id: row.id, email: row.email, role: row.role, company_id: row.company_id },
        company: {
          id: row.company_id,
          name: row.company_name,
          is_verified: row.is_verified,
          region_slug: row.region_slug,
          region_name: row.region_name,
        },
      });
    } catch (e) {
      console.error("login error", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  })
);

app.post("/auth/logout", (_req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

app.get(
  "/auth/me",
  authMiddleware,
  aw(async (req, res) => {
    const uid = req.user?.sub;
    const r = await pool.query(
      `SELECT u.id, u.email, u.role, u.company_id,
              c.name as company_name, c.is_verified,
              rg.slug as region_slug, rg.name as region_name
       FROM company_users u
       JOIN companies c ON c.id = u.company_id
       JOIN regions rg ON rg.id = c.region_id
       WHERE u.id=$1
       LIMIT 1`,
      [uid]
    );
    if (!r.rowCount) return res.status(401).json({ ok: false, error: "unauthorized" });

    const row = r.rows[0];
    return res.json({
      ok: true,
      user: { id: row.id, email: row.email, role: row.role, company_id: row.company_id },
      company: {
        id: row.company_id,
        name: row.company_name,
        is_verified: row.is_verified,
        region_slug: row.region_slug,
        region_name: row.region_name,
      },
    });
  })
);

/* =========================================================
   COMPANY PROFILE (AUTH) — единая точка: /company/profile
========================================================= */
let companiesProfileColsPromise = null;

async function getCompaniesProfileCols() {
  if (!companiesProfileColsPromise) {
    companiesProfileColsPromise = pool
      .query(
        `
        select column_name
        from information_schema.columns
        where table_schema = 'public' and table_name = 'companies'
      `
      )
      .then((r) => new Set(r.rows.map((x) => String(x.column_name).toLowerCase())));
  }
  return companiesProfileColsPromise;
}

function pickCompanyProfileCol(colsSet, preferred) {
  for (const c of preferred) {
    const key = String(c).toLowerCase();
    if (colsSet.has(key)) return key;
  }
  return null;
}

let companyProfileMappingCache = null;

async function companyProfileMapping() {
  if (companyProfileMappingCache) return companyProfileMappingCache;
  const cols = await getCompaniesProfileCols();

  const map = {
    website: pickCompanyProfileCol(cols, ["website_url", "website", "site", "url"]),
    description: pickCompanyProfileCol(cols, ["description", "about", "descr", "details", "text"]),
    photos: pickCompanyProfileCol(cols, ["photos", "gallery", "images"]),
  };

  companyProfileMappingCache = map;
  return map;
}

function companyProfileSelect(dbCol, alias) {
  if (!dbCol) return `NULL as ${alias}`;
  if (alias && dbCol !== alias) return `${dbCol} as ${alias}`;
  return dbCol;
}

app.get(
  "/company/profile",
  requireAuth,
  aw(async (req, res) => {
    const companyId = Number(req.user?.company_id);
    const m = await companyProfileMapping();
    const r = await pool.query(
      `SELECT id, name, is_verified,
              phone, address, work_hours,
              ${companyProfileSelect(m.description, "description")},
              ${companyProfileSelect(m.photos, "photos")},
              ${companyProfileSelect(m.website, "website_url")},
              vk_url, tg_url, youtube_url,
              logo_url
       FROM companies
       WHERE id=$1
       LIMIT 1`,
      [companyId]
    );
    if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({ ok: true, company: r.rows[0] });
  })
);

app.patch(
  "/company/profile",
  requireAuth,
  aw(async (req, res) => {
    const companyId = Number(req.user?.company_id);
    const m = await companyProfileMapping();
    const b = req.body || {};

    const name = cleanStr(b.name);
    const phone = cleanStr(b.phone);
    const address = cleanStr(b.address);
    const work_hours = cleanStr(b.work_hours);
    const description = b.description !== undefined ? sanitizeText(b.description, 5000) : undefined;

    const website_url = b.website_url === undefined ? undefined : cleanUrl(b.website_url);
    const vk_url = b.vk_url === undefined ? undefined : cleanUrl(b.vk_url);
    const tg_url = b.tg_url === undefined ? undefined : cleanUrl(b.tg_url);
    const youtube_url = b.youtube_url === undefined ? undefined : cleanUrl(b.youtube_url);

    let newLogoUrl = undefined;
    if (b.logo_base64 !== undefined) {
      if (b.logo_base64 === null || b.logo_base64 === "") {
        newLogoUrl = null;
      } else {
        const parsed = parseDataUrlBase64(b.logo_base64);
        if (!parsed) return res.status(400).json({ ok: false, error: "bad_logo_base64" });

        const ext = extFromMime(parsed.mime, String(b.logo_filename || ""));
        const fname = `company-${companyId}-${Date.now()}.${ext}`;
        const fpath = path.join(UPLOAD_DIR, fname);

        const buf = Buffer.from(parsed.b64, "base64");
        if (buf.length > 3 * 1024 * 1024) {
          return res.status(400).json({ ok: false, error: "logo_too_large" });
        }
        fs.writeFileSync(fpath, buf);
        newLogoUrl = `/uploads/${fname}`;
      }
    }

    const sets = [];
    const vals = [];
    const put = (col, v) => {
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    };
    const putJsonb = (col, v) => {
      if (!col) return;
      if (v === undefined) return;
      if (v === null) {
        vals.push(null);
        sets.push(`${col} = $${vals.length}::jsonb`);
        return;
      }
      vals.push(JSON.stringify(v));
      sets.push(`${col} = $${vals.length}::jsonb`);
    };

    if (name !== undefined) put("name", name);
    if (phone !== undefined) put("phone", phone);
    if (address !== undefined) put("address", address);
    if (work_hours !== undefined) put("work_hours", work_hours);
    if (description !== undefined && m.description) put(m.description, description);

    if (website_url !== undefined && m.website) put(m.website, website_url);
    if (vk_url !== undefined) put("vk_url", vk_url);
    if (tg_url !== undefined) put("tg_url", tg_url);
    if (youtube_url !== undefined) put("youtube_url", youtube_url);

    if (newLogoUrl !== undefined) put("logo_url", newLogoUrl);

    const keepPhotosRaw = b.photos_keep;
    const photosKeep =
      keepPhotosRaw === undefined
        ? undefined
        : Array.isArray(keepPhotosRaw)
        ? keepPhotosRaw
        : typeof keepPhotosRaw === "string"
        ? keepPhotosRaw.split("\n").map((x) => x.trim()).filter(Boolean)
        : [];

    const newPhotos = await (async () => {
      const list = normalizeListInput(b.photos_base64);
      if (list === undefined) return undefined;
      if (list === null) return [];
      if (list.length > 40) {
        const err = new Error("too_many_photos");
        err.statusCode = 400;
        throw err;
      }
      const names = normalizeFilenamesInput(b.photos_filenames);
      const urls = [];
      const MAX_BYTES = 3 * 1024 * 1024;
      for (let i = 0; i < list.length; i++) {
        const saved = await saveDataUrlImage({
          companyId,
          prefix: "company-photo",
          dataUrl: list[i],
          filenameHint: names[i] || `photo-${i + 1}.jpg`,
          maxBytes: MAX_BYTES,
        });
        if (!saved.ok) {
          const err = new Error(saved.error || "bad_photo");
          err.statusCode = 400;
          throw err;
        }
        urls.push(saved.url);
      }
      return urls;
    })();

    if (photosKeep !== undefined || newPhotos !== undefined) {
      const base = Array.isArray(photosKeep) ? photosKeep : [];
      const merged = newPhotos === undefined ? base : [...base, ...newPhotos];
      if (merged.length > 40) {
        return res.status(400).json({ ok: false, error: "too_many_photos" });
      }
      putJsonb(m.photos, merged);
    }

    if (!sets.length) {
      const r0 = await pool.query(
        `SELECT id, name, is_verified, phone, address, work_hours,
                ${companyProfileSelect(m.description, "description")},
                ${companyProfileSelect(m.photos, "photos")},
                ${companyProfileSelect(m.website, "website_url")},
                vk_url, tg_url, youtube_url, logo_url
         FROM companies WHERE id=$1 LIMIT 1`,
        [companyId]
      );
      return res.json({ ok: true, company: r0.rows[0] });
    }

    vals.push(companyId);
    const q = `
      UPDATE companies
      SET ${sets.join(", ")}
      WHERE id = $${vals.length}
      RETURNING id, name, is_verified,
                phone, address, work_hours,
                ${companyProfileSelect(m.description, "description")},
                ${companyProfileSelect(m.photos, "photos")},
                ${companyProfileSelect(m.website, "website_url")},
                vk_url, tg_url, youtube_url,
                logo_url
    `;
    const r = await pool.query(q, vals);
    return res.json({ ok: true, company: r.rows[0] });
  })
);

/* =========================================================
   COMPANY: UPLOAD IMAGE
   POST /company/upload-image
   body: { dataUrl, filename, prefix }
========================================================= */
app.post(
  "/company/upload-image",
  requireAuth,
  aw(async (req, res) => {
    const dataUrl = req.body?.dataUrl;
    const filename = req.body?.filename || "image.jpg";
    const prefixRaw = String(req.body?.prefix || "company").trim();

    if (!dataUrl) return res.status(400).json({ ok: false, error: "no_dataUrl" });

    const prefix = prefixRaw.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60) || "company";
    const saved = await saveDataUrlImageAsWebp({
      prefix,
      dataUrl,
      filenameHint: filename,
      maxBytes: 5 * 1024 * 1024,
    });

    if (!saved.ok) return res.status(400).json({ ok: false, error: saved.error || "upload_failed" });
    return res.json({ ok: true, url: saved.url });
  })
);

/* =========================================================
   COMPANIES (public)
========================================================= */
function normalizeReviewText(v, maxLen = 2000) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().replace(/\s+/g, " ");
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function hasLinks(s) {
  const t = String(s || "");
  if (!t) return false;

  // 1) явные ссылки
  if (/(https?:\/\/|www\.)/i.test(t)) return true;

  // 2) t.me / telegram / vk короткие варианты
  if (/\b(t\.me\/|telegram\.me\/|vk\.com\/|wa\.me\/)\S+/i.test(t)) return true;

  // 3) домены вида example.ru / example.com (с пробелами/скобками тоже)
  if (/\b[a-z0-9-]{2,}\.(ru|com|net|org|info|io|biz|me|site|online|store|pro|app|dev)\b/i.test(t))
    return true;

  return false;
}

app.get(
  "/public/companies/:id/reviews",
  aw(async (req, res) => {
    const companyId = Number(req.params.id);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return res.status(400).json({ ok: false, error: "bad_company_id" });
    }

    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20) || 20));
    const offset = Math.max(0, Number(req.query.offset || 0) || 0);

    const itemsR = await pool.query(
      `
      select
        id,
        rating,
        text,
        created_at
      from company_reviews
      where company_id = $1
        and is_hidden = false
      order by created_at desc, id desc
      limit $2 offset $3
      `,
      [companyId, limit, offset]
    );

const statsR = await pool.query(
  `
  select
    count(*)::int as total_count,
    count(*) filter (where nullif(trim(coalesce(text, '')), '') is null)::int as ratings_count,
    count(*) filter (where nullif(trim(coalesce(text, '')), '') is not null)::int as reviews_count,
    coalesce(round(avg(rating)::numeric, 2), 0) as rating_avg
  from company_reviews
  where company_id = $1
    and is_hidden = false
  `,
  [companyId]
);


    return res.json({
      ok: true,
      company_id: companyId,
      stats: statsR.rows[0],
      items: itemsR.rows,
    });
  })
);

app.post(
  "/public/companies/:id/reviews",
  aw(async (req, res) => {
    const companyId = Number(req.params.id);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return res.status(400).json({ ok: false, error: "bad_company_id" });
    }

    const rating = Number(req.body?.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ ok: false, error: "bad_rating" });
    }

    const text = normalizeReviewText(req.body?.text, 2000);
    if (text && hasLinks(text)) {
      return res.status(400).json({ ok: false, error: "links_not_allowed" });
    }

    // антиспам (минимальный): 1 отзыв в сутки с одного IP на одну компанию
    const ip = req.ip || null;
    const ua = String(req.headers["user-agent"] || "").slice(0, 300) || null;

    if (ip) {
      const spamR = await pool.query(
        `
        select count(*)::int as cnt
        from company_reviews
        where company_id = $1
          and author_ip = $2::inet
          and created_at > now() - interval '24 hours'
        `,
        [companyId, ip]
      );
      if ((spamR.rows?.[0]?.cnt || 0) >= 1) {
        return res.status(429).json({ ok: false, error: "too_many_reviews" });
      }
    }

    // транзакция: вставили отзыв -> пересчитали рейтинг/кол-во -> обновили companies
    const client = await pool.connect();
    try {
      await client.query("begin");

      const ins = await client.query(
        `
        insert into company_reviews (company_id, rating, text, author_ip, user_agent)
        values ($1, $2, $3, $4::inet, $5)
        returning id, rating, text, created_at
        `,
        [companyId, Math.trunc(rating), text, ip, ua]
      );

const stats = await client.query(
  `
  select
    count(*)::int as total_count,
    count(*) filter (where nullif(trim(coalesce(text, '')), '') is null)::int as ratings_count,
    count(*) filter (where nullif(trim(coalesce(text, '')), '') is not null)::int as reviews_count,
    coalesce(round(avg(rating)::numeric, 2), 0) as rating_avg
  from company_reviews
  where company_id = $1
    and is_hidden = false
  `,
  [companyId]
);



await client.query(
  `
  update companies
  set
    reviews_count = $2,
    rating = $3
  where id = $1
  `,
  [companyId, stats.rows[0].total_count, stats.rows[0].rating_avg]
);



      await client.query("commit");

      return res.json({
        ok: true,
        item: ins.rows[0],
        stats: stats.rows[0],
      });
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      client.release();
    }
  })
);


app.get(
  "/companies",
  aw(async (req, res) => {
    const { region_slug, service_slug, sort = "rating" } = req.query;

    const params = [];
    let where = "where 1=1";

    if (region_slug) {
      params.push(region_slug);
      where += ` and r.slug = $${params.length}`;
    }
    if (service_slug) {
      params.push(service_slug);
      where += ` and s.slug = $${params.length}`;
    }

    const order =
      sort === "price"
        ? "order by min(ci.price_min) asc nulls last, c.rating desc nulls last, c.id desc"
        : "order by c.rating desc nulls last, c.reviews_count desc nulls last, c.id desc";

    const sql = `
      select
        c.id, c.name, c.rating, c.reviews_count, c.is_verified,
        r.slug as region_slug,
        min(ci.price_min) filter (where ci.kind='service') as price_min
      from companies c
      join regions r on r.id = c.region_id
      left join company_items ci on ci.company_id = c.id
      left join services_catalog s on s.id = ci.service_id
      ${where}
      group by c.id, r.slug
      ${order}
      limit 50
    `;

    const r = await pool.query(sql, params);
    res.json({ ok: true, items: r.rows });
  })
);

app.get(
  "/companies/:id",
  aw(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "bad_id" });

    const companyR = await pool.query(
      `
select
  c.id,
  c.name,
  c.rating,
  c.reviews_count,
  c.is_verified,

  c.phone,
  c.address,
  c.work_hours,
  c.vk_url,
  c.tg_url,
  c.youtube_url,
  c.logo_url,

  c.description,              -- ✅ ДОБАВИЛИ
  c.description as about,     -- ✅ чтобы твой фронт мог читать company.about (если он так ожидает)
	c.photos,
  r.id   as region_id,
  r.name as region_name,
  r.slug as region_slug
from companies c
join regions r on r.id = c.region_id
where c.id=$1
limit 1
      `,
      [id]
    );

    if (!companyR.rows.length) return res.status(404).json({ ok: false, error: "not_found" });

const itemsR = await pool.query(
  `
  select
    ci.id,
    ci.kind,
    ci.service_id,
    ci.product_id,
    ci.price_min,
    ci.price_max,
    ci.currency,

    s.name as service_name,
    s.slug as service_slug,
    s.cover_image as service_image_url,
    sc.name as service_category_name,

    p.name as product_name,
    p.slug as product_slug,
    p.cover_image as product_image_url,
    pc.path_name as product_category_path,

    ci.custom_title,
    ci.description,

    -- ✅ ВАЖНО: фото для товара — из products.gallery (как на странице товара)
    case
      when ci.kind = 'product' then p.gallery
      else ci.photos
    end as photos

  from company_items ci
  left join services_catalog s on s.id = ci.service_id
  left join service_categories sc on sc.id = s.category_id
  left join products p on p.id = ci.product_id
  left join product_categories pc on pc.id = p.category_id
  where ci.company_id=$1
  order by ci.kind asc, coalesce(s.name, p.name, ci.custom_title) asc
  `,
  [id]
);


    res.json({ ok: true, company: companyR.rows[0], items: itemsR.rows });
  })
);

/* =========================================================
   COMPANY ITEMS (AUTH)
========================================================= */
app.get(
  "/company-items",
  requireAuth,
  aw(async (req, res) => {
    const companyId = Number(req.user?.company_id);
    if (!companyId) return res.status(401).json({ ok: false, error: "unauthorized" });

    const r = await pool.query(
      `
      SELECT
        ci.id,
        ci.kind,
        ci.service_id,
        ci.product_id,
        ci.price_min,
        ci.price_max,
        ci.currency,
        s.name AS service_name,
        s.slug AS service_slug,
        s.cover_image AS service_image_url,
        sc.name AS service_category_name,
        p.name AS product_name,
        p.slug AS product_slug,
        p.cover_image AS product_image_url,
        pc.path_name AS product_category_path,
        ci.custom_title,
        ci.description,
        ci.photos
      FROM company_items ci
      left join services_catalog s on s.id = ci.service_id
      left join service_categories sc on sc.id = s.category_id
      LEFT JOIN products p ON p.id = ci.product_id
      left join product_categories pc on pc.id = p.category_id
      WHERE ci.company_id = $1
      ORDER BY ci.kind ASC, COALESCE(s.name, p.name, ci.custom_title) ASC, ci.id DESC
      `,
      [companyId]
    );

    return res.json({ ok: true, items: r.rows });
  })
);

app.post(
  "/company-items",
  requireAuth,
  aw(async (req, res) => {
    const companyId = Number(req.user?.company_id);
    if (!companyId) return res.status(401).json({ ok: false, error: "unauthorized" });

    const b = req.body || {};
    const kind = normKind(pick(b, ["kind", "type"]));
    const currency = String(pick(b, ["currency"]) ?? "RUB");

    const price_min = toNumOrNull(pick(b, ["price_min", "priceMin"]));
    const price_max = toNumOrNull(pick(b, ["price_max", "priceMax"]));

    const description = sanitizeText(pick(b, ["description", "desc"]), 5000);

    if (!["service", "product", "custom"].includes(kind)) {
      return res.status(400).json({ ok: false, error: "bad_kind" });
    }

    let service_id = null;
    let product_id = null;
    let custom_title = null;

    if (kind === "service") {
      service_id = await resolveServiceId({
        service_id: pick(b, ["service_id", "serviceId"]),
        service_slug: pick(b, ["service_slug", "serviceSlug"]),
      });
      if (!service_id) return res.status(400).json({ ok: false, error: "bad_service_id" });
    } else if (kind === "product") {
      product_id = await resolveProductId({
        product_id: pick(b, ["product_id", "productId"]),
        product_slug: pick(b, ["product_slug", "productSlug"]),
      });
      if (!product_id) return res.status(400).json({ ok: false, error: "bad_product_id" });
    } else {
      custom_title = String(pick(b, ["custom_title", "customTitle", "title", "name"]) ?? "").trim();
      if (!custom_title) custom_title = "";
    }

    if (kind === "service" || kind === "product") {
      const rDup = await pool.query(
        `
        SELECT id
        FROM company_items
        WHERE company_id=$1 AND kind=$2 AND service_id IS NOT DISTINCT FROM $3 AND product_id IS NOT DISTINCT FROM $4
        LIMIT 1
        `,
        [companyId, kind, service_id, product_id]
      );
      if (rDup.rowCount) {
        return res.status(409).json({ ok: false, error: "already_exists" });
      }
    }

    const rIns = await pool.query(
      `
      INSERT INTO company_items
        (company_id, kind, service_id, product_id, custom_title, price_min, price_max, currency, description, photos)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
      RETURNING id, company_id, kind, service_id, product_id, custom_title, price_min, price_max, currency, description, photos
      `,
      [companyId, kind, service_id, product_id, custom_title, price_min, price_max, currency, description ?? null, "[]"]
    );

    const item = rIns.rows[0];

    const photosUrls = await saveImagesFromDataUrls({
      companyId,
      itemId: item.id,
      photos_base64: pick(b, ["photos_base64", "photosBase64"]),
      photos_filenames: pick(b, ["photos_filenames", "photosFilenames"]),
    });

    if (photosUrls !== undefined) {
      const rUp = await pool.query(
        `
        UPDATE company_items
        SET photos = $1::jsonb
        WHERE id = $2 AND company_id = $3
        RETURNING id, company_id, kind, service_id, product_id, custom_title,
                  price_min, price_max, currency, description, photos
        `,
        [JSON.stringify(photosUrls), item.id, companyId]
      );
      return res.json({ ok: true, item: rUp.rows[0] });
    }

    return res.json({ ok: true, item });
  })
);

app.patch(
  "/company-items/:id",
  requireAuth,
  aw(async (req, res) => {
    const companyId = Number(req.user?.company_id);
    const id = Number(req.params.id);
    if (!companyId || !id) return res.status(400).json({ ok: false, error: "bad_request" });

    const cur = await pool.query(
      "SELECT id, company_id, kind, service_id, product_id, custom_title, price_min, price_max, currency, description, photos FROM company_items WHERE id=$1 AND company_id=$2",
      [id, companyId]
    );
    if (!cur.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
    const prev = cur.rows[0];

    const b = req.body || {};

    const nextKindRaw = pick(b, ["kind", "type"]);
    const nextKind = nextKindRaw === undefined ? prev.kind : normKind(nextKindRaw);

    if (!["service", "product", "custom"].includes(nextKind)) {
      return res.status(400).json({ ok: false, error: "bad_kind" });
    }

    let service_id = prev.service_id;
    let product_id = prev.product_id;
    let custom_title = prev.custom_title;

    if (nextKind === "service") {
      const vId = pick(b, ["service_id", "serviceId"]);
      const vSlug = pick(b, ["service_slug", "serviceSlug"]);
      if (vId !== undefined || vSlug !== undefined) {
        const resolved = await resolveServiceId({ service_id: vId, service_slug: vSlug });
        if (!resolved) return res.status(400).json({ ok: false, error: "bad_service_id" });
        service_id = resolved;
      }
      product_id = null;
      custom_title = null;
    } else if (nextKind === "product") {
      const vId = pick(b, ["product_id", "productId"]);
      const vSlug = pick(b, ["product_slug", "productSlug"]);
      if (vId !== undefined || vSlug !== undefined) {
        const resolved = await resolveProductId({ product_id: vId, product_slug: vSlug });
        if (!resolved) return res.status(400).json({ ok: false, error: "bad_product_id" });
        product_id = resolved;
      }
      service_id = null;
      custom_title = null;
    } else {
      const v = pick(b, ["custom_title", "customTitle", "title", "name"]);
      if (v !== undefined) custom_title = String(v ?? "");
      service_id = null;
      product_id = null;
    }

    const description = sanitizeText(pick(b, ["description", "desc"]), 5000);

    const photosUrls = await saveImagesFromDataUrls({
      companyId,
      itemId: id,
      photos_base64: pick(b, ["photos_base64", "photosBase64"]),
      photos_filenames: pick(b, ["photos_filenames", "photosFilenames"]),
    });

    const price_min = toNumOrNull(pick(b, ["price_min", "priceMin"]));
    const price_max = toNumOrNull(pick(b, ["price_max", "priceMax"]));
    const currency =
      pick(b, ["currency"]) === undefined ? undefined : String(pick(b, ["currency"]) ?? "RUB");

    const sets = [];
    const vals = [];
    const put = (col, v) => {
      vals.push(v);
      sets.push(`${col}=$${vals.length}`);
    };

    if (nextKindRaw !== undefined) put("kind", nextKind);
    put("service_id", service_id);
    put("product_id", product_id);
    put("custom_title", custom_title);

    if (price_min !== undefined) put("price_min", price_min);
    if (price_max !== undefined) put("price_max", price_max);
    if (currency !== undefined) put("currency", currency);

    if (description !== undefined) put("description", description);
    if (photosUrls !== undefined) put("photos", JSON.stringify(photosUrls));

    if (!sets.length) {
      const r0 = await pool.query(
        `SELECT id, company_id, kind, service_id, product_id, custom_title,
                price_min, price_max, currency, description, photos
         FROM company_items
         WHERE id=$1 AND company_id=$2
         LIMIT 1`,
        [id, companyId]
      );
      return res.json({ ok: true, item: r0.rows[0] });
    }

    vals.push(id);
    vals.push(companyId);

    const q = `
      UPDATE company_items
      SET ${sets.join(", ")}
      WHERE id=$${vals.length - 1} AND company_id=$${vals.length}
      RETURNING id, company_id, kind, service_id, product_id, custom_title,
                price_min, price_max, currency, description, photos
    `;

    const r = await pool.query(q, vals);
    return res.json({ ok: true, item: r.rows[0] });
  })
);

app.delete(
  "/master/services/:id",
  requireMaster,
  aw(async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "bad_id" });

    // 1) exists?
    const exists = await pool.query(`select id, slug, name from services_catalog where id=$1 limit 1`, [id]);
    if (!exists.rowCount) return res.status(404).json({ ok: false, error: "not_found" });

    // 2) связи: company_items
    const ci = await pool.query(
      `select count(*)::int as cnt
       from company_items
       where kind='service' and service_id=$1`,
      [id]
    );

    // 3) связи: portfolio
    const pf = await pool.query(
      `select count(*)::int as cnt
       from company_portfolio
       where service_id=$1`,
      [id]
    );

    const ciCnt = Number(ci.rows?.[0]?.cnt || 0);
    const pfCnt = Number(pf.rows?.[0]?.cnt || 0);

    if (ciCnt > 0 || pfCnt > 0) {
      return res.status(409).json({
        ok: false,
        error: "service_in_use",
        refs: {
          company_items: ciCnt,
          company_portfolio: pfCnt,
        },
      });
    }

    // 4) delete
    const del = await pool.query(`delete from services_catalog where id=$1 returning id, slug, name`, [id]);
    return res.json({ ok: true, deleted: del.rows[0] });
  })
);


app.delete(
  "/company-items/:id",
  requireAuth,
  aw(async (req, res) => {
    const companyId = Number(req.user?.company_id);
    const id = Number(req.params.id);
    if (!companyId || !id) return res.status(400).json({ ok: false, error: "bad_request" });

    const r = await pool.query("DELETE FROM company_items WHERE id=$1 AND company_id=$2 RETURNING id", [
      id,
      companyId,
    ]);
    if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });

    return res.json({ ok: true });
  })
);

/* =========================================================
   HOME (public)
========================================================= */
app.get(
  "/home",
  aw(async (req, res) => {
    try {
      const regionSlug = String(req.query.region_slug || req.query.region || "").trim();

      let region = null;
      if (regionSlug) {
        const rr = await pool.query("SELECT id, slug, name FROM regions WHERE slug=$1 LIMIT 1", [regionSlug]);
        region = rr.rows[0] || null;
      }
      if (!region) {
        const rr = await pool.query("SELECT id, slug, name FROM regions ORDER BY id LIMIT 1");
        region = rr.rows[0] || null;
      }
      if (!region) return res.status(500).json({ ok: false, error: "no_regions" });

      const regionId = Number(region.id);

      const categories = (
        await pool.query(`
          SELECT DISTINCT category
          FROM (
            SELECT coalesce(category_slug,'') as category FROM services_catalog
            UNION ALL
            SELECT coalesce(category,'') as category FROM products
          ) t
          WHERE category IS NOT NULL AND category <> ''
          ORDER BY category
          LIMIT 12
        `)
      ).rows.map((r) => ({ slug: r.category, name: r.category }));

      const top_services = (
        await pool.query(
          `
          SELECT
            s.id, s.slug, s.name,
            coalesce(sc.name, s.category_slug, '') as category,
            COUNT(DISTINCT ci.company_id)::int AS companies_count,
            MIN(ci.price_min) FILTER (WHERE ci.price_min IS NOT NULL) AS price_min,

            coalesce(
              nullif(s.cover_image,''),
              max(
                case
                  when jsonb_typeof(ci.photos)='array' and jsonb_array_length(ci.photos) > 0
                    then nullif(ci.photos->>0,'')
                  else null
                end
              )
            ) as image_url,

            'RUB'::text AS currency
          FROM company_items ci
          JOIN companies c ON c.id = ci.company_id
          JOIN services_catalog s ON s.id = ci.service_id
          LEFT JOIN service_categories sc ON sc.id = s.category_id
          WHERE ci.kind = 'service' AND c.region_id = $1
          GROUP BY s.id, s.slug, s.name, category, s.cover_image
          ORDER BY companies_count DESC, price_min ASC NULLS LAST
          LIMIT 12
          `,
          [regionId]
        )
      ).rows;

      const top_products = (
        await pool.query(
          `
          SELECT
            p.id, p.slug, p.name, p.category,
            COUNT(DISTINCT ci.company_id)::int AS companies_count,
            MIN(ci.price_min) FILTER (WHERE ci.price_min IS NOT NULL) AS price_min,

            coalesce(
              nullif(p.cover_image,''),
              max(
                case
                  when jsonb_typeof(ci.photos)='array' and jsonb_array_length(ci.photos) > 0
                    then nullif(ci.photos->>0,'')
                  else null
                end
              )
            ) as image_url,

            'RUB'::text AS currency
          FROM company_items ci
          JOIN companies c ON c.id = ci.company_id
          JOIN products p ON p.id = ci.product_id
          WHERE ci.kind = 'product' AND c.region_id = $1
          GROUP BY p.id, p.slug, p.name, p.category, p.cover_image
          ORDER BY companies_count DESC, price_min ASC NULLS LAST
          LIMIT 12
          `,
          [regionId]
        )
      ).rows;

      const featured_companies = (
        await pool.query(
          `
          SELECT
            c.id, c.name, c.rating, c.reviews_count, c.is_verified,
            c.logo_url,
            MIN(ci.price_min) FILTER (WHERE ci.price_min IS NOT NULL) AS price_min,
            'RUB'::text AS currency
          FROM companies c
          LEFT JOIN company_items ci ON ci.company_id = c.id
          WHERE c.region_id = $1
          GROUP BY c.id
          ORDER BY c.is_verified DESC, c.rating DESC NULLS LAST, c.reviews_count DESC NULLS LAST, c.id DESC
          LIMIT 12
          `,
          [regionId]
        )
      ).rows;

      const best_deals = (
        await pool.query(
          `
          SELECT
            'service'::text AS kind,
            s.slug, s.name,
            MIN(ci.price_min) FILTER (WHERE ci.price_min IS NOT NULL) AS price_from,
            'RUB'::text AS currency
          FROM company_items ci
          JOIN companies c ON c.id = ci.company_id
          JOIN services_catalog s ON s.id = ci.service_id
          WHERE ci.kind='service' AND c.region_id=$1 AND ci.price_min IS NOT NULL
          GROUP BY s.slug, s.name
          ORDER BY price_from ASC
          LIMIT 6
          `,
          [regionId]
        )
      ).rows;

      const seo = {
        title: `Услуги и товары для дома в ${region.name} — MoyDomPro`,
        description: `Подбор подрядчиков по цене и рейтингу в регионе ${region.name}.`,
        h1: `Услуги и товары для дома в ${region.name}`,
      };

      return res.json({
        ok: true,
        region,
        categories,
        top_services,
        top_products,
        featured_companies,
        best_deals,
        seo,
      });
    } catch (e) {
      console.error("GET /home error:", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  })
);

/* =========================================================
   PORTFOLIO (public + auth) — без дублей путей
========================================================= */
app.get(
  "/companies/:id/portfolio",
  aw(async (req, res) => {
    const companyId = Number(req.params.id);
    if (!companyId) return res.status(400).json({ ok: false, error: "bad_request" });

    const r = await pool.query(
      `SELECT p.id, p.company_id, p.title, p.description, p.photos, p.service_id, p.product_id,
              s.name AS service_name, s.slug AS service_slug,
              pr.name AS product_name, pr.slug AS product_slug,
              p.created_at, p.updated_at
       FROM company_portfolio p
       LEFT JOIN services_catalog s ON s.id = p.service_id
       LEFT JOIN products pr ON pr.id = p.product_id
       WHERE p.company_id = $1
       ORDER BY p.id DESC`,
      [companyId]
    );

    return res.json({ ok: true, items: r.rows });
  })
);

app.get(
  "/company/portfolio",
  requireAuth,
  aw(async (req, res) => {
    const companyId = Number(req.user?.company_id);
    if (!companyId) return res.status(401).json({ ok: false, error: "unauthorized" });

    const r = await pool.query(
      `SELECT p.id, p.company_id, p.title, p.description, p.photos, p.service_id, p.product_id,
              s.name AS service_name, s.slug AS service_slug,
              pr.name AS product_name, pr.slug AS product_slug,
              p.created_at, p.updated_at
       FROM company_portfolio p
       LEFT JOIN services_catalog s ON s.id = p.service_id
       LEFT JOIN products pr ON pr.id = p.product_id
       WHERE p.company_id = $1
       ORDER BY p.id DESC`,
      [companyId]
    );

    return res.json({ ok: true, items: r.rows });
  })
);

app.post(
  "/company/portfolio",
  requireAuth,
  aw(async (req, res) => {
    const companyId = Number(req.user?.company_id);
    if (!companyId) return res.status(401).json({ ok: false, error: "unauthorized" });

    const b = req.body || {};
    const title = String(b.title ?? "").trim();
    const description = String(b.description ?? "").trim();

    let photos = b.photos ?? [];
    if (typeof photos === "string") photos = photos.split("\n").map((x) => x.trim()).filter(Boolean);
    if (!Array.isArray(photos)) photos = [];
    photos = photos.map((x) => String(x).trim()).filter(Boolean);

    const serviceId = b.service_id ?? b.serviceId ?? null;
    const productId = b.product_id ?? b.productId ?? null;

    if (!title) return res.status(400).json({ ok: false, error: "bad_title" });
    if (photos.length > 30) return res.status(400).json({ ok: false, error: "too_many_photos" });

    const r = await pool.query(
      `INSERT INTO company_portfolio (company_id, title, description, photos, service_id, product_id)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6)
       RETURNING id, company_id, title, description, photos, service_id, product_id, created_at, updated_at`,
      [
        companyId,
        title,
        description,
        JSON.stringify(photos),
        serviceId ? Number(serviceId) : null,
        productId ? Number(productId) : null,
      ]
    );

    return res.json({ ok: true, item: r.rows[0] });
  })
);

app.patch(
  "/company/portfolio/:id",
  requireAuth,
  aw(async (req, res) => {
    const companyId = Number(req.user?.company_id);
    const id = Number(req.params.id);
    if (!companyId) return res.status(401).json({ ok: false, error: "unauthorized" });
    if (!id) return res.status(400).json({ ok: false, error: "bad_request" });

    const b = req.body || {};
    const title = b.title !== undefined ? String(b.title ?? "").trim() : null;
    const description = b.description !== undefined ? String(b.description ?? "").trim() : null;

    let photos = null;
    if (b.photos !== undefined) {
      photos = b.photos;
      if (typeof photos === "string") photos = photos.split("\n").map((x) => x.trim()).filter(Boolean);
      if (!Array.isArray(photos)) photos = [];
      photos = photos.map((x) => String(x).trim()).filter(Boolean);
      if (photos.length > 30) return res.status(400).json({ ok: false, error: "too_many_photos" });
    }

    const serviceId = b.service_id ?? b.serviceId;
    const productId = b.product_id ?? b.productId;

    const r = await pool.query(
      `UPDATE company_portfolio
       SET title       = COALESCE($1, title),
           description = COALESCE($2, description),
           photos      = COALESCE($3::jsonb, photos),
           service_id  = COALESCE($4::int, service_id),
           product_id  = COALESCE($5::int, product_id)
       WHERE id = $6 AND company_id = $7
       RETURNING id, company_id, title, description, photos, service_id, product_id, created_at, updated_at`,
      [
        title === null ? null : title,
        description === null ? null : description,
        photos === null ? null : JSON.stringify(photos),
        serviceId === undefined ? null : serviceId === null ? null : Number(serviceId),
        productId === undefined ? null : productId === null ? null : Number(productId),
        id,
        companyId,
      ]
    );

    if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({ ok: true, item: r.rows[0] });
  })
);

app.delete(
  "/company/portfolio/:id",
  requireAuth,
  aw(async (req, res) => {
    const companyId = Number(req.user?.company_id);
    const id = Number(req.params.id);
    if (!companyId) return res.status(401).json({ ok: false, error: "unauthorized" });
    if (!id) return res.status(400).json({ ok: false, error: "bad_request" });

    const r = await pool.query(`DELETE FROM company_portfolio WHERE id = $1 AND company_id = $2 RETURNING id`, [
      id,
      companyId,
    ]);

    if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({ ok: true });
  })
);

/* =========================================================
   MASTER BLOG (categories + posts)
========================================================= */

function mdToHtmlBasic(md) {
  const s = String(md || "").trim();
  if (!s) return "";
  const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return s
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

/* -----------------------------
   MASTER: blog categories
----------------------------- */

app.get(
  "/master/blog-categories",
  requireMaster,
  aw(async (_req, res) => {
    const r = await pool.query(
      `select id, slug, name, sort_order
       from blog_categories
       order by sort_order asc, name asc`
    );
    return res.json({ ok: true, items: r.rows });
  })
);

app.post(
  "/master/blog-categories",
  requireMaster,
  aw(async (req, res) => {
    const slug = String(req.body?.slug || "").trim();
    const name = String(req.body?.name || "").trim();
    const sort_order = Number(req.body?.sort_order ?? 100);

    if (!slug) return res.status(400).json({ ok: false, error: "bad_slug" });
    if (!name) return res.status(400).json({ ok: false, error: "bad_name" });

    const r = await pool.query(
      `insert into blog_categories (slug, name, sort_order)
       values ($1,$2,$3)
       returning id, slug, name, sort_order`,
      [slug, name, Number.isFinite(sort_order) ? sort_order : 100]
    );

    return res.json({ ok: true, item: r.rows[0] });
  })
);

app.patch(
  "/master/blog-categories/:id",
  requireMaster,
  aw(async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "bad_id" });

    const sets = [];
    const vals = [];
    const put = (col, v) => {
      vals.push(v);
      sets.push(`${col}=$${vals.length}`);
    };

    if (req.body?.slug !== undefined) put("slug", String(req.body.slug ?? "").trim());
    if (req.body?.name !== undefined) put("name", String(req.body.name ?? "").trim());
    if (req.body?.sort_order !== undefined) {
      const so = Number(req.body.sort_order);
      put("sort_order", Number.isFinite(so) ? so : 100);
    }

    if (!sets.length) return res.json({ ok: true });

    vals.push(id);
    const r = await pool.query(
      `update blog_categories set ${sets.join(", ")}
       where id=$${vals.length}
       returning id, slug, name, sort_order`,
      vals
    );

    if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({ ok: true, item: r.rows[0] });
  })
);

app.delete(
  "/master/blog-categories/:id",
  requireMaster,
  aw(async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "bad_id" });

    // posts.category_id ON DELETE SET NULL — safe
    const r = await pool.query(`delete from blog_categories where id=$1 returning id`, [id]);
    if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({ ok: true });
  })
);

/* -----------------------------
   MASTER: blog posts
----------------------------- */

app.get(
  "/master/blog-posts",
  requireMaster,
  aw(async (_req, res) => {
    const r = await pool.query(
      `select
         p.id, p.slug, p.title, p.excerpt, p.cover_image,
         p.category_id, c.name as category_name,
         p.seo_title, p.seo_description,
         p.is_published, p.published_at,
         p.created_at, p.updated_at
       from blog_posts p
       left join blog_categories c on c.id = p.category_id
       order by p.id desc
       limit 500`
    );
    return res.json({ ok: true, items: r.rows });
  })
);

app.get(
  "/master/blog-posts/:id",
  requireMaster,
  aw(async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "bad_id" });

    const r = await pool.query(
      `select p.*, c.slug as category_slug, c.name as category_name
       from blog_posts p
       left join blog_categories c on c.id = p.category_id
       where p.id=$1
       limit 1`,
      [id]
    );

    if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
    const images = await pool.query(
      `select id, image_url, sort_order
       from blog_post_images
       where post_id=$1
       order by sort_order asc, id asc`,
      [id]
    );
    return res.json({ ok: true, item: { ...r.rows[0], images: images.rows } });
  })
);

app.get(
  "/master/blog-posts/:id/images",
  requireMaster,
  aw(async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "bad_id" });

    const r = await pool.query(
      `select id, image_url, sort_order
       from blog_post_images
       where post_id=$1
       order by sort_order asc, id asc`,
      [id]
    );

    return res.json({ ok: true, items: r.rows });
  })
);

app.post(
  "/master/blog-posts/:id/images",
  requireMaster,
  aw(async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "bad_id" });

    const urls = Array.isArray(req.body?.urls)
      ? req.body.urls.map((u) => String(u || "").trim()).filter(Boolean)
      : [];

    if (!urls.length) return res.status(400).json({ ok: false, error: "no_urls" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const maxRes = await client.query(
        `select coalesce(max(sort_order), 0) as max_sort
         from blog_post_images
         where post_id=$1`,
        [id]
      );
      let sort = Number(maxRes.rows[0]?.max_sort || 0);
      const inserted = [];

      for (const url of urls) {
        sort += 1;
        const ins = await client.query(
          `insert into blog_post_images (post_id, image_url, sort_order)
           values ($1, $2, $3)
           returning id, image_url, sort_order`,
          [id, url, sort]
        );
        inserted.push(ins.rows[0]);
      }

      await client.query("COMMIT");
      return res.json({ ok: true, items: inserted });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      return res.status(500).json({ ok: false, error: "insert_failed" });
    } finally {
      client.release();
    }
  })
);

app.delete(
  "/master/blog-posts/:id/images/:imageId",
  requireMaster,
  aw(async (req, res) => {
    const id = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    if (!id || !imageId) return res.status(400).json({ ok: false, error: "bad_id" });

    const r = await pool.query(
      `delete from blog_post_images
       where id=$1 and post_id=$2
       returning id`,
      [imageId, id]
    );

    if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({ ok: true });
  })
);

app.post(
  "/master/services",
  aw(async (req, res) => {
    const name = String(req.body?.name || "").trim() || "Новая услуга";

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const ins = await client.query(
        `
        insert into services_catalog (name, slug, show_on_site)
        values ($1, 'tmp', false)
        returning id
        `,
        [name]
      );

      const id = Number(ins.rows[0]?.id || 0);
      if (!id) throw new Error("no_id");

      const slug = `${slugifyRu(name)}-${id}`;

      await client.query(
        `update services_catalog set slug = $2 where id = $1`,
        [id, slug]
      );

      await client.query("COMMIT");
      res.json({ ok: true, id, slug });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      res.status(500).json({ ok: false, error: "create_failed" });
    } finally {
      client.release();
    }
  })
);


app.post(
  "/master/services/:id/copy",
  aw(async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "bad_id" });

    const r = await pool.query(
      `
      insert into services_catalog (
        name,
        slug,
        category_id,
        description,
        cover_image,
        gallery,
        seo_h1,
        seo_title,
        seo_description,
        seo_text,
        show_on_site
      )
      select
        name || ' (копия)',
        slug || '-' || extract(epoch from now()),
        category_id,
        description,
        cover_image,
        gallery,
        seo_h1,
        seo_title,
        seo_description,
        seo_text,
        false
      from services_catalog
      where id = $1
      returning id
      `,
      [id]
    );

    return res.json({ ok: true, id: r.rows[0].id });
  })
);


app.post(
  "/master/blog-posts",
  requireMaster,
  aw(async (req, res) => {
    const b = req.body || {};
    const slug = String(b.slug || "").trim();
    const title = String(b.title || "").trim();

    if (!slug) return res.status(400).json({ ok: false, error: "bad_slug" });
    if (!title) return res.status(400).json({ ok: false, error: "bad_title" });

    const excerpt = b.excerpt === undefined ? null : String(b.excerpt ?? "").trim() || null;

    const content_md = String(b.content_md ?? "").trim();
    const content_html = String(b.content_html ?? "").trim() || mdToHtmlBasic(content_md);

    const cover_image = b.cover_image ? String(b.cover_image).trim() : null;
    const category_id = b.category_id ? Number(b.category_id) : null;

    const seo_title = b.seo_title ? String(b.seo_title).trim() : null;
    const seo_description = b.seo_description ? String(b.seo_description).trim() : null;

    const is_published = Boolean(b.is_published);
    let published_at = null;
    if (is_published) {
      if (b.published_at) {
        const parsed = new Date(b.published_at);
        published_at = Number.isFinite(parsed.getTime())
          ? parsed.toISOString()
          : new Date().toISOString();
      } else {
        published_at = new Date().toISOString();
      }
    }

    const r = await pool.query(
      `insert into blog_posts
        (slug,title,excerpt,content_md,content_html,cover_image,category_id,seo_title,seo_description,is_published,published_at)
       values
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       returning id, slug, title, is_published, published_at, created_at, updated_at`,
      [
        slug,
        title,
        excerpt,
        content_md,
        content_html,
        cover_image,
        category_id,
        seo_title,
        seo_description,
        is_published,
        published_at,
      ]
    );

    return res.json({ ok: true, item: r.rows[0] });
  })
);

app.patch(
  "/master/blog-posts/:id",
  requireMaster,
  aw(async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "bad_id" });

    const b = req.body || {};
    const sets = [];
    const vals = [];
    const put = (col, v) => {
      vals.push(v);
      sets.push(`${col}=$${vals.length}`);
    };

    if (b.slug !== undefined) put("slug", String(b.slug ?? "").trim());
    if (b.title !== undefined) put("title", String(b.title ?? "").trim());
    if (b.excerpt !== undefined) put("excerpt", String(b.excerpt ?? "").trim() || null);

    let content_md = undefined;
    if (b.content_md !== undefined) content_md = String(b.content_md ?? "").trim();

    let content_html = undefined;
    if (b.content_html !== undefined) content_html = String(b.content_html ?? "").trim();

    // если меняем MD, но HTML не передали — пересоберём базово
    if (content_md !== undefined && b.content_html === undefined) {
      content_html = mdToHtmlBasic(content_md);
    }

    if (content_md !== undefined) put("content_md", content_md);
    if (content_html !== undefined) put("content_html", content_html);

    if (b.cover_image !== undefined) put("cover_image", String(b.cover_image ?? "").trim() || null);

    if (b.category_id !== undefined) {
      const cid = b.category_id ? Number(b.category_id) : null;
      put("category_id", cid);
    }

    if (b.seo_title !== undefined) put("seo_title", String(b.seo_title ?? "").trim() || null);
    if (b.seo_description !== undefined)
      put("seo_description", String(b.seo_description ?? "").trim() || null);

    const hasPublishedAt = b.published_at !== undefined;
    if (b.is_published !== undefined) {
      const pub = Boolean(b.is_published);
      put("is_published", pub);
      if (!pub) {
        put("published_at", null);
      } else if (!hasPublishedAt) {
        put("published_at", new Date().toISOString());
      }
    }

    if (hasPublishedAt) {
      if (b.published_at) {
        const parsed = new Date(b.published_at);
        put(
          "published_at",
          Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
        );
      } else {
        put("published_at", null);
      }
    }

    if (!sets.length) return res.json({ ok: true });

    vals.push(id);
    const r = await pool.query(
      `update blog_posts set ${sets.join(", ")}
       where id=$${vals.length}
       returning id, slug, title, is_published, published_at, created_at, updated_at`,
      vals
    );

    if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({ ok: true, item: r.rows[0] });
  })
);

app.delete(
  "/master/blog-posts/:id",
  requireMaster,
  aw(async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "bad_id" });

    const r = await pool.query(`delete from blog_posts where id=$1 returning id`, [id]);
    if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({ ok: true });
  })
);

/* =========================================================
   MASTER: CANONICAL UPLOADS (products/services)
   POST /master/upload-image
   body: { dataUrl, filename, prefix }
========================================================= */
app.post(
  "/master/upload-image",
  requireMaster,
  aw(async (req, res) => {
    const dataUrl = req.body?.dataUrl;
    const filename = req.body?.filename || "image.jpg";
    const prefixRaw = String(req.body?.prefix || "canon").trim();

    if (!dataUrl) return res.status(400).json({ ok: false, error: "no_dataUrl" });

    // ✅ немного чистим prefix, чтобы не было мусора в имени файла
    const prefix = prefixRaw.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60) || "canon";

    const saved = await saveDataUrlImageAsWebp({
      prefix,
      dataUrl,
      filenameHint: filename,
      maxBytes: 8 * 1024 * 1024,
    });

    if (!saved.ok) return res.status(400).json({ ok: false, error: saved.error || "upload_failed" });
    return res.json({ ok: true, url: saved.url });
  })
);

/* =========================================================
   MASTER: BLOG UPLOADS
========================================================= */
app.post(
  "/master/blog/upload-cover",
  requireMaster,
  aw(async (req, res) => {
    const dataUrl = req.body?.dataUrl;
    const filename = req.body?.filename || "cover.jpg";
    const postId = req.body?.post_id ? Number(req.body.post_id) : null;

    if (!dataUrl) return res.status(400).json({ ok: false, error: "no_dataUrl" });

    const saved = await saveDataUrlImageAsWebp({
      prefix: `blog-cover${postId ? `-post-${postId}` : ""}`,
      dataUrl,
      filenameHint: filename,
      maxBytes: 5 * 1024 * 1024,
    });

    if (!saved.ok) return res.status(400).json({ ok: false, error: saved.error || "upload_failed" });
    return res.json({ ok: true, url: saved.url });
  })
);

// =========================================================
// MASTER: PRODUCTS (create / delete)
// =========================================================

app.post(
  "/master/products/:id/copy",
  requireMaster,
  aw(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "bad_id" });
    }

    try {
      // 1) исходник
      const r1 = await pool.query(
        `
        select
          id, slug, name,
          category_id, category,
          cover_image,
          description,
          gallery,
          specs,
          seo_h1,
          seo_title,
          seo_description,
          seo_text
        from products
        where id=$1
        limit 1
        `,
        [id]
      );

      const src = r1.rows?.[0];
      if (!src) return res.status(404).json({ ok: false, error: "not_found" });

      // 2) новый slug (максимально безопасный)
      const base = String(src.slug || src.name || "copy")
        .toLowerCase()
        .replace(/[^a-z0-9\-_.]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");

      const stamp = Date.now().toString(36);
      const rand = crypto.randomBytes(3).toString("hex");
      const newSlug = `${base || "copy"}-copy-${stamp}-${rand}`;

      const newName = `${String(src.name || "").trim() || "Товар"} (копия)`;

      // 3) нормализуем jsonb поля
      const galleryArr = Array.isArray(src.gallery)
        ? src.gallery.map((x) => String(x || "").trim()).filter(Boolean)
        : [];

      const specsArr = Array.isArray(src.specs)
        ? src.specs
        : (typeof src.specs === "string"
            ? (() => {
                try {
                  const p = JSON.parse(src.specs);
                  return Array.isArray(p) ? p : [];
                } catch {
                  return [];
                }
              })()
            : []);

      // 4) вставка (явные ::jsonb)
      const r2 = await pool.query(
        `
        insert into products (
          slug, name,
          category_id, category,
          cover_image,
          description,
          gallery,
          specs,
          seo_h1,
          seo_title, seo_description, seo_text,
          show_on_site
        )
        values (
          $1,$2,
          $3,$4,
          $5,
          $6,
          $7::jsonb,
          $8::jsonb,
          $9,
          $10,$11,$12,
          false
        )
        returning id
        `,
        [
          newSlug,
          newName,
          src.category_id ?? null,
          src.category ?? null,
          src.cover_image ?? null,
          src.description ?? "",
          JSON.stringify(galleryArr),
          JSON.stringify(specsArr),
          src.seo_h1 ?? null,
          src.seo_title ?? null,
          src.seo_description ?? null,
          src.seo_text ?? null,
        ]
      );

      return res.json({ ok: true, id: r2.rows[0].id });
    } catch (e) {
      console.error("MASTER_PRODUCT_COPY_FAILED:", e);
      // ⬇️ специально отдаём текст, чтобы в Network было видно реальную причину
      return res.status(500).json({
        ok: false,
        error: "copy_failed",
        detail: String(e?.message || e),
      });
    }
  })
);


app.post(
  "/master/products",
  requireMaster,
  aw(async (req, res) => {
    try {
      const name = String(req.body?.name || "").trim();
      const slug = String(req.body?.slug || "").trim();
      const category_id = Number(req.body?.category_id || 0);

      if (!name) return res.status(400).json({ ok: false, error: "bad_name" });
      if (!slug) return res.status(400).json({ ok: false, error: "bad_slug" });
      if (!Number.isFinite(category_id) || category_id <= 0)
        return res.status(400).json({ ok: false, error: "bad_category_id" });

      // category (legacy) — подставим slug категории
      const c = await pool.query("select slug from product_categories where id=$1 limit 1", [
        category_id,
      ]);
      const category = String(c.rows?.[0]?.slug || "").trim() || "general";

      // защитимся от дубля slug
      const ex = await pool.query("select id from products where slug=$1 limit 1", [slug]);
      if (ex.rowCount) return res.status(409).json({ ok: false, error: "slug_exists" });

      const ins = await pool.query(
        `
        insert into products (name, slug, category, category_id)
        values ($1,$2,$3,$4)
        returning id, name, slug, category, category_id, updated_at
        `,
        [name, slug, category, category_id]
      );

      return res.json({ ok: true, item: ins.rows[0] });
    } catch (e) {
      console.error("POST /master/products failed", e);
      return res.status(500).json({ ok: false, error: "master_products_create_failed" });
    }
  })
);

app.delete(
  "/master/products/:id",
  requireMaster,
  aw(async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ ok: false, error: "bad_id" });

      // ✅ если товар уже используется в company_items — не удаляем
      const used = await pool.query(
        `select count(*)::int as cnt
         from company_items
         where kind='product' and product_id=$1`,
        [id]
      );
      const cnt = used.rows?.[0]?.cnt || 0;
      if (cnt > 0) {
        return res.status(409).json({ ok: false, error: "in_use", items_count: cnt });
      }

      const r = await pool.query(`delete from products where id=$1 returning id`, [id]);
      if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });

      return res.json({ ok: true, id });
    } catch (e) {
      console.error("DELETE /master/products/:id failed", e);
      return res.status(500).json({ ok: false, error: "master_products_delete_failed" });
    }
  })
);


/* =========================================================
   MASTER: PRODUCTS (canonical fields)
========================================================= */

app.get(
  "/master/products",
  requireMaster,
  aw(async (_req, res) => {
    const r = await pool.query(
      `
      select
        p.id, p.slug, p.name,
        p.category_id,
        pc.slug as category_slug,
        pc.name as category_name,
        p.cover_image,
        p.show_on_site, -- ✅ NEW
        p.specs,
        left(coalesce(p.description,''), 240) as description_preview,
        p.seo_title, p.seo_description,
        p.updated_at
      from products p
      left join product_categories pc on pc.id = p.category_id
      order by p.id desc
      limit 1000
      `
    );
    return res.json({ ok: true, items: r.rows });
  })
);


app.get(
  "/master/products/:id",
  requireMaster,
  aw(async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "bad_id" });

    const r = await pool.query(
      `
      select
        p.*,
        pc.slug as category_slug,
        pc.name as category_name
      from products p
      left join product_categories pc on pc.id = p.category_id
      where p.id=$1
      limit 1
      `,
      [id]
    );

    if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({ ok: true, item: r.rows[0] });
  })
);

app.patch(
  "/master/products/:id",
  requireMaster,
  aw(async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "bad_id" });

    const b = req.body || {};

    // ✅ каноника
    const name = b.name !== undefined ? sanitizeText(b.name, 500) : undefined;
    const slugRaw = b.slug !== undefined ? cleanStr(b.slug) : undefined;
    const category_id =
      b.category_id !== undefined ? (b.category_id ? Number(b.category_id) : null) : undefined;

    const description = b.description !== undefined ? sanitizeText(b.description, 50000) : undefined;
    const cover_image = b.cover_image !== undefined ? cleanStr(b.cover_image) : undefined;

    // gallery ожидаем массив строк / null (очистить) / undefined (не трогать)
    let gallery = undefined;
	// specs: ожидаем массив [{name,value}] / null (очистить) / undefined (не трогать)
	let specs = undefined;
	if (b.specs !== undefined) {
	  if (b.specs === null) specs = [];
	  else if (Array.isArray(b.specs)) specs = normalizeSpecs(b.specs);
	  else specs = [];
	}
    if (b.gallery !== undefined) {
      if (b.gallery === null) gallery = [];
      else if (Array.isArray(b.gallery)) gallery = b.gallery.map((x) => String(x || "").trim()).filter(Boolean);
      else gallery = [];
    }

    // SEO
    const seo_h1 = b.seo_h1 !== undefined ? sanitizeText(b.seo_h1, 300) : undefined;
    const seo_title = b.seo_title !== undefined ? sanitizeText(b.seo_title, 700) : undefined;
    const seo_description = b.seo_description !== undefined ? sanitizeText(b.seo_description, 1500) : undefined;
    const seo_text = b.seo_text !== undefined ? sanitizeText(b.seo_text, 50000) : undefined;
const show_on_site = b.show_on_site === undefined ? undefined : !!b.show_on_site; // ✅ NEW

    // ✅ NEW: ru -> lat translit (минимально достаточный для slug)
    function translitRuToLat(input) {
      const map = {
        а: "a",
        б: "b",
        в: "v",
        г: "g",
        д: "d",
        е: "e",
        ё: "e",
        ж: "zh",
        з: "z",
        и: "i",
        й: "y",
        к: "k",
        л: "l",
        м: "m",
        н: "n",
        о: "o",
        п: "p",
        р: "r",
        с: "s",
        т: "t",
        у: "u",
        ф: "f",
        х: "h",
        ц: "ts",
        ч: "ch",
        ш: "sh",
        щ: "sch",
        ъ: "",
        ы: "y",
        ь: "",
        э: "e",
        ю: "yu",
        я: "ya",
      };

      return String(input || "")
        .trim()
        .toLowerCase()
        .split("")
        .map((ch) => map[ch] ?? ch)
        .join("");
    }

    // ✅ NEW: normalize slug to safe format (lat/digits/-)
    function normalizeSlug(v) {
      const s = String(v || "").trim().toLowerCase();
      return s
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    }

    let slug = undefined;
    if (slugRaw !== undefined) {
      slug = normalizeSlug(translitRuToLat(slugRaw));

      if (!slug && name) slug = normalizeSlug(translitRuToLat(name));

      if (!slug) {
        return res.status(400).json({ ok: false, error: "bad_slug" });
      }

      // ✅ uniqueness check (exclude current id)
      let candidate = slug;
      for (let i = 0; i < 50; i++) {
        const dupe = await pool.query(`select id from products where slug=$1 and id<>$2 limit 1`, [
          candidate,
          id,
        ]);
        if (!dupe.rowCount) break;
        candidate = i === 0 ? `${slug}-${id}` : `${slug}-${id}-${i + 1}`;
      }
      slug = candidate;
    }

    const sets = [];
    const vals = [];

    const put = (col, v) => {
      vals.push(v);
      sets.push(`${col}=$${vals.length}`);
    };
    const putJsonb = (col, vJsonString) => {
      vals.push(vJsonString);
      sets.push(`${col}=$${vals.length}::jsonb`);
    };

    if (name !== undefined) put("name", name);
    if (slug !== undefined) put("slug", slug);
    if (category_id !== undefined) put("category_id", Number.isFinite(category_id) ? category_id : null);

    if (description !== undefined) put("description", description);
    if (cover_image !== undefined) put("cover_image", cover_image);

    if (gallery !== undefined) putJsonb("gallery", JSON.stringify(gallery));
	if (specs !== undefined) putJsonb("specs", JSON.stringify(specs));

    if (seo_h1 !== undefined) put("seo_h1", seo_h1);
    if (seo_title !== undefined) put("seo_title", seo_title);
    if (seo_description !== undefined) put("seo_description", seo_description);
    if (seo_text !== undefined) put("seo_text", seo_text);
if (show_on_site !== undefined) put("show_on_site", show_on_site); // ✅ NEW

    if (!sets.length) return res.json({ ok: true });

    vals.push(id);

    const q = `
      update products
      set ${sets.join(", ")},
          updated_at = now()
      where id = $${vals.length}
      returning id, slug, name, category_id, description, cover_image, gallery, specs, seo_h1, seo_title, seo_description, seo_text, updated_at
    `;

    const r = await pool.query(q, vals);
    if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({ ok: true, item: r.rows[0] });
  })
);

/* =========================================================
   MASTER: SERVICES (canonical fields)
========================================================= */

app.get(
  "/master/services",
  requireMaster,
  aw(async (_req, res) => {
    const r = await pool.query(
      `
      select
        s.id, s.slug, s.name,
        s.category_id,
        sc.slug as category_slug,
        sc.name as category_name,
        s.cover_image,
        s.show_on_site, -- ✅ NEW
        left(coalesce(s.description,''), 240) as description_preview,
        s.seo_title, s.seo_description,
        s.updated_at
      from services_catalog s
      left join service_categories sc on sc.id = s.category_id
      order by s.id desc
      limit 2000
      `
    );
    return res.json({ ok: true, items: r.rows });
  })
);


app.get(
  "/master/services/:id",
  requireMaster,
  aw(async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "bad_id" });

    const r = await pool.query(
      `
      select
        s.*,
        sc.slug as category_slug,
        sc.name as category_name
      from services_catalog s
      left join service_categories sc on sc.id = s.category_id
      where s.id=$1
      limit 1
      `,
      [id]
    );

    if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({ ok: true, item: r.rows[0] });
  })
);

app.patch(
  "/master/services/:id",
  requireMaster,
  aw(async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "bad_id" });

    const b = req.body || {};

    // ✅ NEW: slug
    const slugRaw = b.slug !== undefined ? cleanStr(b.slug) : undefined;

    const name = b.name !== undefined ? sanitizeText(b.name, 500) : undefined;

    const category_id =
      b.category_id !== undefined ? (b.category_id ? Number(b.category_id) : null) : undefined;

    const show_on_site = b.show_on_site === undefined ? undefined : !!b.show_on_site; // ✅ NEW

    const description = b.description !== undefined ? sanitizeText(b.description, 50000) : undefined;
    const cover_image = b.cover_image !== undefined ? cleanStr(b.cover_image) : undefined;

    let gallery = undefined;
    if (b.gallery !== undefined) {
      if (b.gallery === null) gallery = [];
      else if (Array.isArray(b.gallery))
        gallery = b.gallery.map((x) => String(x || "").trim()).filter(Boolean);
      else gallery = [];
    }

    const seo_h1 = b.seo_h1 !== undefined ? sanitizeText(b.seo_h1, 300) : undefined;
    const seo_title = b.seo_title !== undefined ? sanitizeText(b.seo_title, 700) : undefined;
    const seo_description =
      b.seo_description !== undefined ? sanitizeText(b.seo_description, 1500) : undefined;
    const seo_text = b.seo_text !== undefined ? sanitizeText(b.seo_text, 50000) : undefined;

    // ✅ NEW: ru -> lat translit (минимально достаточный для slug)
    function translitRuToLat(input) {
      const map = {
        а: "a",
        б: "b",
        в: "v",
        г: "g",
        д: "d",
        е: "e",
        ё: "e",
        ж: "zh",
        з: "z",
        и: "i",
        й: "y",
        к: "k",
        л: "l",
        м: "m",
        н: "n",
        о: "o",
        п: "p",
        р: "r",
        с: "s",
        т: "t",
        у: "u",
        ф: "f",
        х: "h",
        ц: "ts",
        ч: "ch",
        ш: "sh",
        щ: "sch",
        ъ: "",
        ы: "y",
        ь: "",
        э: "e",
        ю: "yu",
        я: "ya",
      };

      return String(input || "")
        .trim()
        .toLowerCase()
        .split("")
        .map((ch) => map[ch] ?? ch)
        .join("");
    }

    // ✅ NEW: normalize slug to safe format (lat/digits/-)
    function normalizeSlug(v) {
      const s = String(v || "").trim().toLowerCase();
      return s
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    }

    let slug = undefined;
    if (slugRaw !== undefined) {
      // slug может прийти кириллицей — транслитерим
      slug = normalizeSlug(translitRuToLat(slugRaw));

      // если пусто — пробуем сделать из name (если name пришёл в этом же PATCH)
      if (!slug && name) slug = normalizeSlug(translitRuToLat(name));

      if (!slug) {
        return res.status(400).json({ ok: false, error: "bad_slug" });
      }

      // ✅ uniqueness check (exclude current id)
      // если занято — делаем кандидат с суффиксом, чтобы PATCH не падал при автогенерации
      let candidate = slug;
      for (let i = 0; i < 50; i++) {
        const dupe = await pool.query(
          `select id from services_catalog where slug=$1 and id<>$2 limit 1`,
          [candidate, id]
        );
        if (!dupe.rowCount) break;
        candidate = i === 0 ? `${slug}-${id}` : `${slug}-${id}-${i + 1}`;
      }
      slug = candidate;
    }

    const sets = [];
    const vals = [];

    const put = (col, v) => {
      vals.push(v);
      sets.push(`${col}=$${vals.length}`);
    };
    const putJsonb = (col, vJsonString) => {
      vals.push(vJsonString);
      sets.push(`${col}=$${vals.length}::jsonb`);
    };

    if (name !== undefined) put("name", name);
    if (slug !== undefined) put("slug", slug); // ✅ NEW

    if (category_id !== undefined) put("category_id", Number.isFinite(category_id) ? category_id : null);

    if (description !== undefined) put("description", description);
    if (cover_image !== undefined) put("cover_image", cover_image);
    if (gallery !== undefined) putJsonb("gallery", JSON.stringify(gallery));

    if (seo_h1 !== undefined) put("seo_h1", seo_h1);
    if (seo_title !== undefined) put("seo_title", seo_title);
    if (seo_description !== undefined) put("seo_description", seo_description);
    if (seo_text !== undefined) put("seo_text", seo_text);

    if (show_on_site !== undefined) put("show_on_site", show_on_site); // ✅ NEW

    if (!sets.length) return res.json({ ok: true });

    vals.push(id);

    const q = `
      update services_catalog
      set ${sets.join(", ")},
          updated_at = now()
      where id = $${vals.length}
      returning
        id, slug, name, category_id,
        description, cover_image, gallery,
        seo_h1, seo_title, seo_description, seo_text,
        show_on_site,
        updated_at
    `;

    const r = await pool.query(q, vals);
    if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
    return res.json({ ok: true, item: r.rows[0] });
  })
);



/* =========================================================
   BLOG (public)
========================================================= */

// категории
app.get(
  "/public/blog/categories",
  aw(async (_req, res) => {
    const r = await pool.query(
      `select id, slug, name
       from blog_categories
       order by sort_order asc, name asc`
    );
    return res.json({ ok: true, categories: r.rows });
  })
);

// список постов
app.get(
  "/public/blog",
  aw(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const limitRaw = Number(req.query.limit || 12) || 12;
    const limit = Math.min(50, Math.max(1, limitRaw));
    const offset = (page - 1) * limit;

    const categorySlug = String(req.query.category || "").trim();
    const q = String(req.query.q || "").trim();

    const params = [];
    let where = `where p.is_published = true`;

    if (categorySlug) {
      params.push(categorySlug);
      where += ` and c.slug = $${params.length}`;
    }

    if (q) {
      params.push(`%${q}%`);
      where += ` and (p.title ilike $${params.length} or coalesce(p.excerpt,'') ilike $${params.length})`;
    }

    // count
    const cnt = await pool.query(
      `
      select count(*)::int as total
      from blog_posts p
      left join blog_categories c on c.id = p.category_id
      ${where}
      `,
      params
    );

    // list
    params.push(limit);
    params.push(offset);

    const rows = await pool.query(
      `
      select
        p.id, p.slug, p.title, p.excerpt, p.cover_image,
        p.seo_title, p.seo_description,
        p.published_at,
        c.slug as category_slug,
        c.name as category_name
      from blog_posts p
      left join blog_categories c on c.id = p.category_id
      ${where}
      order by p.published_at desc nulls last, p.id desc
      limit $${params.length - 1}
      offset $${params.length}
      `,
      params
    );

    return res.json({
      ok: true,
      page,
      limit,
      total: cnt.rows?.[0]?.total || 0,
      items: rows.rows,
    });
  })
);

// деталка
app.get(
  "/public/blog/:slug",
  aw(async (req, res) => {
    const slug = String(req.params.slug || "").trim();
    if (!slug) return res.status(400).json({ ok: false, error: "bad_slug" });

    const r = await pool.query(
      `
      select
        p.id, p.slug, p.title, p.excerpt,
        p.content_html, p.cover_image,
        p.seo_title, p.seo_description,
        p.published_at,
        c.slug as category_slug,
        c.name as category_name
      from blog_posts p
      left join blog_categories c on c.id = p.category_id
      where p.slug = $1 and p.is_published = true
      limit 1
      `,
      [slug]
    );

    if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });

    const post = r.rows[0];
    const images = await pool.query(
      `select id, image_url, sort_order
       from blog_post_images
       where post_id=$1
       order by sort_order asc, id asc`,
      [post.id]
    );

    return res.json({ ok: true, post: { ...post, images: images.rows } });
  })
);

/* =========================================================
   PUBLIC FOOTER CATEGORIES (DB ONLY)
========================================================= */

/* =========================================================
   PUBLIC FOOTER CATEGORIES (DB ONLY)
========================================================= */

app.get("/public/product-categories", aw(async (_req, res) => {
  const r = await pool.query(
    "SELECT id, slug, name FROM product_categories WHERE is_active = true ORDER BY sort_order ASC, name ASC"
  );
  res.json({ ok: true, items: r.rows });
}));

app.get("/public/service-categories", aw(async (_req, res) => {
  const r = await pool.query(
    "SELECT id, slug, name FROM service_categories WHERE is_active = true ORDER BY sort_order ASC, name ASC"
  );
  res.json({ ok: true, items: r.rows });
}));

/* =========================================================
   LEADS ROUTES
========================================================= */
registerLeadsRoutes(app, pool, requireAuth);
registerMasterRoutes(app, pool, requireSuperadmin, { cleanStr, sanitizeText });
registerAdminSeoGenerate(app);

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */
app.use((err, _req, res, next) => {
  console.error("UNHANDLED_ERROR:", err);
  if (res.headersSent) return next(err);
  const code = Number(err?.statusCode) || 500;
  return res.status(code).json({ ok: false, error: err?.message || "server_error" });
});

/* =========================================================
   START
========================================================= */
const port = process.env.PORT ? Number(process.env.PORT) : 8080;
app.listen(port, "0.0.0.0", () => console.log(`mpv-api listening on :${port}`));
