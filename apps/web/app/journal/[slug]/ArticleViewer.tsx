// apps/web/app/journal/[slug]/ArticleViewer.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
// ✅ Импортируем ваш существующий компонент лайтбокса
import GalleryLightbox from "@/components/GalleryLightbox"; 

export function ArticleViewer({ htmlContent }: { htmlContent: string }) {
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [isOpen, setIsOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    if (!contentRef.current) return;

    // 1. Находим все картинки внутри контента (и в тексте, и в галерее)
    // Исключаем системные иконки, если есть, проверяя класс или размер
    const imgNodes = contentRef.current.querySelectorAll("img");
    const imgArray = Array.from(imgNodes).filter(img => 
      !img.classList.contains("emoji") && // пример фильтра
      img.getAttribute("src")
    );

    // 2. Собираем массив URL для лайтбокса
    const urls = imgArray.map(img => img.getAttribute("src") || "");
    setImages(urls);

    // 3. Вешаем обработчик клика на каждую картинку
    imgArray.forEach((img, index) => {
      img.style.cursor = "zoom-in";
      img.onclick = (e) => {
        e.preventDefault();
        setPhotoIndex(index);
        setIsOpen(true);
      };
    });

    // Очистка при размонтировании
    return () => {
      imgArray.forEach(img => {
        img.onclick = null;
      });
    };
  }, [htmlContent]);

  return (
    <>
      {/* Рендерим HTML статьи */}
      <div
        ref={contentRef}
        className={styles.articleBody}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />

      {/* Лайтбокс открывается поверх */}
      {isOpen && (
        <div style={{ position: 'fixed', zIndex: 9999, inset: 0 }}>
           {/* ВАЖНО: Здесь используется ваш GalleryLightbox.
             Если он не поддерживает пропы isOpen/onClose/index напрямую,
             а работает только по списку картинок, нужно его адаптировать 
             или использовать библиотеку типа 'yet-another-react-lightbox'.
             
             Ниже пример использования, если GalleryLightbox умеет работать как модалка:
           */}
           <GalleryLightbox 
              images={images} 
              // Если ваш компонент принимает индекс стартовой картинки:
              initialIndex={photoIndex} 
              // Если компоненту нужно передать управление видимостью:
              // isOpen={isOpen}
              // onClose={() => setIsOpen(false)}
           />
           
           {/* ПРОСТОЙ ЗАПАСНОЙ ВАРИАНТ (Если GalleryLightbox это просто сетка):
             Нужно добавить кнопку закрытия поверх, если компонент сам это не делает.
           */}
           <button 
             onClick={() => setIsOpen(false)}
             style={{
               position: "fixed", top: 20, right: 20, zIndex: 10000,
               background: "rgba(0,0,0,0.5)", color: "#fff", 
               border: "none", borderRadius: "50%", width: 40, height: 40, 
               fontSize: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
             }}
           >
             ×
           </button>
        </div>
      )}
    </>
  );
}
