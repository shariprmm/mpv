import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const catalogPath =
  process.argv[2] ??
  path.resolve(process.cwd(), "packages/db/seeds/mpv_services_catalog_v1.json");

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query("BEGIN");

// 1) Categories
for (const c of catalog.categories || []) {
  await client.query(
    `
    INSERT INTO service_categories (slug, name)
    VALUES ($1, $2)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    `,
    [c.slug, c.name]
  );
}

// 2) Map slug -> id
const { rows: catRows } = await client.query(
  `SELECT id, slug FROM service_categories`
);
const catIdBySlug = new Map(catRows.map((r) => [r.slug, r.id]));

// 3) Services
for (const s of catalog.services || []) {
  const categoryId = catIdBySlug.get(s.category_slug);
  if (!categoryId) continue;

  await client.query(
    `
    INSERT INTO services (
      category_id, slug, name,
      synonyms, default_unit, lead_form_key,
      seo_title_template, seo_description_template,
      faq_template
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (slug) DO UPDATE SET
      category_id = EXCLUDED.category_id,
      name = EXCLUDED.name,
      synonyms = EXCLUDED.synonyms,
      default_unit = EXCLUDED.default_unit,
      lead_form_key = EXCLUDED.lead_form_key,
      seo_title_template = EXCLUDED.seo_title_template,
      seo_description_template = EXCLUDED.seo_description_template,
      faq_template = EXCLUDED.faq_template
    `,
    [
      categoryId,
      s.slug,
      s.name,
      JSON.stringify(s.synonyms || []),
      s.default_unit || null,
      s.lead_form_key || null,
      s.seo_title_template || null,
      s.seo_description_template || null,
      JSON.stringify(s.faq_template || []),
    ]
  );
}

await client.query("COMMIT");
await client.end();

console.log("OK: services catalog seeded");