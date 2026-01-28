// apps/web/app/journal/[slug]/ArticleViewer.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

export function ArticleViewer({ htmlContent }: { htmlContent: string }) {
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [isOpen, setIsOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    if (!contentRef.current) return;

    // 1. Находим все картинки внутри контента
    const imgNodes = contentRef.current.querySelectorAll("img");
    
    // Фильтруем картинки (например, исключаем смайлики или слишком мелкие, если нужно)
    const imgArray = Array.from(imgNodes).filter(img => 
      !img.classList.contains("emoji") && 
      img.getAttribute("src")
    );

    // 2. Собираем массив URL
    const urls = imgArray.map(img => img.getAttribute("src") || "");
    setImages(urls);

    // 3. Вешаем обработчик клика
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

  const closeLightbox = () => setIsOpen(false);
  
  const nextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev + 1) % images.length);
  };
  
  const prevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Обработка клавиш (Escape, стрелки)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
      if (e.key === "ArrowRight") setPhotoIndex((prev) => (prev + 1) % images.length);
      if (e.key === "ArrowLeft") setPhotoIndex((prev) => (prev - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, images.length]);

  return (
    <>
      <div
        ref={contentRef}
        className={styles.articleBody}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />

      {/* Встроенный Lightbox */}
      {isOpen && (
        <div 
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(5px)'
          }}
          onClick={closeLightbox}
        >
          {/* Кнопка закрытия */}
          <button
            onClick={closeLightbox}
            style={{
              position: 'absolute', top: 20, right: 20,
              background: 'none', border: 'none', color: '#fff',
              fontSize: '40px', cursor: 'pointer', zIndex: 10002,
              lineHeight: 1
            }}
            aria-label="Закрыть"
          >
            &times;
          </button>

          {/* Навигация (если больше 1 фото) */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevPhoto}
                style={{
                  position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
                  fontSize: '30px', cursor: 'pointer', padding: '15px', borderRadius: '50%',
                  zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 50, height: 50
                }}
                aria-label="Назад"
              >
                &#10094;
              </button>
              <button
                onClick={nextPhoto}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
                  fontSize: '30px', cursor: 'pointer', padding: '15px', borderRadius: '50%',
                  zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 50, height: 50
                }}
                aria-label="Вперед"
              >
                &#10095;
              </button>
            </>
          )}

          {/* Изображение */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[photoIndex]}
            alt={`Full size ${photoIndex + 1}`}
            style={{
              maxWidth: '90vw', maxHeight: '90vh',
              objectFit: 'contain', userSelect: 'none',
              boxShadow: '0 0 20px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()} // Клик по картинке не закрывает
          />
          
          {/* Счетчик */}
          <div style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            color: '#fff', fontSize: '14px', opacity: 0.8,
            background: 'rgba(0,0,0,0.5)', padding: '4px 12px', borderRadius: '20px'
          }}>
            {photoIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}
