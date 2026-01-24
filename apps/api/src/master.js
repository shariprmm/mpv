// /apps/api/src/master.js
// ESM (import/export)

import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

export function registerMasterRoutes(app, pool, requireSuperadmin, helpers = {}) {
  const cleanStr =
    helpers.cleanStr ||
    ((v) => (v === undefined ? undefined : v === null ? null : String(v).trim() || null));

  const sanitizeText =
    helpers.sanitizeText ||
    ((v, maxLen = 5000) => {
      if (v === undefined) return undefined; // не трогать
      if (v === null) return null; // очистить
      const s = String(v).trim();
      if (!s) return null;
      return s.length > maxLen ? s.slice(0, maxLen) : s;
    });

  // =========================================================
  // uploads: category images (webp big + thumb)
  // =========================================================

  const UPLOAD_DIR =
    helpers.uploadDir || process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

  const PCAT_DIR = path.join(UPLOAD_DIR, "product-categories");
  const SCAT_DIR = path.join(UPLOAD_DIR, "service-categories");

  try {
    fs.mkdirSync(PCAT_DIR, { recursive: true });
    fs.mkdirSync(SCAT_DIR, { recursive: true });
  } catch {
    // ignore (if readonly env — upload will fail at runtime with proper error)
  }

  function safeSlugPart(v) {
    const s = String(v || "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    return s || "cat";
  }

  // lazy-import to prevent API crash if deps are missing
  let _multerPromise = null;
  let _sharpPromise = null;

  async function getMulter() {
    if (!_multerPromise) _multerPromise = import("multer");
    const m = await _multerPromise;
    return m.default || m;
  }

  async function getSharp() {
    if (!_sharpPromise) _sharpPromise = import("sharp");
    const m = await _sharpPromise;
    return m.default || m;
  }

  async function buildUploadMiddleware() {
    const multer = await getMulter();
    return multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
      fileFilter: (_req, file, cb) => {
        const ok = /^image\/(png|jpe?g|webp|gif|bmp|tiff)$/i.test(file.mimetype || "");
        cb(ok ? null : new Error("bad_file_type"), ok);
      },
    }).single("file");
  }

  // helper to run multer middleware in async/await style
  function runMiddleware(req, res, mw) {
    return new Promise((resolve, reject) => {
      mw(req, res, (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
  }

  // =========================================================
  // helpers: DB schema detection for companies
  // =========================================================

  let companiesColsPromise = null;

  async function getCompaniesCols() {
    if (!companiesColsPromise) {
      companiesColsPromise = pool
        .query(
          `
          select column_name
          from information_schema.columns
          where table_schema = 'public' and table_name = 'companies'
        `
        )
        .then((r) => new Set(r.rows.map((x) => String(x.column_name).toLowerCase())));
    }
    return companiesColsPromise;
  }

  function pickExisting(colsSet, preferred) {
    for (const c of preferred) {
      const key = String(c).toLowerCase();
      if (colsSet.has(key)) return key;
    }
    return null;
  }

  let companiesMappingCache = null;

  async function companiesMapping() {
    if (companiesMappingCache) return companiesMappingCache;
    const cols = await getCompaniesCols();

    const map = {
      id: "id",

      name: pickExisting(cols, ["name", "title"]),
      slug: pickExisting(cols, ["slug"]),

      region_id: pickExisting(cols, ["region_id"]),

      phone: pickExisting(cols, ["phone", "tel", "telephone"]),
      email: pickExisting(cols, ["email", "mail"]),
      website: pickExisting(cols, ["website", "site", "url"]),
      address: pickExisting(cols, ["address", "addr"]),
      city: pickExisting(cols, ["city", "city_name", "town"]),
      work_hours: pickExisting(cols, ["work_hours", "hours", "worktime"]),

      vk_url: pickExisting(cols, ["vk_url", "vk"]),
      tg_url: pickExisting(cols, ["tg_url", "telegram", "telegram_url"]),
      youtube_url: pickExisting(cols, ["youtube_url", "youtube"]),

      description: pickExisting(cols, ["description", "about", "descr", "details", "text"]),

      logo_url: pickExisting(cols, ["logo_url", "logo", "logoimage", "logo_image"]),
      cover_image: pickExisting(cols, ["cover_image", "coverimage", "cover", "cover_url"]),

      photos: pickExisting(cols, ["photos", "gallery", "images"]),

      is_verified: pickExisting(cols, ["is_verified", "verified"]),
      is_active: cols.has("is_active") ? "is_active" : null,
      rating: cols.has("rating") ? "rating" : null,
      reviews_count: cols.has("reviews_count") ? "reviews_count" : null,

      updated_at: cols.has("updated_at") ? "updated_at" : null,
    };

    companiesMappingCache = map;
    return map;
  }

  function selExpr(dbCol, alias) {
    if (!dbCol) return `NULL as ${alias}`;
    if (alias && dbCol !== alias) return `${dbCol} as ${alias}`;
    return dbCol;
  }

  function qCol(tableAlias, dbCol) {
    if (!dbCol) return null;
    return `${tableAlias}.${dbCol}`;
  }

  function normalizePhotosInput(v, maxItems = 40) {
    if (v === undefined) return undefined;
    if (v === null) return null;

    let arr = null;

    if (Array.isArray(v)) {
      arr = v;
    } else if (typeof v === "string") {
      const s = v.trim();
      if (!s) return null;

      try {
        const p = JSON.parse(s);
        arr = Array.isArray(p) ? p : [s];
      } catch {
        arr = [s];
      }
    } else {
      return null;
    }

    const cleaned = [];

    for (const raw of arr) {
      if (cleaned.length >= maxItems) break;
      const u = raw == null ? "" : String(raw).trim();
      if (!u) continue;
      if (u.startsWith("/uploads/") || /^https?:\/\//i.test(u)) {
        cleaned.push(u);
        continue;
      }
      if (u.startsWith("uploads/")) {
        cleaned.push(`/${u}`);
      }
    }

    return cleaned.length ? cleaned : null;
  }

  async function ensureRegionExists(regionId) {
    if (regionId === null) return true;
    if (!Number.isFinite(regionId) || regionId <= 0) return false;
    const r = await pool.query(`select id from regions where id=$1 limit 1`, [regionId]);
    return !!r.rowCount;
  }

  // =========================================================
  // MASTER: COMPANIES (LIST/READ/UPDATE/DELETE)
  // =========================================================

  function registerCompaniesRoutes(base) {
    app.get(`${base}/companies`, requireSuperadmin, async (req, res, next) => {
      try {
        const m = await companiesMapping();

        const search = String(req.query.search || "").trim();
        const page = Math.max(1, Number(req.query.page || 1) || 1);
        const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50) || 50));
        const offset = (page - 1) * limit;

        const where = [];
        const vals = [];
        const put = (v) => {
          vals.push(v);
          return `$${vals.length}`;
        };

        if (m.is_active) where.push(`c.${m.is_active} = true`);

        if (search) {
          const q = `%${search}%`;
          const parts = [];
          if (m.name) parts.push(`${qCol("c", m.name)} ILIKE ${put(q)}`);
          if (m.phone) parts.push(`${qCol("c", m.phone)} ILIKE ${put(q)}`);
          if (m.city) parts.push(`${qCol("c", m.city)} ILIKE ${put(q)}`);
          if (m.email) parts.push(`${qCol("c", m.email)} ILIKE ${put(q)}`);
          if (m.slug) parts.push(`${qCol("c", m.slug)} ILIKE ${put(q)}`);
          parts.push(`r.name ILIKE ${put(q)}`);
          if (parts.length) where.push(`(${parts.join(" OR ")})`);
        }

        const sql = `
          SELECT
            c.id,
            ${selExpr(m.name ? qCol("c", m.name) : null, "name")},
            ${selExpr(m.slug ? qCol("c", m.slug) : null, "slug")},
            ${selExpr(m.description ? qCol("c", m.description) : null, "description")},
            ${selExpr(m.phone ? qCol("c", m.phone) : null, "phone")},
            ${selExpr(m.email ? qCol("c", m.email) : null, "email")},
            ${selExpr(m.website ? qCol("c", m.website) : null, "website")},
            ${selExpr(m.address ? qCol("c", m.address) : null, "address")},
            ${selExpr(m.city ? qCol("c", m.city) : null, "city")},
            ${selExpr(m.work_hours ? qCol("c", m.work_hours) : null, "work_hours")},
            ${selExpr(m.region_id ? qCol("c", m.region_id) : null, "region_id")},
            r.name as region_name,
            ${selExpr(m.logo_url ? qCol("c", m.logo_url) : null, "logo_url")},
            ${selExpr(m.cover_image ? qCol("c", m.cover_image) : null, "cover_image")},
            ${selExpr(m.photos ? qCol("c", m.photos) : null, "photos")},
            ${selExpr(m.is_verified ? qCol("c", m.is_verified) : null, "is_verified")},
            ${selExpr(m.rating ? qCol("c", m.rating) : null, "rating")},
            ${selExpr(m.reviews_count ? qCol("c", m.reviews_count) : null, "reviews_count")}
          FROM companies c
          LEFT JOIN regions r ON r.id = c.region_id
          ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
          ORDER BY c.id DESC
          LIMIT ${put(limit)} OFFSET ${put(offset)}
        `;

        const r = await pool.query(sql, vals);
        return res.json({ ok: true, items: r.rows, page, limit });
      } catch (e) {
        return next(e);
      }
    });

    app.get(`${base}/companies/:id`, requireSuperadmin, async (req, res, next) => {
      try {
        const m = await companiesMapping();

        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
          return res.status(400).json({ ok: false, error: "bad_id" });
        }

        const where = [`c.id = $1`];
        const vals = [id];
        if (m.is_active) where.push(`c.${m.is_active} = true`);

        const sql = `
          SELECT
            c.id,
            ${selExpr(m.name ? qCol("c", m.name) : null, "name")},
            ${selExpr(m.slug ? qCol("c", m.slug) : null, "slug")},
            ${selExpr(m.description ? qCol("c", m.description) : null, "description")},
            ${selExpr(m.phone ? qCol("c", m.phone) : null, "phone")},
            ${selExpr(m.email ? qCol("c", m.email) : null, "email")},
            ${selExpr(m.website ? qCol("c", m.website) : null, "website")},
            ${selExpr(m.address ? qCol("c", m.address) : null, "address")},
            ${selExpr(m.city ? qCol("c", m.city) : null, "city")},
            ${selExpr(m.work_hours ? qCol("c", m.work_hours) : null, "work_hours")},
            ${selExpr(m.vk_url ? qCol("c", m.vk_url) : null, "vk_url")},
            ${selExpr(m.tg_url ? qCol("c", m.tg_url) : null, "tg_url")},
            ${selExpr(m.youtube_url ? qCol("c", m.youtube_url) : null, "youtube_url")},
            ${selExpr(m.region_id ? qCol("c", m.region_id) : null, "region_id")},
            r.name as region_name,
            ${selExpr(m.logo_url ? qCol("c", m.logo_url) : null, "logo_url")},
            ${selExpr(m.cover_image ? qCol("c", m.cover_image) : null, "cover_image")},
            ${selExpr(m.photos ? qCol("c", m.photos) : null, "photos")},
            ${selExpr(m.is_verified ? qCol("c", m.is_verified) : null, "is_verified")},
            ${selExpr(m.rating ? qCol("c", m.rating) : null, "rating")},
            ${selExpr(m.reviews_count ? qCol("c", m.reviews_count) : null, "reviews_count")}
          FROM companies c
          LEFT JOIN regions r ON r.id = c.region_id
          WHERE ${where.join(" AND ")}
          LIMIT 1
        `;

        const r = await pool.query(sql, vals);
        if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
        return res.json({ ok: true, item: r.rows[0] });
      } catch (e) {
        return next(e);
      }
    });

    app.patch(`${base}/companies/:id`, requireSuperadmin, async (req, res, next) => {
      try {
        const m = await companiesMapping();

        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
          return res.status(400).json({ ok: false, error: "bad_id" });
        }

        const name = cleanStr(req.body?.name);
        const slug = cleanStr(req.body?.slug);
        const description = sanitizeText(req.body?.description, 20000);

        const phone = cleanStr(req.body?.phone);
        const email = cleanStr(req.body?.email);
        const website = cleanStr(req.body?.website);

        const address = sanitizeText(req.body?.address, 500);
        const city = cleanStr(req.body?.city);
        const work_hours = cleanStr(req.body?.work_hours);

        const vk_url = cleanStr(req.body?.vk_url);
        const tg_url = cleanStr(req.body?.tg_url);
        const youtube_url = cleanStr(req.body?.youtube_url);

        const region_id =
          req.body?.region_id === undefined
            ? undefined
            : req.body.region_id
              ? Number(req.body.region_id)
              : null;

        const logo_url = cleanStr(req.body?.logo_url);
        const cover_image = cleanStr(req.body?.cover_image);

        const photos = normalizePhotosInput(req.body?.photos);
        const is_verified = req.body?.is_verified === undefined ? undefined : !!req.body.is_verified;

        const sets = [];
        const vals = [];

        const put = (dbCol, v) => {
          if (!dbCol) return;
          if (v === undefined) return;
          vals.push(v);
          sets.push(`${dbCol}=$${vals.length}`);
        };

        const putJsonb = (dbCol, v) => {
          if (!dbCol) return;
          if (v === undefined) return;
          if (v === null) {
            vals.push(null);
            sets.push(`${dbCol}=$${vals.length}::jsonb`);
            return;
          }
          vals.push(JSON.stringify(v));
          sets.push(`${dbCol}=$${vals.length}::jsonb`);
        };

        put(m.name, name);
        put(m.slug, slug);
        put(m.description, description);

        put(m.phone, phone);
        put(m.email, email);
        put(m.website, website);

        put(m.address, address);
        put(m.city, city);
        put(m.work_hours, work_hours);

        put(m.vk_url, vk_url);
        put(m.tg_url, tg_url);
        put(m.youtube_url, youtube_url);

        if (region_id !== undefined) {
          if (region_id === null) {
            put(m.region_id, null);
          } else if (Number.isFinite(region_id) && region_id > 0) {
            const ok = await ensureRegionExists(region_id);
            if (!ok) return res.status(400).json({ ok: false, error: "bad_region_id" });
            put(m.region_id, Math.trunc(region_id));
          } else {
            return res.status(400).json({ ok: false, error: "bad_region_id" });
          }
        }

        put(m.logo_url, logo_url);
        put(m.cover_image, cover_image);

        putJsonb(m.photos, photos);

        if (m.is_verified) put(m.is_verified, is_verified);

        if (!sets.length) return res.json({ ok: true });

        if (m.updated_at) sets.push(`updated_at = now()`);

        vals.push(id);

        const sql = `
          UPDATE companies
          SET ${sets.join(", ")}
          WHERE id=$${vals.length}
          RETURNING
            id,
            ${selExpr(m.name ? m.name : null, "name")},
            ${selExpr(m.slug ? m.slug : null, "slug")},
            ${selExpr(m.description ? m.description : null, "description")},
            ${selExpr(m.phone ? m.phone : null, "phone")},
            ${selExpr(m.email ? m.email : null, "email")},
            ${selExpr(m.website ? m.website : null, "website")},
            ${selExpr(m.address ? m.address : null, "address")},
            ${selExpr(m.city ? m.city : null, "city")},
            ${selExpr(m.work_hours ? m.work_hours : null, "work_hours")},
            ${selExpr(m.vk_url ? m.vk_url : null, "vk_url")},
            ${selExpr(m.tg_url ? m.tg_url : null, "tg_url")},
            ${selExpr(m.youtube_url ? m.youtube_url : null, "youtube_url")},
            ${selExpr(m.region_id ? m.region_id : null, "region_id")},
            (SELECT name FROM regions WHERE id = companies.region_id) as region_name,
            ${selExpr(m.logo_url ? m.logo_url : null, "logo_url")},
            ${selExpr(m.cover_image ? m.cover_image : null, "cover_image")},
            ${selExpr(m.photos ? m.photos : null, "photos")},
            ${selExpr(m.is_verified ? m.is_verified : null, "is_verified")},
            ${selExpr(m.rating ? m.rating : null, "rating")},
            ${selExpr(m.reviews_count ? m.reviews_count : null, "reviews_count")}
        `;

        const r = await pool.query(sql, vals);
        if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
        return res.json({ ok: true, item: r.rows[0] });
      } catch (e) {
        return next(e);
      }
    });

    app.delete(`${base}/companies/:id`, requireSuperadmin, async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
          return res.status(400).json({ ok: false, error: "bad_id" });
        }

        const m = await companiesMapping();
        const cols = await getCompaniesCols();

        if (m.is_active) {
          const r = await pool.query(
            `
            update companies
            set ${m.is_active}=false${cols.has("updated_at") ? ", updated_at = now()" : ""}
            where id=$1
            returning id
            `,
            [id]
          );
          if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
          return res.json({ ok: true, id });
        }

        const r = await pool.query(`delete from companies where id=$1 returning id`, [id]);
        if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
        return res.json({ ok: true, id });
      } catch (e) {
        return next(e);
      }
    });
  }

  registerCompaniesRoutes("/admin");
  registerCompaniesRoutes("/master");

  // =========================================================
  // MASTER: REGIONS (CRUD)
  // =========================================================

  function registerRegionsRoutes(base) {
    app.get(`${base}/regions`, requireSuperadmin, async (_req, res, next) => {
      try {
        const r = await pool.query(`select id, slug, name from regions order by name asc`);
        return res.json({ ok: true, items: r.rows });
      } catch (e) {
        return next(e);
      }
    });

    app.post(`${base}/regions`, requireSuperadmin, async (req, res, next) => {
      try {
        const name = String(req.body?.name || "").trim();
        const slug = String(req.body?.slug || "").trim();
        if (!name) return res.status(400).json({ ok: false, error: "bad_name" });
        if (!slug) return res.status(400).json({ ok: false, error: "bad_slug" });

        const r = await pool.query(
          `insert into regions (name, slug) values ($1,$2) returning id, name, slug`,
          [name, slug]
        );
        return res.json({ ok: true, item: r.rows[0] });
      } catch (e) {
        return next(e);
      }
    });

    app.patch(`${base}/regions/:id`, requireSuperadmin, async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "bad_id" });

        const name = cleanStr(req.body?.name);
        const slug = cleanStr(req.body?.slug);

        const sets = [];
        const vals = [];
        const put = (col, v) => {
          vals.push(v);
          sets.push(`${col}=$${vals.length}`);
        };

        if (name !== undefined) put("name", name);
        if (slug !== undefined) put("slug", slug);

        if (!sets.length) return res.json({ ok: true });

        vals.push(id);
        const r = await pool.query(
          `update regions set ${sets.join(", ")} where id=$${vals.length} returning id, name, slug`,
          vals
        );
        if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
        return res.json({ ok: true, item: r.rows[0] });
      } catch (e) {
        return next(e);
      }
    });

    app.delete(`${base}/regions/:id`, requireSuperadmin, async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "bad_id" });

        await pool.query(`delete from regions where id=$1`, [id]);
        return res.json({ ok: true });
      } catch (e) {
        return next(e);
      }
    });
  }

  registerRegionsRoutes("/admin");
  registerRegionsRoutes("/master");

  // =========================================================
  // MASTER: PRODUCT CATEGORIES (CRUD + SEO + image urls)
  // =========================================================

  app.get("/admin/product-categories", requireSuperadmin, async (req, res, next) => {
    try {
      const flat = String(req.query.flat || "") === "1";

      const { rows } = await pool.query(`
        SELECT
          id, slug, name, parent_id, sort_order, is_active,
          image_url, image_thumb_url,
          seo_h1, seo_title, seo_description, seo_text
        FROM product_categories
        ORDER BY sort_order, name;
      `);

      if (flat) return res.json({ ok: true, result: rows });

      const byId = new Map(rows.map((r) => [r.id, { ...r, children: [] }]));
      const roots = [];
      for (const r of byId.values()) {
        if (r.parent_id && byId.has(r.parent_id)) byId.get(r.parent_id).children.push(r);
        else roots.push(r);
      }

      return res.json({ ok: true, result: roots });
    } catch (e) {
      return next(e);
    }
  });

  app.post("/admin/product-categories", requireSuperadmin, async (req, res, next) => {
    try {
      const name = String(req.body?.name || "").trim();
      const slug = String(req.body?.slug || "").trim();

      const parent_id = req.body?.parent_id ? Number(req.body.parent_id) : null;
      const sort_order = req.body?.sort_order ? Number(req.body.sort_order) : 0;
      const is_active = req.body?.is_active === undefined ? true : !!req.body.is_active;

      if (!name) return res.status(400).json({ ok: false, error: "bad_name" });
      if (!slug) return res.status(400).json({ ok: false, error: "bad_slug" });

      const r = await pool.query(
        `insert into product_categories (name, slug, parent_id, sort_order, is_active)
         values ($1,$2,$3,$4,$5)
         returning id, name, slug, parent_id, sort_order, is_active`,
        [name, slug, parent_id, sort_order, is_active]
      );

      return res.json({ ok: true, item: r.rows[0] });
    } catch (e) {
      return next(e);
    }
  });

  app.patch("/admin/product-categories/:id", requireSuperadmin, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "bad_id" });

      const name = cleanStr(req.body?.name);
      const slug = cleanStr(req.body?.slug);

      const parent_id =
        req.body?.parent_id === undefined
          ? undefined
          : req.body.parent_id
            ? Number(req.body.parent_id)
            : null;

      const sort_order =
        req.body?.sort_order === undefined ? undefined : Number(req.body.sort_order || 0);
      const is_active = req.body?.is_active === undefined ? undefined : !!req.body.is_active;

      const image_url = cleanStr(req.body?.image_url);
      const image_thumb_url = cleanStr(req.body?.image_thumb_url);

      const seo_h1 = sanitizeText(req.body?.seo_h1, 300);
      const seo_title = sanitizeText(req.body?.seo_title, 500);
      const seo_description = sanitizeText(req.body?.seo_description, 1000);
      const seo_text = sanitizeText(req.body?.seo_text, 20000);

      const sets = [];
      const vals = [];
      const put = (col, v) => {
        vals.push(v);
        sets.push(`${col}=$${vals.length}`);
      };

      if (name !== undefined) put("name", name);
      if (slug !== undefined) put("slug", slug);
      if (parent_id !== undefined) put("parent_id", parent_id);
      if (sort_order !== undefined) put("sort_order", sort_order);
      if (is_active !== undefined) put("is_active", is_active);

      if (image_url !== undefined) put("image_url", image_url);
      if (image_thumb_url !== undefined) put("image_thumb_url", image_thumb_url);

      if (seo_h1 !== undefined) put("seo_h1", seo_h1);
      if (seo_title !== undefined) put("seo_title", seo_title);
      if (seo_description !== undefined) put("seo_description", seo_description);
      if (seo_text !== undefined) put("seo_text", seo_text);

      if (!sets.length) return res.json({ ok: true });

      vals.push(id);
      const r = await pool.query(
        `update product_categories set ${sets.join(", ")} where id=$${vals.length}
         returning id, slug, name, parent_id, sort_order, is_active,
                  image_url, image_thumb_url,
                  seo_h1, seo_title, seo_description, seo_text`,
        vals
      );

      if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
      return res.json({ ok: true, item: r.rows[0] });
    } catch (e) {
      return next(e);
    }
  });

  // =========================================================
  // PRODUCT CATEGORY IMAGE UPLOAD (webp big 1000w + thumb 70x50)
  // POST /admin/product-categories/:id/image   (multipart/form-data, field: file)
  // =========================================================
  app.post("/admin/product-categories/:id/image", requireSuperadmin, async (req, res, next) => {
    try {
      // deps check
      let sharp;
      let mw;
      try {
        sharp = await getSharp();
        mw = await buildUploadMiddleware();
      } catch (_e) {
        return res.status(500).json({
          ok: false,
          error: "upload_deps_missing",
          details: "Install dependencies in apps/api: multer + sharp",
        });
      }

      await runMiddleware(req, res, mw);

      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ ok: false, error: "bad_id" });
      }
      if (!req.file?.buffer) {
        return res.status(400).json({ ok: false, error: "no_file" });
      }

      // check category exists + slug
      const catR = await pool.query(`select id, slug from product_categories where id=$1 limit 1`, [
        id,
      ]);
      if (!catR.rowCount) return res.status(404).json({ ok: false, error: "not_found" });

      const slug = safeSlugPart(catR.rows[0].slug || `cat-${id}`);
      const stamp = Date.now();
      const rnd = crypto.randomBytes(5).toString("hex");

      const bigName = `${slug}-${id}-${stamp}-${rnd}.webp`;
      const thumbName = `${slug}-${id}-${stamp}-${rnd}-70x50.webp`;

      const bigPath = path.join(PCAT_DIR, bigName);
      const thumbPath = path.join(PCAT_DIR, thumbName);

      // ensure dir exists
      fs.mkdirSync(PCAT_DIR, { recursive: true });

      // big: width 1000px
      await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 1000, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(bigPath);

      // thumb: 70x50 cover
      await sharp(req.file.buffer)
        .rotate()
        .resize(70, 50, { fit: "cover", position: "centre" })
        .webp({ quality: 82 })
        .toFile(thumbPath);

      const image_url = `/uploads/product-categories/${bigName}`;
      const image_thumb_url = `/uploads/product-categories/${thumbName}`;

      const upd = await pool.query(
        `
          update product_categories
          set image_url=$1, image_thumb_url=$2
          where id=$3
          returning id, slug, name, parent_id, sort_order, is_active,
                    image_url, image_thumb_url,
                    seo_h1, seo_title, seo_description, seo_text
        `,
        [image_url, image_thumb_url, id]
      );

      return res.json({ ok: true, item: upd.rows[0] });
    } catch (e) {
      // multer error code mapping
      if (e && typeof e === "object") {
        const msg = String(e.message || "");
        if (msg === "bad_file_type")
          return res.status(400).json({ ok: false, error: "bad_file_type" });
        if (e.code === "LIMIT_FILE_SIZE")
          return res.status(413).json({ ok: false, error: "file_too_large" });
      }
      return next(e);
    }
  });

  app.delete("/admin/product-categories/:id", requireSuperadmin, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "bad_id" });

      await pool.query(`update product_categories set is_active=false where id=$1`, [id]);
      return res.json({ ok: true });
    } catch (e) {
      return next(e);
    }
  });

  // =========================================================
  // PRODUCT CATEGORY REGION SEO
  // =========================================================

  app.get("/admin/product-category-region-seo", requireSuperadmin, async (req, res, next) => {
    try {
      const region_id = Number(req.query.region_id);
      const category_id = Number(req.query.category_id);

      if (!Number.isFinite(region_id) || region_id <= 0)
        return res.status(400).json({ ok: false, error: "bad_region_id" });
      if (!Number.isFinite(category_id) || category_id <= 0)
        return res.status(400).json({ ok: false, error: "bad_category_id" });

      const r = await pool.query(
        `select id, region_id, category_id, seo_h1, seo_title, seo_description, seo_text
         from product_category_region_seo
         where region_id=$1 and category_id=$2
         limit 1`,
        [region_id, category_id]
      );

      return res.json({ ok: true, item: r.rows[0] || null });
    } catch (e) {
      return next(e);
    }
  });

  app.put("/admin/product-category-region-seo", requireSuperadmin, async (req, res, next) => {
    try {
      const region_id = Number(req.body?.region_id);
      const category_id = Number(req.body?.category_id);

      if (!Number.isFinite(region_id) || region_id <= 0)
        return res.status(400).json({ ok: false, error: "bad_region_id" });
      if (!Number.isFinite(category_id) || category_id <= 0)
        return res.status(400).json({ ok: false, error: "bad_category_id" });

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
    } catch (e) {
      return next(e);
    }
  });

  app.delete("/admin/product-category-region-seo", requireSuperadmin, async (req, res, next) => {
    try {
      const region_id = Number(req.query.region_id);
      const category_id = Number(req.query.category_id);

      if (!Number.isFinite(region_id) || region_id <= 0)
        return res.status(400).json({ ok: false, error: "bad_region_id" });
      if (!Number.isFinite(category_id) || category_id <= 0)
        return res.status(400).json({ ok: false, error: "bad_category_id" });

      await pool.query(
        `delete from product_category_region_seo where region_id=$1 and category_id=$2`,
        [region_id, category_id]
      );
      return res.json({ ok: true });
    } catch (e) {
      return next(e);
    }
  });

  // =========================================================
  // SERVICE CATEGORIES (CRUD + SEO + image urls + upload)
  // =========================================================

  app.get("/admin/service-categories", requireSuperadmin, async (req, res, next) => {
    try {
      const flat = String(req.query.flat || "") === "1";

      const { rows } = await pool.query(`
        SELECT
          id, slug, name, parent_id, sort_order, is_active,
          image_url, image_thumb_url,
          seo_h1, seo_title, seo_description, seo_text
        FROM service_categories
        ORDER BY sort_order, name;
      `);

      if (flat) return res.json({ ok: true, result: rows });

      const byId = new Map(rows.map((r) => [r.id, { ...r, children: [] }]));
      const roots = [];
      for (const r of byId.values()) {
        if (r.parent_id && byId.has(r.parent_id)) byId.get(r.parent_id).children.push(r);
        else roots.push(r);
      }

      return res.json({ ok: true, result: roots });
    } catch (e) {
      return next(e);
    }
  });

  app.post("/admin/service-categories", requireSuperadmin, async (req, res, next) => {
    try {
      const name = String(req.body?.name || "").trim();
      const slug = String(req.body?.slug || "").trim();

      const parent_id = req.body?.parent_id ? Number(req.body.parent_id) : null;
      const sort_order = req.body?.sort_order ? Number(req.body.sort_order) : 0;
      const is_active = req.body?.is_active === undefined ? true : !!req.body.is_active;

      if (!name) return res.status(400).json({ ok: false, error: "bad_name" });
      if (!slug) return res.status(400).json({ ok: false, error: "bad_slug" });

      const r = await pool.query(
        `insert into service_categories (name, slug, parent_id, sort_order, is_active)
         values ($1,$2,$3,$4,$5)
         returning id, name, slug, parent_id, sort_order, is_active`,
        [name, slug, parent_id, sort_order, is_active]
      );

      return res.json({ ok: true, item: r.rows[0] });
    } catch (e) {
      return next(e);
    }
  });

  app.patch("/admin/service-categories/:id", requireSuperadmin, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "bad_id" });

      const name = cleanStr(req.body?.name);
      const slug = cleanStr(req.body?.slug);

      const parent_id =
        req.body?.parent_id === undefined
          ? undefined
          : req.body.parent_id
            ? Number(req.body.parent_id)
            : null;

      const sort_order =
        req.body?.sort_order === undefined ? undefined : Number(req.body.sort_order || 0);
      const is_active = req.body?.is_active === undefined ? undefined : !!req.body.is_active;

      const image_url = cleanStr(req.body?.image_url);
      const image_thumb_url = cleanStr(req.body?.image_thumb_url);

      const seo_h1 = sanitizeText(req.body?.seo_h1, 300);
      const seo_title = sanitizeText(req.body?.seo_title, 500);
      const seo_description = sanitizeText(req.body?.seo_description, 1000);
      const seo_text = sanitizeText(req.body?.seo_text, 20000);

      const sets = [];
      const vals = [];
      const put = (col, v) => {
        vals.push(v);
        sets.push(`${col}=$${vals.length}`);
      };

      if (name !== undefined) put("name", name);
      if (slug !== undefined) put("slug", slug);
      if (parent_id !== undefined) put("parent_id", parent_id);
      if (sort_order !== undefined) put("sort_order", sort_order);
      if (is_active !== undefined) put("is_active", is_active);

      if (image_url !== undefined) put("image_url", image_url);
      if (image_thumb_url !== undefined) put("image_thumb_url", image_thumb_url);

      if (seo_h1 !== undefined) put("seo_h1", seo_h1);
      if (seo_title !== undefined) put("seo_title", seo_title);
      if (seo_description !== undefined) put("seo_description", seo_description);
      if (seo_text !== undefined) put("seo_text", seo_text);

      if (!sets.length) return res.json({ ok: true });

      vals.push(id);
      const r = await pool.query(
        `update service_categories set ${sets.join(", ")} where id=$${vals.length}
         returning id, slug, name, parent_id, sort_order, is_active,
                  image_url, image_thumb_url,
                  seo_h1, seo_title, seo_description, seo_text`,
        vals
      );

      if (!r.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
      return res.json({ ok: true, item: r.rows[0] });
    } catch (e) {
      return next(e);
    }
  });

  // =========================================================
  // SERVICE CATEGORY IMAGE UPLOAD (webp big 1000w + thumb 70x50)
  // POST /admin/service-categories/:id/image   (multipart/form-data, field: file)
  // =========================================================
  app.post("/admin/service-categories/:id/image", requireSuperadmin, async (req, res, next) => {
    try {
      // deps check
      let sharp;
      let mw;
      try {
        sharp = await getSharp();
        mw = await buildUploadMiddleware();
      } catch (_e) {
        return res.status(500).json({
          ok: false,
          error: "upload_deps_missing",
          details: "Install dependencies in apps/api: multer + sharp",
        });
      }

      await runMiddleware(req, res, mw);

      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ ok: false, error: "bad_id" });
      }
      if (!req.file?.buffer) {
        return res.status(400).json({ ok: false, error: "no_file" });
      }

      // check category exists + slug
      const catR = await pool.query(`select id, slug from service_categories where id=$1 limit 1`, [
        id,
      ]);
      if (!catR.rowCount) return res.status(404).json({ ok: false, error: "not_found" });

      const slug = safeSlugPart(catR.rows[0].slug || `cat-${id}`);
      const stamp = Date.now();
      const rnd = crypto.randomBytes(5).toString("hex");

      const bigName = `${slug}-${id}-${stamp}-${rnd}.webp`;
      const thumbName = `${slug}-${id}-${stamp}-${rnd}-70x50.webp`;

      const bigPath = path.join(SCAT_DIR, bigName);
      const thumbPath = path.join(SCAT_DIR, thumbName);

      // ensure dir exists
      fs.mkdirSync(SCAT_DIR, { recursive: true });

      // big: width 1000px
      await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 1000, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(bigPath);

      // thumb: 70x50 cover
      await sharp(req.file.buffer)
        .rotate()
        .resize(70, 50, { fit: "cover", position: "centre" })
        .webp({ quality: 82 })
        .toFile(thumbPath);

      const image_url = `/uploads/service-categories/${bigName}`;
      const image_thumb_url = `/uploads/service-categories/${thumbName}`;

      const upd = await pool.query(
        `
          update service_categories
          set image_url=$1, image_thumb_url=$2
          where id=$3
          returning id, slug, name, parent_id, sort_order, is_active,
                    image_url, image_thumb_url,
                    seo_h1, seo_title, seo_description, seo_text
        `,
        [image_url, image_thumb_url, id]
      );

      return res.json({ ok: true, item: upd.rows[0] });
    } catch (e) {
      // multer error code mapping
      if (e && typeof e === "object") {
        const msg = String(e.message || "");
        if (msg === "bad_file_type")
          return res.status(400).json({ ok: false, error: "bad_file_type" });
        if (e.code === "LIMIT_FILE_SIZE")
          return res.status(413).json({ ok: false, error: "file_too_large" });
      }
      return next(e);
    }
  });

  app.delete("/admin/service-categories/:id", requireSuperadmin, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "bad_id" });

      await pool.query(`update service_categories set is_active=false where id=$1`, [id]);
      return res.json({ ok: true });
    } catch (e) {
      return next(e);
    }
  });

  // =========================================================
  // SERVICE CATEGORY REGION SEO (как у тебя)
  // =========================================================

  app.get("/admin/service-category-region-seo", requireSuperadmin, async (req, res, next) => {
    try {
      const region_id = Number(req.query.region_id);
      const category_id = Number(req.query.category_id);

      if (!Number.isFinite(region_id) || region_id <= 0)
        return res.status(400).json({ ok: false, error: "bad_region_id" });
      if (!Number.isFinite(category_id) || category_id <= 0)
        return res.status(400).json({ ok: false, error: "bad_category_id" });

      const r = await pool.query(
        `select id, region_id, category_id, seo_h1, seo_title, seo_description, seo_text
         from service_category_region_seo
         where region_id=$1 and category_id=$2
         limit 1`,
        [region_id, category_id]
      );

      return res.json({ ok: true, item: r.rows[0] || null });
    } catch (e) {
      return next(e);
    }
  });

  app.put("/admin/service-category-region-seo", requireSuperadmin, async (req, res, next) => {
    try {
      const region_id = Number(req.body?.region_id);
      const category_id = Number(req.body?.category_id);

      if (!Number.isFinite(region_id) || region_id <= 0)
        return res.status(400).json({ ok: false, error: "bad_region_id" });
      if (!Number.isFinite(category_id) || category_id <= 0)
        return res.status(400).json({ ok: false, error: "bad_category_id" });

      const seo_h1 = sanitizeText(req.body?.seo_h1, 300);
      const seo_title = sanitizeText(req.body?.seo_title, 500);
      const seo_description = sanitizeText(req.body?.seo_description, 1000);
      const seo_text = sanitizeText(req.body?.seo_text, 20000);

      const r = await pool.query(
        `
        insert into service_category_region_seo
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
    } catch (e) {
      return next(e);
    }
  });

  app.delete("/admin/service-category-region-seo", requireSuperadmin, async (req, res, next) => {
    try {
      const region_id = Number(req.query.region_id);
      const category_id = Number(req.query.category_id);

      if (!Number.isFinite(region_id) || region_id <= 0)
        return res.status(400).json({ ok: false, error: "bad_region_id" });
      if (!Number.isFinite(category_id) || category_id <= 0)
        return res.status(400).json({ ok: false, error: "bad_category_id" });

      await pool.query(
        `delete from service_category_region_seo where region_id=$1 and category_id=$2`,
        [region_id, category_id]
      );
      return res.json({ ok: true });
    } catch (e) {
      return next(e);
    }
  });
}
