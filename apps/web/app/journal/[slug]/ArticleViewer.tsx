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
    const imgArray = Array.from(imgNodes).filter(img => 
      !img.classList.contains("emoji") && // фильтр смайликов
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

  return (
    <>
      <div
        ref={contentRef}
        className={styles.articleBody}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />

      {/* Простой самописный Lightbox */}
      {isOpen && (
        <div 
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          onClick={closeLightbox}
        >
          {/* Кнопка закрытия */}
          <button
            onClick={closeLightbox}
            style={{
              position: 'absolute', top: 20, right: 20,
              background: 'none', border: 'none', color: '#fff',
              fontSize: '40px', cursor: 'pointer', zIndex: 10001
            }}
          >
            &times;
          </button>

          {/* Навигация (если больше 1 фото) */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevPhoto}
                style={{
                  position: 'absolute', left: 20,
                  background: 'none', border: 'none', color: '#fff',
                  fontSize: '40px', cursor: 'pointer', padding: '20px', zIndex: 10001
                }}
              >
                &#10094;
              </button>
              <button
                onClick={nextPhoto}
                style={{
                  position: 'absolute', right: 20,
                  background: 'none', border: 'none', color: '#fff',
                  fontSize: '40px', cursor: 'pointer', padding: '20px', zIndex: 10001
                }}
              >
                &#10095;
              </button>
            </>
          )}

          {/* Картинка */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[photoIndex]}
            alt={`Full size ${photoIndex}`}
            style={{
              maxWidth: '90vw', maxHeight: '90vh',
              objectFit: 'contain', userSelect: 'none'
            }}
            onClick={(e) => e.stopPropagation()} // Клик по картинке не закрывает
          />
          
          {/* Счетчик */}
          <div style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            color: '#fff', fontSize: '14px', opacity: 0.8
          }}>
            {photoIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}
