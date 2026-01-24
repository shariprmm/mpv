// /apps/admin/app/master/layout.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Список пунктов меню (дублируется для навигации)
const MENU_ITEMS = [
  { title: "Главная", href: "/master" },
  { title: "Регионы", href: "/master/regions" },
  { title: "Категории товаров", href: "/master/product-categories" },
  { title: "Товары (каноника)", href: "/master/products" },
  { title: "Категории услуг", href: "/master/service-categories" }, // Добавил, так как делали ранее
  { title: "Услуги (каноника)", href: "/master/services" },
  { title: "Компании", href: "/master/companies" },
  { title: "Статьи блога", href: "/master/blog-posts" },
  { title: "Категории блога", href: "/master/blog-categories" },
];

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* MOBILE HEADER */}
      <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-20">
        <span className="font-black text-lg">Master Admin</span>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          {isMobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* SIDEBAR (Desktop & Mobile) */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-10 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out
          md:translate-x-0 md:static md:h-auto
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="h-full flex flex-col overflow-y-auto">
          <div className="p-6 border-b border-gray-100 hidden md:block">
            <h2 className="text-xl font-black tracking-tight text-gray-900">Master Panel</h2>
            <p className="text-xs text-gray-400 mt-1">v2.0 · MoyDomPro</p>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {MENU_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)} // Закрываем меню на мобильном при клике
                  className={`
                    block px-4 py-2.5 rounded-xl text-sm font-bold transition-all
                    ${
                      isActive
                        ? "bg-gray-900 text-white shadow-md"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }
                  `}
                >
                  {item.title}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-100">
            <a href="/" className="block text-center text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors">
              ← На основной сайт
            </a>
          </div>
        </div>
      </aside>

      {/* OVERLAY for Mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-0 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}