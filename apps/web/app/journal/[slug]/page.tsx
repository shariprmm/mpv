// /web/app/journal/[slug]/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import styles from "./page.module.css";
import { ArticleViewer } from "./ArticleViewer"; // Вынесем клиентскую часть сюда

// Конфиг
const API = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "https://api.moydompro.ru";
const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://moydompro.ru").replace(/\/+$/, "");
const CONTENT_ORIGIN =
  (
    process.env.NEXT_PUBLIC_CONTENT_ORIGIN ||
    process.env.NEXT_PUBLIC_BLOG_CONTENT_ORIGIN ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://moydompro.ru"
  ).replace(/\/+$/, "");

// Типы
type Post = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html: string;
  cover_image: string | null;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  category_slug: string | null;
  category_name: string | null;
  images?: PostImage[];
};

type CategoryItem = {
  slug: string;
  name: string;
};

type PostImage = {
  id: number;
  image_url: string;
  sort_order: number;
};

// --- Helpers ---

function toAbsPublicUrl(u: string | null) {
  const s = String(u || "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return "https:" + s;
  if (s.startsWith("/")) return `${SITE_URL}${s}`;
  return `${SITE_URL}/${s}`;
}

function normalizeContentImgSrc(src: string) {
  const s = String(src || "").trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) {
    if (/^https?:\/\/rdm-spb\.ru\//i.test(s) && CONTENT_ORIGIN) {
      return s.replace(/^https?:\/\/rdm-spb\.ru/i, CONTENT_ORIGIN);
    }
    return s;
  }
  if (s.startsWith("//")) return `https:${s}`;
  if (s.startsWith("/")) return `${CONTENT_ORIGIN}${s}`;
  return `${CONTENT_ORIGIN}/${s}`;
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildGalleryHtml(images: PostImage[] | undefined, articleTitle: string) {
  if (!images?.length) return "";
  const title = escapeHtml(articleTitle);
  const items = images
    .map((img, idx) => {
      const src = normalizeContentImgSrc(img.image_url);
      const alt = `${title} — фото ${idx + 1}`;
      // Добавляем класс galleryImg для стилизации и data-attribute для лайтбокса
      return `
        <figure class="${styles.galleryItem}">
          <img class="${styles.galleryImg}" src="${escapeHtml(src)}" alt="${alt}" loading="lazy" decoding="async" data-lightbox="gallery" />
        </figure>
      `;
    })
    .join("");

  return `<div class="${styles.gallery}">${items}</div>`;
}

function injectGalleryAfterParagraphs(
  html: string,
  galleryHtml: string,
  paragraphIndex: number
) {
  if (!galleryHtml) return html;
  const raw = String(html || "");
  if (!raw) return galleryHtml;

  const re = /<\/p\s*>/gi;
  let count = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    count += 1;
    if (count === paragraphIndex) {
      const insertAt = match.index + match[0].length;
      return `${raw.slice(0, insertAt)}${galleryHtml}${raw.slice(insertAt)}`;
    }
  }

  return `${raw}${galleryHtml}`;
}

// --- Data Fetching ---

async function getPost(slug: string): Promise<Post | null> {
  try {
    const r = await fetch(`${API}/public/blog/${encodeURIComponent(slug)}`, {
      next: { revalidate: 120 },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return (j?.post || null) as Post | null;
  } catch {
    return null;
  }
}

async function getCategories(): Promise<CategoryItem[]> {
  try {
    const r = await fetch(`${API}/public/blog/categories`, { next: { revalidate: 600 } });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j?.categories) ? j.categories : [];
  } catch {
    return [];
  }
}

// --- Metadata ---

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return { title: "Статья не найдена" };

  const url = `${SITE_URL}/journal/${post.slug}`;
  const img = toAbsPublicUrl(post.cover_image);

  return {
    title: post.seo_title || post.title,
    description: post.seo_description || post.excerpt || undefined,
    alternates: { canonical: url },
    openGraph: {
      title: post.seo_title || post.title,
      description: post.seo_description || post.excerpt || undefined,
      url,
      type: "article",
      images: img ? [img] : undefined,
    },
  };
}

// --- Page Component ---

export default async function JournalPostPage({ params }: { params: { slug: string } }) {
  const [post, categories] = await Promise.all([getPost(params.slug), getCategories()]);

  if (!post) {
    notFound();
  }

  const cover = toAbsPublicUrl(post.cover_image);
  const url = `${SITE_URL}/journal/${post.slug}`;
  const published = post.published_at ? new Date(post.published_at).toISOString() : null;
  
  // 1. Формируем HTML галереи
  const galleryHtml = buildGalleryHtml(post.images, post.title);
  
  // 2. Вставляем галерею в контент
  // (ensureImgAlts можно пропустить или перенести на клиент, но для SEO лучше тут, 
  //  однако в ArticleViewer мы будем парсить DOM, так что атрибуты для Lightbox там важнее)
  const contentWithGallery = injectGalleryAfterParagraphs(
    post.content_html, // используем raw html, обработку оставим
    galleryHtml,
    4
  );

  // JSON-LD
  const ldBreadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Журнал", item: `${SITE_URL}/journal` },
      ...(post.category_slug && post.category_name
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: post.category_name,
              item: `${SITE_URL}/journal/category/${post.category_slug}`,
            },
          ]
        : []),
      { "@type": "ListItem", position: post.category_slug ? 3 : 2, name: post.title, item: url },
    ],
  };

  const ldArticle = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: post.title,
    description: post.seo_description || post.excerpt || undefined,
    image: cover ? [cover] : undefined,
    datePublished: published,
    dateModified: published,
    author: { "@type": "Organization", name: "МойДомПро" },
    publisher: {
      "@type": "Organization",
      name: "МойДомПро",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/uploads/logo.png` },
    },
  };

  return (
    <main className={styles.wrap}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldBreadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldArticle) }} />

      <div className={styles.shell}>
        <div className={styles.grid}>
          {/* Main Content */}
          <section className={styles.content}>
            <div className={styles.crumbs}>
              <Link href="/journal" className={styles.crumbLink}>Журнал</Link>
              {post.category_slug && post.category_name && (
                <>
                  <span className={styles.crumbSep}>/</span>
                  <Link href={`/journal/category/${post.category_slug}`} className={styles.crumbLink}>
                    {post.category_name}
                  </Link>
                </>
              )}
            </div>

            <h1 className={styles.h1}>{post.title}</h1>

            {post.excerpt && <div className={styles.lead}>{post.excerpt}</div>}

            {cover && (
              <figure className={styles.coverFigure}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.coverImg}
                  src={cover}
                  alt={post.title}
                  loading="eager"
                />
              </figure>
            )}

            {/* ✅ Используем клиентский компонент для рендера HTML + Lightbox */}
            <ArticleViewer htmlContent={contentWithGallery} />

            <div className={styles.cta}>
              <div className={styles.ctaTitle}>Нужна помощь с выбором?</div>
              <p>Оставьте заявку, и проверенные компании свяжутся с вами.</p>
            </div>
          </section>

          {/* Sidebar */}
          <aside className={styles.sidebar}>
            <div className={styles.sideCard}>
              <div className={styles.sideTitle}>Категории</div>
              <nav className={styles.sideNav}>
                {categories.map((c) => (
                  <Link key={c.slug} href={`/journal/category/${c.slug}`} className={styles.sideLink}>
                    {c.name}
                  </Link>
                ))}
                <Link href="/journal" className={`${styles.sideLink} ${styles.sideLinkAll}`}>
                  Все статьи
                </Link>
              </nav>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
