// apps/web/app/robots.ts
import type { MetadataRoute } from "next";

const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").replace(/\/+$/, "") ||
  "https://moydompro.ru";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: ["/"], // ✅ запретить всё
      },
    ],
    // можно оставить — не мешает, но индексировать всё равно не будут
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
