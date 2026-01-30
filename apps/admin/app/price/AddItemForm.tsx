import React from "react";
import styles from "./AddItemForm.module.css";
import baseStyles from "./price.module.css";

type IdLike = string | number;

type Service = {
  id: IdLike;
  name: string;
};

type Product = {
  id: IdLike;
  name: string;
};

type ProductCategoryOption = {
  value: string;
  label: string;
};

type PickedPhoto = {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
};

type SpecRow = { name: string; value: string };

type Props = {
  kind: "service" | "product";
  setKind: (value: "service" | "product") => void;
  serviceCategories: string[];
  serviceCategory: string;
  setServiceCategory: (value: string) => void;
  serviceId: string;
  setServiceId: (value: string) => void;
  filteredServicesForAdd: Service[];
  productCategoryOptions: ProductCategoryOption[];
  productCategoryId: string;
  setProductCategoryId: (value: string) => void;
  createNewProduct: boolean;
  setCreateNewProduct: (value: boolean) => void;
  productId: string;
  setProductId: (value: string) => void;
  filteredProductsForAdd: Product[];
  duplicateProduct: Product | null;
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
  onClose: () => void;
  onCancel: () => void;
  onAdd: () => void;
};

export default function AddItemForm({
  kind,
  setKind,
  serviceCategories,
  serviceCategory,
  setServiceCategory,
  serviceId,
  setServiceId,
  filteredServicesForAdd,
  productCategoryOptions,
  productCategoryId,
  setProductCategoryId,
  createNewProduct,
  setCreateNewProduct,
  productId,
  setProductId,
  filteredProductsForAdd,
  duplicateProduct,
  newProductName,
  setNewProductName,
  newProductDescription,
  setNewProductDescription,
  newProductCover,
  setNewProductCover,
  onPickProductCover,
  newProductSpecs,
  updateSpecRow,
  removeSpecRow,
  addSpecRow,
  priceMin,
  setPriceMin,
  onClose,
  onCancel,
  onAdd,
}: Props) {
  return (
    <div className={styles.drawerOverlay} role="dialog" aria-modal="true">
      <div className={styles.drawer}>
        <div className={styles.drawerHead}>
          <div>
            <div className={styles.drawerTitle}>Добавить позицию</div>
            <div className={styles.drawerSub}>Добавь услугу или товар с ценой. Для товара можно создать карточку с нуля.</div>
          </div>
          <button className={baseStyles.btnGhost} onClick={onClose}>Закрыть</button>
        </div>
        <div className={baseStyles.formGrid}>
          <div className={baseStyles.field}>
            <div className={baseStyles.label}>Тип</div>
            <select className={baseStyles.input} value={kind} onChange={(e) => setKind(e.target.value as "service" | "product")}>
              <option value="service">Услуга</option>
              <option value="product">Товар</option>
            </select>
          </div>
          {kind === "service" && (
            <>
              <div className={baseStyles.field}>
                <div className={baseStyles.label}>Категория</div>
                <select className={baseStyles.input} value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value)}>
                  {serviceCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className={`${baseStyles.field} ${baseStyles.fieldWide}`}>
                <div className={baseStyles.label}>Услуга</div>
                <select className={baseStyles.input} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                  {filteredServicesForAdd.map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>{s.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          {kind === "product" && (
            <>
              <div className={baseStyles.field}>
                <div className={baseStyles.label}>Категория товара</div>
                <select className={baseStyles.input} value={productCategoryId} onChange={(e) => setProductCategoryId(e.target.value)}>
                  <option value="">— выбери категорию —</option>
                  {productCategoryOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className={`${baseStyles.field} ${baseStyles.fieldWide}`}>
                <div className={baseStyles.label}>Создать новый товар</div>
                <label className={baseStyles.toggleRow}>
                  <input type="checkbox" checked={createNewProduct} onChange={(e) => setCreateNewProduct(e.target.checked)} />
                  <span>Создать товар с нуля</span>
                </label>
              </div>
              {!createNewProduct && (
                <div className={`${baseStyles.field} ${baseStyles.fieldWide}`}>
                  <div className={baseStyles.label}>Товар</div>
                  <select className={baseStyles.input} value={productId} onChange={(e) => setProductId(e.target.value)}>
                    <option value="">— выбери товар —</option>
                    {filteredProductsForAdd.map((p) => (
                      <option key={String(p.id)} value={String(p.id)}>{p.name}</option>
                    ))}
                  </select>
                  {productCategoryId && filteredProductsForAdd.length === 0 && (
                    <div className={baseStyles.hint}>В этой категории пока нет товаров. Проверь category_id у товара в БД/API.</div>
                  )}
                </div>
              )}
              {createNewProduct && (
                <>
                  <div className={`${baseStyles.field} ${baseStyles.fieldWide}`}>
                    <div className={baseStyles.label}>Название товара</div>
                    <input
                      className={`${baseStyles.input} ${duplicateProduct ? baseStyles.inputError : ""}`}
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      placeholder="Напр. Пластиковые окна"
                    />
                    <div className={baseStyles.hint}>С таким названием товар будет отображаться в каталоге.</div>
                    {duplicateProduct && (
                      <div className={baseStyles.fieldError}>Товар с таким названием уже существует. Выбери его из списка.</div>
                    )}
                  </div>
                  <div className={`${baseStyles.field} ${baseStyles.fieldWide}`}>
                    <div className={baseStyles.label}>Описание товара (каноничное)</div>
                    <textarea
                      className={`${baseStyles.input} ${baseStyles.textarea}`}
                      value={newProductDescription}
                      onChange={(e) => setNewProductDescription(e.target.value)}
                      placeholder="Каноничное описание товара"
                    />
                    <div className={baseStyles.hint}>Опиши преимущества и характеристики. Это важно для SEO.</div>
                  </div>
                  <div className={`${baseStyles.field} ${baseStyles.fieldWide}`}>
                    <div className={baseStyles.label}>Cover-картинка товара</div>
                    <div className={baseStyles.coverRow}>
                      <input className={baseStyles.input} type="file" accept="image/*" onChange={(e) => onPickProductCover(e.target.files?.[0] || null)} />
                      {newProductCover && (
                        <div className={baseStyles.coverPreview}>
                          <img src={newProductCover.dataUrl} alt="cover-preview" />
                          <button type="button" className={baseStyles.photoDel} onClick={() => setNewProductCover(null)} title="Убрать">×</button>
                        </div>
                      )}
                    </div>
                    <div className={baseStyles.hint}>Первое фото, которое увидит клиент.</div>
                  </div>
                  <div className={`${baseStyles.field} ${baseStyles.fieldWide}`}>
                    <div className={baseStyles.label}>Характеристики (до 10)</div>
                    <div className={baseStyles.specsList}>
                      {newProductSpecs.map((row, idx) => (
                        <div key={`spec-${idx}`} className={baseStyles.specRow}>
                          <input className={baseStyles.input} value={row.name} onChange={(e) => updateSpecRow(idx, "name", e.target.value)} placeholder="Название" />
                          <input className={baseStyles.input} value={row.value} onChange={(e) => updateSpecRow(idx, "value", e.target.value)} placeholder="Значение" />
                          <button type="button" className={baseStyles.specRemove} onClick={() => removeSpecRow(idx)}>×</button>
                        </div>
                      ))}
                    </div>
                    <button type="button" className={baseStyles.btnGhost} onClick={addSpecRow} disabled={newProductSpecs.length >= 10}>Добавить характеристику</button>
                    <div className={baseStyles.hint}>Например: Объем - 5 л, Вес - 10 кг.</div>
                  </div>
                </>
              )}
            </>
          )}
          <div className={baseStyles.field}>
            <div className={baseStyles.label}>Цена от, ₽</div>
            <input className={baseStyles.input} value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="Напр. 1500" inputMode="decimal" />
          </div>
        </div>
      </div>
      <div className={styles.drawerFooter}>
        <button className={baseStyles.btnGhost} onClick={onCancel}>Отмена</button>
        <button className={baseStyles.btnPrimary} onClick={onAdd}>Добавить</button>
      </div>
    </div>
  );
}
