// apps/web/app/not-found.tsx
import Link from "next/link";
import type { Metadata } from "next";
import styles from "./not-found.module.css";

export const metadata: Metadata = {
  title: "404 — Страница не найдена | MoyDomPro",
  description: "Запрашиваемая страница не найдена или была удалена.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <main className={styles.nf}>
      <div className={styles.box}>
        <div className={styles.code}>404</div>

        <h1 className={styles.title}>Страница не найдена</h1>

        <p className={styles.desc}>
          Возможно, ссылка устарела, страница была удалена
          <br />
          или вы ошиблись при вводе адреса.
        </p>

        <div className={styles.actions}>
          <Link href="/" className={`${styles.btn} ${styles.primary}`}>
            На главную
          </Link>

          <Link href="/sitemap" className={styles.btn}>
            Карта сайта
          </Link>
        </div>

        <div className={styles.hint}>
          Код ошибки: <b>404 Not Found</b>
        </div>
      </div>
    </main>
  );
}
