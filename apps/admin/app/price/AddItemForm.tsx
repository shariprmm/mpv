// apps/admin/app/price/AddItemForm.tsx
import React from "react";
import styles from "./AddItemForm.module.css";

// Типы дублируем или импортируем из page.tsx, если они экспортируются
// Для автономности компонента лучше, если типы пропсов определены здесь.
// (Предполагаем, что типы сущностей PickedPhoto и SpecRow уже определены или импортированы)

type PickedPhoto = {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
};

type SpecRow = { name: string; value: string };

type Service = { id: string | number; name: string };
type Product = { id: string | number; name: string };
type CategoryOption = { value: string; label: string }; // Для унификации

type Props = {
  kind: "service" | "product";
  setKind: (value: "service" | "product") => void;
  serviceCategories: string[];
  serviceCategory: string;
  setServiceCategory: (value: string) => void;
  serviceId: string;
  setServiceId: (value: string) => void;
  filteredServicesForAdd: Service[];
  
  productCategoryOptions: { value: string; label: string }[];
  productCategoryId: string;
  setProductCategoryId: (value: string) => void;
  createNewProduct: boolean;
  setCreateNewProduct: (value: boolean) => void;
  productId: string;
  setProductId: (value: string) => void;
  filteredProductsForAdd: Product[];
  duplicateProduct: boolean;
  
  newProductName: string;
  setNewProductName: (value: string) => void;
  newProductDescription: string;
  setNewProductDescription: (value: string) => void;
  newProductCover: PickedPhoto | null;
  setNewProductCover: (value: PickedPhoto | null) => void;
  onPickProductCover: (file: File | null) => void;
  
  newProductSpecs: SpecRow[];
  updateSpecRow: (index: number, field: "name" | "value", value: string) => void;
  removeSpecRow: (index: number) => void;
  addSpecRow: () => void;
  
  priceMin: string;
  setPriceMin: (value: string) => void;
  addItemError: string | null;
  onClose: () => void;
  onCancel: () => void;
  onAdd: () => void;
};

export default function AddItemForm(props: Props) {
  const {
    kind, setKind,
    serviceCategories, serviceCategory, setServiceCategory,
    serviceId, setServiceId, filteredServicesForAdd,
    productCategoryOptions, productCategoryId, setProductCategoryId,
    createNewProduct, setCreateNewProduct,
    productId, setProductId, filteredProductsForAdd,
    duplicateProduct,
    newProductName, setNewProductName,
    newProductDescription, setNewProductDescription,
    newProductCover, setNewProductCover, onPickProductCover,
    newProductSpecs, updateSpecRow, removeSpecRow, addSpecRow,
    priceMin, setPriceMin,
    addItemError,
    onClose, onCancel, onAdd
  } = props;

  return (
    <div className={styles.drawerOverlay} role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.drawer}>
        
        {/* HEADER */}
        <div className={styles.drawerHead}>
          <div>
            <div className={styles.drawerTitle}>Добавить позицию</div>
            <div className={styles.drawerSub}>
              {kind === "service" ? "Добавление услуги в прайс-лист." : "Добавление товара в каталог."}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* BODY */}
        <div className={styles.drawerBody}>
          {addItemError && (
            <div className={styles.errorText} role="alert" style={{ marginBottom: 12 }}>
              {addItemError}
            </div>
          )}
          <div className={styles.grid}>
            
            {/* Тип позиции */}
            <div className={styles.field}>
              <label className={styles.label}>Тип</label>
              <select className={styles.select} value={kind} onChange={(e) => setKind(e.target.value as "service" | "product")}>
                <option value="service">Услуга</option>
                <option value="product">Товар</option>
              </select>
            </div>

            {/* --- УСЛУГА --- */}
            {kind === "service" && (
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label}>Категория</label>
                  <select className={styles.select} value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value)}>
                    {serviceCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Услуга</label>
                  <select className={styles.select} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                    {filteredServicesForAdd.map((s) => (
                      <option key={String(s.id)} value={String(s.id)}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* --- ТОВАР --- */}
            {kind === "product" && (
              <>
                <div className={styles.field}>
                  <label className={styles.label}>Категория товара</label>
                  <select className={styles.select} value={productCategoryId} onChange={(e) => setProductCategoryId(e.target.value)}>
                    <option value="">— Выберите категорию —</option>
                    {productCategoryOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.toggleLabel}>
                    <input type="checkbox" checked={createNewProduct} onChange={(e) => setCreateNewProduct(e.target.checked)} />
                    <span className={styles.toggleText}>Создать новый товар с нуля</span>
                  </label>
                </div>

                {!createNewProduct ? (
                  /* Выбор существующего */
                  <div className={styles.field}>
                    <label className={styles.label}>Товар</label>
                    <select className={styles.select} value={productId} onChange={(e) => setProductId(e.target.value)}>
                      <option value="">— Выберите товар —</option>
                      {filteredProductsForAdd.map((p) => (
                        <option key={String(p.id)} value={String(p.id)}>{p.name}</option>
                      ))}
                    </select>
                    {productCategoryId && filteredProductsForAdd.length === 0 && (
                      <div className={styles.hint}>В этой категории нет товаров. Создайте новый.</div>
                    )}
                  </div>
                ) : (
                  /* Создание нового */
                  <>
                    <div className={styles.field}>
                      <label className={styles.label}>Название товара</label>
                      <input
                        className={`${styles.input} ${duplicateProduct ? styles.inputError : ""}`}
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        placeholder="Например: Септик Топас 5"
                      />
                      {duplicateProduct && <div className={styles.errorText}>Такой товар уже существует.</div>}
                      <div className={styles.hint}>Название должно быть уникальным в категории.</div>
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Описание</label>
                      <textarea
                        className={styles.textarea}
                        value={newProductDescription}
                        onChange={(e) => setNewProductDescription(e.target.value)}
                        placeholder="Краткое описание характеристик и преимуществ..."
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Фотография (Cover)</label>
                      {!newProductCover ? (
                        <div className={styles.uploadBox}>
                          <label className={styles.uploadBtn}>
                            <input type="file" className={styles.fileInput} accept="image/*" onChange={(e) => onPickProductCover(e.target.files?.[0] || null)} />
                            📁 Выбрать файл
                          </label>
                          <span className={styles.hint}>PNG, JPG, WEBP до 5Мб</span>
                        </div>
                      ) : (
                        <div className={styles.preview}>
                          <img src={newProductCover.dataUrl} alt="preview" className={styles.previewImg} />
                          <span style={{ fontSize: 13, flexGrow: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{newProductCover.name}</span>
                          <button onClick={() => setNewProductCover(null)} className={styles.removeBtn}>×</button>
                        </div>
                      )}
                    </div>

                    <div className={styles.field}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <label className={styles.label}>Характеристики</label>
                        <button className={styles.specBtn} onClick={addSpecRow} disabled={newProductSpecs.length >= 10}>
                          + Добавить строку
                        </button>
                      </div>
                      
                      <div className={styles.specsList}>
                        {newProductSpecs.map((row, idx) => (
                          <div key={idx} className={styles.specRow}>
                            <input className={styles.input} value={row.name} onChange={(e) => updateSpecRow(idx, "name", e.target.value)} placeholder="Название (Объем)" />
                            <input className={styles.input} value={row.value} onChange={(e) => updateSpecRow(idx, "value", e.target.value)} placeholder="Значение (5 л)" />
                            <button className={styles.removeBtn} onClick={() => removeSpecRow(idx)}>×</button>
                          </div>
                        ))}
                        {newProductSpecs.length === 0 && (
                          <div className={styles.hint} style={{textAlign: 'center', padding: 10, background: '#f9f9f9', borderRadius: 8}}>
                            Нет характеристик. Нажмите «Добавить строку».
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Цена */}
            <div className={styles.field}>
              <label className={styles.label}>Цена от (₽)</label>
              <input
                className={styles.input}
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                placeholder="0"
                inputMode="decimal"
              />
              <div className={styles.hint}>Укажите минимальную цену. В каталоге будет отображаться "от ... ₽"</div>
            </div>

          </div>
        </div>

        {/* FOOTER */}
        <div className={styles.drawerFooter}>
          <button className={styles.btnGhost} onClick={onCancel}>Отмена</button>
          <button className={styles.btnPrimary} onClick={onAdd}>Добавить</button>
        </div>

      </div>
    </div>
  );
}
