// apps/web/app/journal/[slug]/ArticleViewer.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import styles from "./page.module.css";

// Иконки (можно вынести в отдельные компоненты, но для компактности оставим тут)
const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);
const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
);
const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
);

export function ArticleViewer({ htmlContent }: { htmlContent: string }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [images, setImages] = useState<string[]>([]);

  // Парсинг картинок и навешивание обработчиков
  useEffect(() => {
    if (!contentRef.current) return;
    const imgNodes = contentRef.current.querySelectorAll("img");
    const imgArray = Array.from(imgNodes).filter(img => 
      !img.classList.contains("emoji") && img.getAttribute("src")
    );
    const urls = imgArray.map(img => img.getAttribute("src") || "");
    setImages(urls);

    imgArray.forEach((img, index) => {
      img.style.cursor = "zoom-in";
      img.onclick = (e) => {
        e.preventDefault();
        setPhotoIndex(index);
        setIsOpen(true);
      };
    });

    return () => {
      imgArray.forEach(img => img.onclick = null);
    };
  }, [htmlContent]);

  // Управление лайтбоксом
  const closeLightbox = useCallback(() => setIsOpen(false), []);
  const nextPhoto = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPhotoIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);
  const prevPhoto = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPhotoIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // Обработка клавиш
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nextPhoto();
      if (e.key === "ArrowLeft") prevPhoto();
    };
    window.addEventListener("keydown", handler);
    // Блокируем скролл страницы
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = '';
    };
  }, [isOpen, nextPhoto, prevPhoto, closeLightbox]);

  // Общие стили для кнопок
  const buttonStyle: React.CSSProperties = {
    position: 'absolute',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
    border: 'none', borderRadius: '50%', color: '#fff', cursor: 'pointer', zIndex: 10002,
    transition: 'background 0.2s',
  };

  return (
    <>
      <div ref={contentRef} className={styles.articleBody} dangerouslySetInnerHTML={{ __html: htmlContent }} />

      {/* Встроенный Lightbox */}
      {isOpen && (
        <div 
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)',
          }}
          onClick={closeLightbox}
        >
          {/* Кнопка закрытия (Слева вверху) */}
          <button
            onClick={closeLightbox}
            style={{ ...buttonStyle, top: '20px', left: '20px', width: '44px', height: '44px' }}
            aria-label="Закрыть"
          >
            <CloseIcon />
          </button>

          {/* Навигация */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevPhoto}
                style={{ ...buttonStyle, left: '20px', top: '50%', transform: 'translateY(-50%)', width: '56px', height: '56px' }}
                aria-label="Назад"
              >
                <ChevronLeftIcon />
              </button>
              <button
                onClick={nextPhoto}
                style={{ ...buttonStyle, right: '20px', top: '50%', transform: 'translateY(-50%)', width: '56px', height: '56px' }}
                aria-label="Вперед"
              >
                <ChevronRightIcon />
              </button>
            </>
          )}

          {/* Изображение */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[photoIndex]}
            alt={`Фото ${photoIndex + 1}`}
            style={{
              maxWidth: '92vw', maxHeight: '92vh',
              objectFit: 'contain', userSelect: 'none',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()} 
          />
          
          {/* Счетчик (Слева внизу) */}
          <div style={{
            position: 'absolute', bottom: '20px', left: '20px',
            color: '#fff', fontSize: '14px', fontWeight: 600,
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            padding: '8px 16px', borderRadius: '30px'
          }}>
            {photoIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}
