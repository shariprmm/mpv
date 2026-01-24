// apps/web/components/Breadcrumbs.tsx
import Link from "next/link";
import styles from "./Breadcrumbs.module.css";

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
    <nav aria-label="Breadcrumbs" className={styles.nav}>
      <ol className={styles.list}>
        {items.map((c, idx) => {
          const isLast = idx === items.length - 1;
          const text = getText(c);

          return (
            <li key={`${text}-${idx}`} className={styles.item}>
              {c.href && !isLast ? (
                <Link href={c.href} className={styles.link}>
                  {text}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={isLast ? styles.current : styles.crumb}
                >
                  {text}
                </span>
              )}
              {!isLast && <span className={styles.separator}>/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
