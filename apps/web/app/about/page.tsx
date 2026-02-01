// apps/web/app/about/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "О проекте МойДомПро — Честный маркетплейс услуг",
  description: "Бесплатное размещение для компаний и прямой поиск мастеров для заказчиков.",
};

export default function AboutPage() {
  return (
    <main className={styles.wrap}>
      
      {/* 1. HERO BLOCK */}
      <section className={styles.hero}>
        <div className={styles.shell}>
          <div className={styles.heroTag}>Экосистема загородной жизни</div>
          <h1 className={styles.title}>
            Строим <span className={styles.titleSpan}>честные отношения</span><br />
            между заказчиком и мастером
          </h1>
          <p className={styles.subtitle}>
            МойДомПро — это платформа, которая убирает лишних посредников. 
            Мы не берем комиссию с заказов и не скрываем контакты. 
            Только прямая связь и реальные рейтинги.
          </p>
          <div className={styles.heroActions}>
            {/* Ссылка на внешний домен админки */}
            <a href="https://admin.moydompro.ru/register" className={styles.btnPrimary}>
              Я представитель компании
            </a>
            <Link href="/" className={styles.btnSecondary}>
              Я ищу услуги
            </Link>
          </div>
        </div>
      </section>

      {/* 2. INFOGRAPHIC / NUMBERS */}
      <section className={styles.statsSection}>
        <div className={styles.shell}>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <div className={styles.statValue}>0 ₽</div>
              <div className={styles.statLabel}>
                Комиссия сервиса<br />за полученные заявки
              </div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>100%</div>
              <div className={styles.statLabel}>
                Открытые контакты<br />сразу в профиле
              </div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>24/7</div>
              <div className={styles.statLabel}>
                Доступ к каталогу<br />услуг и товаров
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. VALUE PROPOSITION (SPLIT) */}
      <section className={styles.splitSection}>
        <div className={styles.shell}>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2}>Полезно всем</h2>
            <p className={styles.subH2}>
              Мы создали условия, при которых выгодно работать честно и открыто.
            </p>
          </div>

          <div className={styles.cardsGrid}>
            
            {/* Для Компаний */}
            <div className={styles.card}>
              <div className={styles.cardIcon}>🏗️</div>
              <h3 className={styles.cardTitle}>Для компаний и мастеров</h3>
              <ul className={styles.cardList}>
                <li>
                  <b>Бесплатное размещение.</b> Создайте профиль, добавьте услуги и товары — вы ничего не платите за присутствие в каталоге.
                </li>
                <li>
                  <b>Прямые заявки.</b> Мы не продаем лиды. Клиент видит ваш телефон и сайт, и звонит напрямую вам.
                </li>
                <li>
                  <b>SEO-продвижение.</b> Страницы ваших товаров и услуг индексируются поисковиками, приводя трафик из Google и Яндекс.
                </li>
                <li>
                  <b>Репутация.</b> Собирайте отзывы и портфолио в одном месте. Чем полнее профиль, тем выше вы в выдаче.
                </li>
              </ul>
              <a href="https://admin.moydompro.ru/register" className={styles.cardAction}>
                Зарегистрировать компанию →
              </a>
            </div>

            {/* Для Заказчиков */}
            <div className={styles.card}>
              <div className={styles.cardIcon}>🏡</div>
              <h3 className={styles.cardTitle}>Для владельцев домов</h3>
              <ul className={styles.cardList}>
                <li>
                  <b>Без наценок посредников.</b> Так как мы не берем комиссию с мастеров, они могут предложить вам лучшую цену.
                </li>
                <li>
                  <b>Проверенные исполнители.</b> Мы проверяем юридические данные компаний (ИНН) и помечаем надежных галочкой.
                </li>
                <li>
                  <b>Всё в одном месте.</b> От септика и скважины до интернета и отделки. Не нужно искать по десяткам сайтов.
                </li>
                <li>
                  <b>Удобное сравнение.</b> Смотрите цены, примеры работ и отзывы разных бригад на одной странице.
                </li>
              </ul>
              <Link href="/" className={styles.cardAction}>
                Перейти в каталог услуг →
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* 4. THE BIG HOOK (FREE) */}
      <div className={styles.shell}>
        <section className={styles.freeSection}>
          <div className={styles.freeBadge}>Честное предложение</div>
          <h2 className={styles.freeTitle}>Почему бесплатно?</h2>
          <p className={styles.freeText}>
            Мы верим, что рынок загородного строительства должен быть прозрачным. 
            Мы зарабатываем на дополнительных инструментах продвижения для крупных брендов, 
            оставляя базовый функционал доступным для каждого мастера навсегда.
          </p>
          <a href="https://admin.moydompro.ru/register" className={styles.btnSecondary}>
            Создать аккаунт бесплатно
          </a>
        </section>
      </div>

    </main>
  );
}
