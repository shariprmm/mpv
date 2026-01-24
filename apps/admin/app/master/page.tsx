// /apps/admin/app/master/page.tsx
"use client";

import React from "react";
import Link from "next/link";

type CardItem = {
  title: string;
  desc: string;
  href: string;
  color?: string; // Для визуального акцента
};

export default function MasterHome() {
  const items: CardItem[] = [
    {
      title: "Регионы",
      desc: "Управление географией сайта (name/slug).",
      href: "/master/regions",
      color: "bg-blue-50 text-blue-700",
    },
    {
      title: "Категории товаров",
      desc: "Настройка SEO (H1, Title, Text) и вложенности.",
      href: "/master/product-categories",
      color: "bg-indigo-50 text-indigo-700",
    },
    {
      title: "Товары (каноника)",
      desc: "База товаров: описания, фото, характеристики.",
      href: "/master/products",
      color: "bg-purple-50 text-purple-700",
    },
    {
      title: "Категории услуг",
      desc: "Дерево услуг, иконки и базовое SEO.",
      href: "/master/service-categories",
      color: "bg-pink-50 text-pink-700",
    },
    {
      title: "Услуги (каноника)",
      desc: "База услуг для мастеров и компаний.",
      href: "/master/services",
      color: "bg-rose-50 text-rose-700",
    },
    {
      title: "Компании",
      desc: "Модерация профилей, проверка документов, логотипы.",
      href: "/master/companies",
      color: "bg-orange-50 text-orange-700",
    },
    {
      title: "Блог: Статьи",
      desc: "Контент-маркетинг, новости и полезные статьи.",
      href: "/master/blog-posts",
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      title: "Блог: Категории",
      desc: "Рубрикатор для журнала.",
      href: "/master/blog-categories",
      color: "bg-teal-50 text-teal-700",
    },
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Панель управления</h1>
        <p className="text-gray-500 mt-2">Выберите раздел для работы</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="group relative flex flex-col bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 ease-out overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${it.color || 'bg-gray-100 text-gray-600'}`}>
                {it.title.charAt(0)}
              </div>
              <span className="text-gray-300 group-hover:text-blue-600 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
            </div>
            
            <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
              {it.title}
            </h3>
            
            <p className="text-sm text-gray-500 leading-relaxed flex-1">
              {it.desc}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}