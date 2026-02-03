// apps/admin/app/price/ImportExcelModal.tsx
"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import styles from "./price.module.css";

type Props = {
  onClose: () => void;
  onSuccess: () => void;
  products: any[]; // Список всех товаров для генерации шаблона
};

export default function ImportExcelModal({ onClose, onSuccess, products }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // 1. Генерация CSV шаблона на клиенте (чтобы не дергать бэк)
  const downloadTemplate = () => {
    // Заголовки
    const headers = ["ID", "Название", "Категория", "Текущая цена (Р)", "Новая цена (Р)"];
    
    // Строки данных
    const rows = products.map(p => {
      // Ищем текущую цену в прайсе компании (если передана, иначе 0)
      const currentPrice = p.price_min || 0;
      // Экранируем кавычки для CSV
      const safeName = `"${String(p.name).replace(/"/g, '""')}"`;
      const safeCat = `"${String(p.category_name || "Без категории").replace(/"/g, '""')}"`;
      
      return [p.id, safeName, safeCat, currentPrice, ""];
    });

    const csvContent = [
      "\uFEFF" + headers.join(";"), // BOM для корректного открытия в Excel на Windows
      ...rows.map(r => r.join(";"))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "price_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 2. Обработка файла
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError("");
    }
  };

  // 3. Отправка на сервер
  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Замените на ваш реальный эндпоинт
      const API = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "https://api.moydompro.ru";
      
      const res = await fetch(`${API}/company-items/import-csv`, {
        method: "POST",
        body: formData,
        // Не устанавливаем Content-Type вручную, браузер сам поставит multipart/form-data boundary
        credentials: "include", 
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Ошибка загрузки файла");
      }

      onSuccess();
      onClose();
      alert("Прайс успешно обновлен!");
    } catch (e: any) {
      setError(e.message || "Произошла ошибка при импорте");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Импорт прайс-листа</h3>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>
          {/* Шаг 1 */}
          <div>
            <div className={styles.stepTitle}>1. Скачайте текущий список товаров</div>
            <button className={styles.templateBtn} onClick={downloadTemplate}>
              📄 Скачать шаблон (CSV)
            </button>
            <div className={styles.hint}>
              Откройте файл в Excel, заполните столбец <b>«Новая цена»</b> и сохраните.
              Не меняйте ID товаров!
            </div>
          </div>

          <hr style={{width: '100%', border: 0, borderTop: '1px solid #eee'}} />

          {/* Шаг 2 */}
          <div>
            <div className={styles.stepTitle}>2. Загрузите заполненный файл</div>
            {!file ? (
              <label className={styles.dropZone}>
                <input 
                  type="file" 
                  accept=".csv,.xlsx,.xls" 
                  onChange={handleFileChange} 
                  style={{display: 'none'}} 
                />
                <div style={{fontSize: 24}}>📤</div>
                <div className={styles.dropText}>Нажмите, чтобы выбрать файл</div>
              </label>
            ) : (
              <div className={styles.fileInfo}>
                📄 {file.name} 
                <button 
                  style={{marginLeft: 'auto', background: 'none', border: 'none', color: 'red', cursor: 'pointer'}}
                  onClick={() => setFile(null)}
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {error && <div className={styles.err}>{error}</div>}

          <div style={{display: 'flex', gap: 10, marginTop: 10}}>
            <button className={styles.btnGhost} onClick={onClose} style={{flex: 1}}>Отмена</button>
            <button 
              className={styles.btnPrimary} 
              onClick={handleUpload} 
              disabled={!file || uploading}
              style={{flex: 1}}
            >
              {uploading ? "Загрузка..." : "Обновить цены"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
