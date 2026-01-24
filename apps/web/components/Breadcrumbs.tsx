// apps/web/components/Breadcrumbs.tsx
import Link from "next/link";

export type Crumb = {
  // поддерживаем разные варианты полей, чтобы не чинить все страницы вручную
  label?: string;
  title?: string;
  name?: string;
  href?: string;
};

function getText(c: Crumb): string {
  return c.label ?? c.title ?? c.name ?? "";
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items?.length) return null;

  return (
    <nav aria-label="Breadcrumbs" style={{ fontSize: 14, margin: "8px 0 16px" }}>
      <ol
        style={{
          display: "flex",
          gap: 8,
          listStyle: "none",
          padding: 0,
          margin: 0,
          flexWrap: "wrap",
        }}
      >
        {items.map((c, idx) => {
          const isLast = idx === items.length - 1;
          const text = getText(c);

          return (
            <li
              key={`${text}-${idx}`}
              style={{ display: "flex", gap: 8, alignItems: "center" }}
            >
              {c.href && !isLast ? (
                <Link href={c.href} style={{ textDecoration: "none" }}>
                  {text}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} style={{ opacity: isLast ? 1 : 0.8 }}>
                  {text}
                </span>
              )}
              {!isLast && <span style={{ opacity: 0.5 }}>/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
