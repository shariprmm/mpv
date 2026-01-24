// /web/app/journal/[slug]/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import styles from "./page.module.css";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

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
};

async function getPost(slug: string): Promise<Post | null> {
  const r = await fetch(`${API}/public/blog/${encodeURIComponent(slug)}`, {
    next: { revalidate: 120 },
  });
  if (!r.ok) return null;
  const j = await r.json();
  return (j?.post || null) as Post | null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return { title: "Статья не найдена — MoyDomPro" };

  return {
    title: post.seo_title || post.title,
    description: post.seo_description || post.excerpt || undefined,
    openGraph: {
      title: post.seo_title || post.title,
      description: post.seo_description || post.excerpt || undefined,
      images: post.cover_image ? [post.cover_image] : undefined,
    },
  };
}

export default async function JournalPostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);

  if (!post) {
    return (
      <main className={styles.main}>
        <h1 className={styles.errorTitle}>Статья не найдена</h1>
        <p>
          <Link href="/journal">Вернуться в журнал</Link>
        </p>
      </main>
    );
  }

  const cover = post.cover_image
    ? post.cover_image.startsWith("http")
      ? post.cover_image
      : API + post.cover_image
    : null;

  return (
    <main className={styles.main}>
      <div className={styles.backRow}>
        <Link href="/journal" className={styles.backLink}>
          ← Журнал
        </Link>
        {post.category_slug && post.category_name && (
          <>
            <span className={styles.separator}> · </span>
            <Link href={`/journal/category/${post.category_slug}`} className={styles.backLink}>
              {post.category_name}
            </Link>
          </>
        )}
      </div>

      <h1 className={styles.title}>{post.title}</h1>

      {post.excerpt && <p className={styles.excerpt}>{post.excerpt}</p>}

      {cover && <div className={styles.cover} style={{ backgroundImage: `url(${cover})` }} />}

      <article
        className={styles.article}
        dangerouslySetInnerHTML={{ __html: post.content_html }}
      />

      {/* Блок-заглушка под перелинковку (дальше подключим услуги/товары/регион) */}
      <div className={styles.stub}>
        <div className={styles.stubTitle}>Подобрать подрядчика</div>
        <div className={styles.stubText}>
          Дальше сюда подключим блок: «Найти услуги/товары в вашем регионе» (через /[region]/services и
          /[region]/products).
        </div>
      </div>
    </main>
  );
}
