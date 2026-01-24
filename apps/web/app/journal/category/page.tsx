// /web/app/journal/[slug]/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

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
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Статья не найдена</h1>
        <p style={{ marginTop: 10 }}>
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
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginBottom: 14 }}>
        <Link href="/journal" style={{ textDecoration: "none" }}>
          ← Журнал
        </Link>
        {post.category_slug && post.category_name && (
          <>
            <span style={{ opacity: 0.6 }}> · </span>
            <Link href={`/journal/category/${post.category_slug}`} style={{ textDecoration: "none" }}>
              {post.category_name}
            </Link>
          </>
        )}
      </div>

      <h1 style={{ fontSize: 36, fontWeight: 900, lineHeight: 1.15, marginBottom: 10 }}>
        {post.title}
      </h1>

      {post.excerpt && <p style={{ opacity: 0.85, marginBottom: 18 }}>{post.excerpt}</p>}

      {cover && (
        <div
          style={{
            height: 340,
            borderRadius: 16,
            backgroundImage: `url(${cover})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            marginBottom: 18,
          }}
        />
      )}

      <article
        style={{ fontSize: 18, lineHeight: 1.7 }}
        dangerouslySetInnerHTML={{ __html: post.content_html }}
      />

      {/* Блок-заглушка под перелинковку (дальше подключим услуги/товары/регион) */}
      <div
        style={{
          marginTop: 32,
          padding: 16,
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,.12)",
          background: "rgba(0,0,0,.02)",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Подобрать подрядчика</div>
        <div style={{ opacity: 0.85 }}>
          Дальше сюда подключим блок: «Найти услуги/товары в вашем регионе» (через /[region]/services и /[region]/products).
        </div>
      </div>
    </main>
  );
}
