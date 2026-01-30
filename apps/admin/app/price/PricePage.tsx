// apps/admin/app/price/page.tsx
"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import React, { useEffect, useMemo, useState } from "react";
import "react-quill/dist/quill.snow.css";
import styles from "./price.module.css";
import AddItemForm from "./AddItemForm";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

const SITE =
  process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/+$/, "") ||
  "https://moydompro.ru";

type IdLike = string | number;

export type Service = {
  id: IdLike;
  name: string;
  slug: string;
  category?: string | null;
  image_url?: string | null;
};

export type Product = {
  id: IdLike;
  name: string;
  slug: string;
  category_id?: number | null;
  category?: string | null;
  image_url?: string | null;
};

export type CategoryFlat = {
  id: number;
  slug: string;
  name: string;
  parent_id: number | null;
  depth: number;
  path_name: string;
  sort_order?: number;
};

type CompanyItem = {
  id: number;
  kind: "service" | "product" | "custom";
  price_min: number | null;
  price_max: number | null;
  currency?: string;
  service_id?: IdLike | null;
  product_id?: IdLike | null;
  custom_title?: string | null;
  service_name?: string | null;
  product_name?: string | null;
  description?: string | null;
  photos?: string[] | null;
};

type MeResp = {
  ok: boolean;
  user: { id: number; email: string; role: string; company_id: number };
  company: {
    id: number;
    name: string;
    region_slug: string;
    region_name: string;
    is_verified: boolean;
  };
};

type CompanyProfile = {
  id: number;
  name: string;
  is_verified: boolean;
  phone: string | null;
  address: string | null;
  work_hours: string | null;
  description?: string | null;
  photos?: string[] | null;
  vk_url: string | null;
  tg_url: string | null;
  youtube_url: string | null;
  website_url?: string | null;
  logo_url: string | null;
};

type LeadItem = {
  id: number;
  company_id: number;
  kind: "service" | "product" | "custom";
  service_id: number | null;
  product_id: number | null;
  custom_title: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  status: "new" | "in_work" | "done" | "spam";
  source: string;
  created_at: string;
};

export type PickedPhoto = {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
};

export type SpecRow = { name: string; value: string };

async function jget(url: string) {
  const r = await fetch(url, { credentials: "include", cache: "no-store" });
  const txt = await r.text();
  let data: any = null;
  try {
    data = JSON.parse(txt);
  } catch {
    data = { raw: txt };
  }
  if (!r.ok) throw new Error(data?.error || data?.message || `HTTP ${r.status}`);
  return data;
}

async function jreq(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: any
) {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  let data: any = null;
  try {
    data = JSON.parse(txt);
  } catch {
    data = { raw: txt };
  }
  if (!r.ok) throw new Error(data?.error || data?.message || `HTTP ${r.status}`);
  return data;
}

// Ensure ReactQuill is loaded only on client
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

function toNumOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  if (!t) return null;
  const n = Number(t.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function fmtRub(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return String(n);
}

function slugifyRu(input: string) {
  const s = String(input || "").trim().toLowerCase();
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  return s
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatPriceForSeo(price: number | null) {
  if (price == null) return "";
  return new Intl.NumberFormat("ru-RU").format(price);
}

function absPublicUrl(p: string | null | undefined) {
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;

  const path = p.startsWith("/") ? p : `/${p}`;
  if (path.startsWith("/uploads/")) return `${SITE}${path}`;
  return `${API}${path}`;
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = () => reject(new Error("Не удалось прочитать файл"));
    fr.readAsDataURL(file);
  });
}

function normCat(v: any): string {
  const s = String(v ?? "").trim();
  return s ? s : "—";
}

function kindLabel(k: CompanyItem["kind"]) {
  if (k === "service") return "Услуга";
  if (k === "product") return "Товар";
  return "Своя";
}

/* =========================
   Work hours helpers
========================= */
function normDashesSpaces(s: string) {
  return String(s || "")
    .replace(/[—−]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureSep(prev: string) {
  const s = prev.trim();
  if (!s) return "";
  if (/[;,]\s*$/.test(s)) return s + " ";
  return s + "; ";
}

function upsertBlock(prevRaw: string, key: string, value: string) {
  const normalized = normDashesSpaces(prevRaw || "");

  if (key === "круглосуточно") return "круглосуточно";

  if (key === "ежедневно") {
    const cleaned = normalized
      .replace(/(^|[;,\s])будни\s+[^;,\n]+/gi, " ")
      .replace(/(^|[;,\s])выходные\s+[^;,\n]+/gi, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/\s*;\s*;\s*/g, "; ")
      .trim()
      .replace(/^[;,\s]+|[;,\s]+$/g, "");

    const re = new RegExp(`(^|[;,\\s])${key}\\s+[^;,\\n]+`, "i");
    if (re.test(cleaned)) return cleaned.replace(re, `$1${value}`).trim();
    return (cleaned ? ensureSep(cleaned) : "") + value;
  }

  const re = new RegExp(`(^|[;,\\s])${key}\\s+[^;,\\n]+`, "i");
  if (re.test(normalized)) return normalized.replace(re, `$1${value}`).trim();
  return ensureSep(normalized) + value;
}

function applyWorkHoursPreset(
  prev: string,
  preset: "weekdays" | "daily" | "24" | "weekend" | "break"
) {
  const base = prev || "";
  if (preset === "weekdays")
    return upsertBlock(base, "будни", "будни 10:00-19:00");
  if (preset === "weekend")
    return upsertBlock(base, "выходные", "выходные 10:00-18:00");
  if (preset === "break")
    return upsertBlock(base, "перерыв", "перерыв 12:00-13:00");
  if (preset === "daily")
    return upsertBlock(base, "ежедневно", "ежедневно 10:00-19:00");
  return upsertBlock(base, "круглосуточно", "круглосуточно");
}

/* =========================
   Phone mask + Helpers
========================= */
function digitsOnly(s: string) {
  return String(s || "").replace(/\D+/g, "");
}

function formatRuPhoneMasked(input: string) {
  let d = digitsOnly(input);
  if (!d) return "";

  if (d[0] === "8") d = "7" + d.slice(1);
  if (d.length === 10) d = "7" + d;
  d = d.slice(0, 11);

  if (d[0] !== "7") return "+" + d;

  const a = d.slice(1);
  const p1 = a.slice(0, 3);
  const p2 = a.slice(3, 6);
  const p3 = a.slice(6, 8);
  const p4 = a.slice(8, 10);

  let out = "+7";
  if (p1) out += ` (${p1}`;
  if (p1.length === 3) out += ")";
  if (p2) out += ` ${p2}`;
  if (p3) out += `-${p3}`;
  if (p4) out += `-${p4}`;
  return out;
}

function normalizeUrl(v: string) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/+/, "")}`;
}

type MainTab = "catalog" | "company" | "leads";

type PricePageProps = {
  activeMainTab: MainTab;
};

export default function PricePage({ activeMainTab }: PricePageProps) {
  const [me, setMe] = useState<MeResp | null>(null);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);

  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<CompanyItem[]>([]);

  const [productCategories, setProductCategories] = useState<CategoryFlat[]>([]);
  const [productCategoryId, setProductCategoryId] = useState<string>("");

  const [err, setErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savingProfile, setSavingProfile] = useState<boolean>(false);

  const [activeCatalogTab, setActiveCatalogTab] = useState<"products" | "services">("products");

  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [leadsStatus, setLeadsStatus] = useState<string>("");
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState<string>("");

  const [pName, setPName] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pAddress, setPAddress] = useState("");
  const [pHours, setPHours] = useState("");
  const [pSite, setPSite] = useState("");
  const [pVk, setPVk] = useState("");
  const [pTg, setPTg] = useState("");
  const [pYt, setPYt] = useState("");
  const [about, setAbout] = useState("");
  const [companyPhotos, setCompanyPhotos] = useState<string[]>([]);
  const [pickedCompanyPhotos, setPickedCompanyPhotos] = useState<PickedPhoto[]>([]);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string>("");

  // Add Item Form State
  const [kind, setKind] = useState<"service" | "product">("service");
  const [serviceCategory, setServiceCategory] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [priceMin, setPriceMin] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [createNewProduct, setCreateNewProduct] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductSlug, setNewProductSlug] = useState("");
  const [newProductDescription, setNewProductDescription] = useState("");
  const [newProductSpecs, setNewProductSpecs] = useState<SpecRow[]>([]);
  const [newProductCover, setNewProductCover] = useState<PickedPhoto | null>(null);

  // Price Management in Catalog
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({}); 

  const [catalogQuery, setCatalogQuery] = useState("");
  
  // Фильтры
  const [catalogCatId, setCatalogCatId] = useState<string>(""); // Фильтр для Товаров
  const [catalogSvcCat, setCatalogSvcCat] = useState<string>(""); // Фильтр для Услуг

  // 1. Формируем список категорий ДЛЯ ФИЛЬТРА УСЛУГ (из всех услуг)
  const serviceCategories = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) set.add(normCat(s.category));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [services]);

  // 2. Формируем список категорий ДЛЯ ФИЛЬТРА ТОВАРОВ (из дерева категорий)
  const productCategoryOptions = useMemo(() => {
    const list = (productCategories || []).slice(0);
    list.sort((a, b) => {
      const ao = a.sort_order ?? 100;
      const bo = b.sort_order ?? 100;
      if (ao !== bo) return ao - bo;
      return a.path_name.localeCompare(b.path_name, "ru");
    });
    return list.map((c) => {
      const indent = c.depth ? "— ".repeat(Math.min(6, c.depth)) : "";
      return { value: String(c.id), label: `${indent}${c.path_name}` };
    });
  }, [productCategories]);

  // Для модалки добавления (оставляем старую логику)
  const filteredServicesForAdd = useMemo(() => {
    const cat = serviceCategory ? normCat(serviceCategory) : "";
    if (!cat) return services;
    return services.filter((s) => normCat(s.category) === cat);
  }, [services, serviceCategory]);

  const catChildren = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const c of productCategories) {
      if (c.parent_id == null) continue;
      const arr = map.get(c.parent_id) || [];
      arr.push(c.id);
      map.set(c.parent_id, arr);
    }
    return map;
  }, [productCategories]);

  const getCatIdsRecursive = (rootId: number) => {
      const out = new Set<number>();
      const stack = [rootId];
      while (stack.length) {
          const cur = stack.pop()!;
          if (out.has(cur)) continue;
          out.add(cur);
          const kids = catChildren.get(cur) || [];
          for (const k of kids) stack.push(k);
      }
      return out;
  }

  const selectedCatIds = useMemo(() => {
    const root = productCategoryId ? Number(productCategoryId) : 0;
    if (!root) return new Set<number>();
    return getCatIdsRecursive(root);
  }, [productCategoryId, catChildren]);

  const filteredProductsForAdd = useMemo(() => {
    if (!productCategoryId) return products;
    const hasCategoryId = products.some((p) => p.category_id != null);
    if (!hasCategoryId) return products;
    return products.filter((p) => {
      const cid = Number(p.category_id || 0);
      return cid && selectedCatIds.has(cid);
    });
  }, [products, productCategoryId, selectedCatIds]);

  const catNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of productCategories) map.set(c.id, c.path_name || c.name);
    return (id: number | null | undefined) => (id ? map.get(id) || "—" : "—");
  }, [productCategories]);

  function resetNewItemForm() {
    setPriceMin("");
    setServiceId("");
    setProductId("");
    setCreateNewProduct(false);
    setNewProductName("");
    setNewProductSlug("");
    setNewProductDescription("");
    setNewProductSpecs([]);
    setNewProductCover(null);
  }

  async function onPickCompanyPhotos(files: FileList | null) {
    if (!files || !files.length) return;
    setErr(null);
    const existing = pickedCompanyPhotos.slice(0);
    const remaining = Math.max(0, 40 - companyPhotos.length - existing.length);
    const list = Array.from(files).slice(0, remaining);
    if (!list.length) { setErr("Можно прикрепить максимум 40 фото."); return; }
    const added: PickedPhoto[] = [];
    for (const f of list) {
      const fileType = String(f.type || "").toLowerCase();
      if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(fileType)) continue;
      if (f.size > 3 * 1024 * 1024) continue;
      const dataUrl = await fileToDataUrl(f);
      added.push({ name: f.name, size: f.size, type: f.type, dataUrl });
    }
    setPickedCompanyPhotos([...existing, ...added].slice(0, 40 - companyPhotos.length));
  }

  function removeCompanyPhoto(idx: number) {
    setCompanyPhotos((prev) => prev.filter((_, i) => i !== idx));
  }
  function removePickedCompanyPhoto(idx: number) {
    setPickedCompanyPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onPickProductCover(file: File | null) {
    if (!file) return;
    setErr(null);
    const fileType = String(file.type || "").toLowerCase();
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"].includes(fileType)) {
      setErr("Поддерживаются только изображения PNG/JPG/WEBP/SVG.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Размер файла не должен превышать 5 МБ.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setNewProductCover({ name: file.name, size: file.size, type: file.type, dataUrl });
  }

  function updateSpecRow(idx: number, field: "name" | "value", value: string) {
    setNewProductSpecs((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  }

  function addSpecRow() {
    setNewProductSpecs((prev) => (prev.length >= 10 ? prev : [...prev, { name: "", value: "" }]));
  }

  function removeSpecRow(idx: number) {
    setNewProductSpecs((prev) => prev.filter((_, i) => i !== idx));
  }

  async function loadAll() {
    setErr(null);
    const meData = (await jget(`${API}/auth/me`)) as MeResp;
    setMe(meData);
    const [svc, prd, comp, prof, cats] = await Promise.all([
      jget(`${API}/services`),
      jget(`${API}/products`),
      jget(`${API}/companies/${meData.company.id}`),
      jget(`${API}/company/profile`),
      jget(`${API}/product-categories?flat=1`),
    ]);
    const svcItems: Service[] = svc.items || [];
    const prdItems: Product[] = (prd.items || prd.result || []) as Product[];
    const catItems: CategoryFlat[] = (cats.result || cats.items || []) as CategoryFlat[];
    const serverItems: CompanyItem[] = comp.items || [];

    setServices(svcItems);
    setProducts(prdItems);
    setProductCategories(catItems);
    setItems(serverItems);

    // Initial draft for inputs
    const draft: Record<string, string> = {};
    
    // Fill draft from existing company items using string IDs to be safe
    for (const it of serverItems) {
      if (it.kind === 'product' && it.product_id) {
        draft[`product_${it.product_id}`] = it.price_min != null ? String(it.price_min) : "";
      } else if (it.kind === 'service' && it.service_id) {
        draft[`service_${it.service_id}`] = it.price_min != null ? String(it.price_min) : "";
      }
    }
    setPriceDraft(draft);

    const cp = prof.company as CompanyProfile;
    setProfile(cp);
    setPName(cp.name || meData.company.name || "");
    setPPhone(cp.phone ? formatRuPhoneMasked(cp.phone) : "");
    setPAddress(cp.address || "");
    setPHours(cp.work_hours || "");
    setPVk(cp.vk_url || "");
    setPTg(cp.tg_url || "");
    setPYt(cp.youtube_url || "");
    setPSite((cp.website_url as any) || "");
    setAbout(cp.description || "");
    setCompanyPhotos(Array.isArray(cp.photos) ? cp.photos.filter(Boolean) : []);
    setPickedCompanyPhotos([]);
    setLogoPreview(absPublicUrl(cp.logo_url));

    const firstSvcCat = svcItems.length ? normCat(svcItems[0].category) : "";
    setServiceCategory((prev) => prev || firstSvcCat);
    
    const firstProductCategoryId = catItems.length ? String(catItems[0].id) : "";
    setProductCategoryId((prev) => prev || firstProductCategoryId);
  }

  async function loadLeads() {
    setLeadsError("");
    setLeadsLoading(true);
    try {
      const q = leadsStatus ? `?status=${encodeURIComponent(leadsStatus)}` : "";
      const data = await jget(`${API}/company-leads${q}`);
      setLeads(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setLeadsError(e?.message || String(e));
    } finally {
      setLeadsLoading(false);
    }
  }

  async function setLeadStatus(id: number, status: LeadItem["status"]) {
    setLeadsError("");
    try {
      await jreq(`${API}/company-leads/${id}`, "PATCH", { status });
      await loadLeads();
    } catch (e: any) {
      setLeadsError(e?.message || String(e));
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await loadAll();
      } catch (e: any) {
        const m = String(e?.message || "");
        if (m.includes("401") || m.toLowerCase().includes("unauthorized")) { location.href = "/login"; return; }
        setErr(e?.message || String(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (kind !== "service") return;
    if (!services.length) return;
    const list = serviceCategory ? services.filter((s) => normCat(s.category) === normCat(serviceCategory)) : services;
    const allowed = new Set(list.map((s) => String(s.id)));
    if (!allowed.has(String(serviceId))) setServiceId(list[0] ? String(list[0].id) : "");
  }, [serviceCategory, services, kind]);

  useEffect(() => {
    if (kind !== "product") return;
    setProductId("");
  }, [productCategoryId, kind]);

  useEffect(() => {
    if (kind === "product") return;
    setCreateNewProduct(false);
  }, [kind]);

  useEffect(() => {
    if (!createNewProduct) return;
    setNewProductSlug(slugifyRu(newProductName));
  }, [newProductName, createNewProduct]);

  useEffect(() => {
    if (activeMainTab !== "leads") return;
    loadLeads();
  }, [activeMainTab, leadsStatus]);

  async function addItem() {
    // Legacy add function from modal, still useful for creating NEW products
    setErr(null);
    try {
      const priceValue = toNumOrNull(priceMin);
      let productIdToUse = productId;

      if (kind === "product" && createNewProduct) {
        // ... (creation logic same as before)
        const trimmedName = newProductName.trim();
        const trimmedDesc = newProductDescription.trim();
        if (!productCategoryId) { setErr("Выбери категорию товара."); return; }
        if (!trimmedName) { setErr("Укажи название товара."); return; }
        if (!trimmedDesc) { setErr("Добавь описание товара."); return; }
        if (!newProductCover) { setErr("Загрузи cover-картинку товара."); return; }
        if (priceValue == null) { setErr("Укажи цену товара."); return; }

        const duplicate = products.find(
          (p) => String(p.name || "").trim().toLowerCase() === trimmedName.toLowerCase()
        );
        if (duplicate) {
          setErr("Товар с таким названием уже существует. Выбери его из списка.");
          return;
        }

        const coverUpload = await jreq(`${API}/company/upload-image`, "POST", {
          dataUrl: newProductCover.dataUrl,
          filename: newProductCover.name,
          prefix: `product-cover-${me?.company?.id || "company"}`,
        });

        const priceLabel = formatPriceForSeo(priceValue);
        const seoTitle = `${trimmedName} — ${companyTitle} ${regionName}. Цена от ${priceLabel} ₽`;
        const seoH1 = `${trimmedName} от ${companyTitle} в ${regionName}`;
        const seoDescription =
          `Купить ${trimmedName} от компании ${companyTitle} в регионе ${regionName}. ` +
          `Цена от ${priceLabel} ₽.`;

        const specs = newProductSpecs
          .map((row) => ({ name: row.name.trim(), value: row.value.trim() }))
          .filter((row) => row.name && row.value)
          .slice(0, 10);

        const created = await jreq(`${API}/products`, "POST", {
          name: trimmedName,
          slug: newProductSlug || slugifyRu(trimmedName),
          category_id: Number(productCategoryId),
          description: trimmedDesc,
          cover_image: coverUpload?.url,
          specs,
          seo_h1: seoH1,
          seo_title: seoTitle,
          seo_description: seoDescription,
        });

        productIdToUse = created?.item?.id ? String(created.item.id) : "";
        if (!productIdToUse) {
          setErr("Не удалось создать товар. Попробуй ещё раз.");
          return;
        }
      }

      // После создания товара, привязываем его к компании
      if (kind === "product" && !productIdToUse) { setErr("Выбери товар."); return; }
      if (kind === "service" && !serviceId) { setErr("Выбери услугу."); return; }
      const body: any = { kind, price_min: priceValue, price_max: null };
      if (kind === "service") body.service_id = serviceId ? Number(serviceId) : null;
      if (kind === "product") body.product_id = productIdToUse ? Number(productIdToUse) : null;
      
      const createdItem = await jreq(`${API}/company-items`, "POST", body);
      
      // Обновляем локально, чтобы не перезагружать всю страницу
      if (createdItem && createdItem.item) {
        setItems(prev => [...prev, createdItem.item]);
        const key = kind === 'product' ? `product_${productIdToUse}` : `service_${serviceId}`;
        setPriceDraft(prev => ({ ...prev, [key]: String(priceValue) }));
      } else {
        await loadAll();
      }

      resetNewItemForm();
      setShowAdd(false);
    } catch (e: any) { setErr(e?.message || String(e)); }
  }

  // ✅ ИСПРАВЛЕННАЯ ЛОГИКА: Не дублировать, а обновлять
  async function upsertPrice(kind: "product" | "service", id: IdLike, valueStr: string) {
    setErr(null);
    const priceValue = toNumOrNull(valueStr);
    
    // Ищем, есть ли уже этот товар в прайсе компании (приводим ID к строке для надежности)
    const existing = items.find(it => 
      it.kind === kind && 
      (kind === "product" ? String(it.product_id) === String(id) : String(it.service_id) === String(id))
    );

    try {
      if (priceValue === null) {
        // Если цену стерли - удаляем из прайса (если был)
        if (existing) {
          setSavingId(existing.id);
          await jreq(`${API}/company-items/${existing.id}`, "DELETE");
          // Удаляем локально из items
          setItems(prev => prev.filter(it => it.id !== existing.id));
        }
      } else {
        // Если цену ввели
        if (existing) {
          // Если уже есть - обновляем (PATCH)
          setSavingId(existing.id);
          await jreq(`${API}/company-items/${existing.id}`, "PATCH", { price_min: priceValue });
          // Обновляем локально
          setItems(prev => prev.map(it => it.id === existing.id ? { ...it, price_min: priceValue } : it));
        } else {
          // Если нет - создаем (POST)
          const body: any = { kind, price_min: priceValue };
          if (kind === "service") body.service_id = Number(id);
          if (kind === "product") body.product_id = Number(id);
          
          const created = await jreq(`${API}/company-items`, "POST", body);
          
          // ВАЖНО: Добавляем созданный объект (с новым ID) в items
          if (created && created.item) {
             setItems(prev => [...prev, created.item]);
          }
        }
      }
    } catch (e: any) {
      setErr(e?.message || String(e));
      await loadAll(); // fallback
    } finally {
      setSavingId(null);
    }
  }

  // Удаление по кнопке (крестик)
  async function deleteItemManual(kind: "product" | "service", id: IdLike) {
    // Находим item по ID товара/услуги
    const existing = items.find(it => 
      it.kind === kind && 
      (kind === "product" ? String(it.product_id) === String(id) : String(it.service_id) === String(id))
    );

    if (!existing) return;

    if (!confirm("Удалить позицию из вашего прайса?")) return;

    try {
      setSavingId(existing.id);
      await jreq(`${API}/company-items/${existing.id}`, "DELETE");
      
      // Удаляем из стейта items
      setItems(prev => prev.filter(it => it.id !== existing.id));
      
      // Очищаем инпут
      const key = kind === 'product' ? `product_${id}` : `service_${id}`;
      setPriceDraft(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setSavingId(null);
    }
  }

  async function logout() {
    try { await jreq(`${API}/auth/logout`, "POST", {}); } catch {}
    location.href = "/login";
  }

  async function saveProfile(payloadExtra?: any) {
    setErr(null);
    const site = normalizeUrl(pSite);
    const vk = normalizeUrl(pVk);
    const tg = normalizeUrl(pTg);
    const yt = normalizeUrl(pYt);
    setSavingProfile(true);
    try {
      const body: any = {
        name: pName || null, phone: pPhone ? digitsOnly(pPhone) : null, address: pAddress || null,
        work_hours: pHours || null, description: about || null, website_url: site || null,
        vk_url: vk || null, tg_url: tg || null, youtube_url: yt || null, ...(payloadExtra || {}),
      };
      body.photos_keep = companyPhotos;
      if (pickedCompanyPhotos.length) {
        body.photos_base64 = pickedCompanyPhotos.map((p) => p.dataUrl);
        body.photos_filenames = pickedCompanyPhotos.map((p) => p.name);
      }
      const r = await jreq(`${API}/company/profile`, "PATCH", body);
      const cp = r.company as CompanyProfile;
      setProfile(cp); setLogoPreview(absPublicUrl(cp.logo_url)); setAbout(cp.description || "");
      setCompanyPhotos(Array.isArray(cp.photos) ? cp.photos.filter(Boolean) : []); setPickedCompanyPhotos([]);
      setMe((prev) => prev ? { ...prev, company: { ...prev.company, name: cp.name || prev.company.name } } : prev);
    } catch (e: any) { setErr(e?.message || String(e)); } finally { setSavingProfile(false); }
  }

  async function onPickLogo(file: File | null) {
    if (!file) return;
    setErr(null); setLogoFileName(file.name);
    const dataUrl = await fileToDataUrl(file);
    setLogoPreview(dataUrl);
    await saveProfile({ logo_base64: dataUrl, logo_filename: file.name });
  }

  const companyTitle = me?.company?.name || profile?.name || "Компания";
  const verified = me?.company?.is_verified;
  const regionName = me?.company?.region_name || "";
  const addressText = pAddress || profile?.address || "";

  const duplicateProduct = useMemo(() => {
    const target = newProductName.trim().toLowerCase();
    if (!target) return null;
    return products.find((p) => String(p.name || "").trim().toLowerCase() === target) || null;
  }, [newProductName, products]);

  const filteredCatalogProducts = useMemo(() => {
    // 1. Собираем ID товаров, которые уже есть у компании
    const allowedProductIds = new Set(
      items
        .filter((it) => it.kind === "product" && it.product_id != null)
        .map((it) => String(it.product_id))
    );

    const q = catalogQuery.trim().toLowerCase();
    const catId = catalogCatId ? Number(catalogCatId) : 0;
    
    // 2. Фильтруем глобальный список товаров: оставляем только те, что есть у компании
    let list = products.filter((p) => allowedProductIds.has(String(p.id)));

    // 3. Дополнительные фильтры (категория, поиск)
    if (catId && products.some((p) => p.category_id != null)) {
      const out = getCatIdsRecursive(catId); 
      list = list.filter((p) => {
        const cid = Number(p.category_id || 0);
        return cid && out.has(cid);
      });
    }
    
    if (q) {
      list = list.filter((p) => {
        const n = String(p.name || "").toLowerCase();
        const s = String(p.slug || "").toLowerCase();
        return n.includes(q) || s.includes(q);
      });
    }
    
    list.sort((a, b) => String(a.name).localeCompare(String(b.name), "ru"));
    return list;
  }, [products, items, catalogQuery, catalogCatId, catChildren]); 

  const filteredCatalogServices = useMemo(() => {
    // 1. Собираем ID услуг, которые уже есть у компании
    const allowedServiceIds = new Set(
      items
        .filter((it) => it.kind === "service" && it.service_id != null)
        .map((it) => String(it.service_id))
    );

    const q = catalogQuery.trim().toLowerCase();
    const cat = catalogSvcCat ? normCat(catalogSvcCat) : "";
    
    // 2. Фильтруем глобальный список услуг
    let list = services.filter((s) => allowedServiceIds.has(String(s.id)));

    if (cat) list = list.filter((s) => normCat(s.category) === cat);
    if (q) {
      list = list.filter((s) => {
        const n = String(s.name || "").toLowerCase();
        const sl = String(s.slug || "").toLowerCase();
        const c = String(s.category || "").toLowerCase();
        return n.includes(q) || sl.includes(q) || c.includes(q);
      });
    }
    list.sort((a, b) => String(a.name).localeCompare(String(b.name), "ru"));
    return list;
  }, [services, items, catalogQuery, catalogSvcCat]);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarInner}>
          <div className={styles.brand}>
            <div className={styles.brandLogo}>🏡</div>
            <div>
              <div className={styles.brandTitle}>МойДомПро</div>
              <div className={styles.brandSub}>Кабинет компании</div>
            </div>
          </div>
          <div className={styles.companyCard}>
            <div className={styles.companyName}>{companyTitle} {verified ? <span className={styles.verified}>✔</span> : null}</div>
            {regionName ? <div className={styles.companyMeta}>{regionName}</div> : null}
            {addressText ? <div className={styles.companyMeta}>{addressText}</div> : null}
          </div>
          <nav className={styles.nav}>
            <Link href="/price/catalog" className={`${styles.navItem} ${activeMainTab === "catalog" ? styles.navItemActive : ""}`}>
              <span className={styles.navIcon}>🧾</span><span className={styles.navLabel}>Товары и услуги</span>
            </Link>
            <Link href="/price/company" className={`${styles.navItem} ${activeMainTab === "company" ? styles.navItemActive : ""}`}>
              <span className={styles.navIcon}>🏢</span><span className={styles.navLabel}>О компании</span>
            </Link>
            <Link href="/price/leads" className={`${styles.navItem} ${activeMainTab === "leads" ? styles.navItemActive : ""}`}>
              <span className={styles.navIcon}>📨</span><span className={styles.navLabel}>Заявки</span>
            </Link>
          </nav>
          <div className={styles.sidebarBottom}>
            <div className={styles.progressTitle}>Заполненность профиля</div>
            <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: "60%" }} /></div>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.topbar}>
          <div>
            <h1 className={styles.h1}>
              {activeMainTab === "catalog" ? "Товары и услуги" : activeMainTab === "company" ? "О компании" : "Заявки"}
            </h1>
            <div className={styles.sub}>{me ? <><b>{companyTitle}</b> · {me.company.region_name} · {verified ? "✅ проверенная" : "⏳ не проверенная"}</> : "Загрузка…"}</div>
          </div>
          <div className={styles.topbarActions}>
            {activeMainTab === "catalog" ? <button className={styles.btnPrimary} onClick={() => setShowAdd(true)}>+ Добавить позицию</button> : null}
            <button className={styles.btnGhost} onClick={logout}>Выйти</button>
          </div>
        </div>

        <div className={styles.mobileTabs}>
          <Link href="/price/catalog" className={activeMainTab === "catalog" ? styles.btnPrimary : styles.btnGhost}>Товары и услуги</Link>
          <Link href="/price/company" className={activeMainTab === "company" ? styles.btnPrimary : styles.btnGhost}>О компании</Link>
          <Link href="/price/leads" className={activeMainTab === "leads" ? styles.btnPrimary : styles.btnGhost}>Заявки</Link>
        </div>

        <div className={styles.content}>
          {err && <div className={styles.err}>Ошибка: {err}</div>}

          {/* ===================== COMPANY ===================== */}
          {activeMainTab === "company" && (
            <div className={styles.profileContainer}>
              {/* Card 1: Основная информация */}
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <h2 className={styles.h2}>Основные данные</h2>
                  <button className={styles.btnPrimary} onClick={() => saveProfile()} disabled={savingProfile}>
                    {savingProfile ? "Сохранение..." : "Сохранить"}
                  </button>
                </div>
                
                <div className={styles.formGrid}>
                  <div className={styles.fullWidth}>
                    <div className={styles.field}>
                      <label className={styles.label}>Название компании</label>
                      <input 
                        className={styles.input} 
                        value={pName} 
                        onChange={(e) => setPName(e.target.value)} 
                        placeholder="Например: ООО СтройМастер" 
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Телефон</label>
                    <input 
                      className={styles.input} 
                      value={pPhone} 
                      onChange={(e) => setPPhone(formatRuPhoneMasked(e.target.value))} 
                      onBlur={(e) => setPPhone(formatRuPhoneMasked(e.target.value))} 
                      placeholder="+7 (999) 000-00-00" 
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Адрес офиса</label>
                    <input 
                      className={styles.input} 
                      value={pAddress} 
                      onChange={(e) => setPAddress(e.target.value)} 
                      placeholder="Город, улица, дом, офис" 
                    />
                  </div>

                  <div className={styles.fullWidth}>
                    <div className={styles.field}>
                      <label className={styles.label}>Режим работы</label>
                      <input 
                        className={styles.input} 
                        value={pHours} 
                        onChange={(e) => setPHours(e.target.value)} 
                        onBlur={() => setPHours((v) => normDashesSpaces(v))} 
                        placeholder="Например: Пн-Пт 09:00-18:00" 
                      />
                      <div className={styles.workChips}>
                        <button className={styles.chip} onClick={() => setPHours((v) => applyWorkHoursPreset(v, "weekdays"))}>Будни</button>
                        <button className={styles.chip} onClick={() => setPHours((v) => applyWorkHoursPreset(v, "daily"))}>Ежедневно</button>
                        <button className={styles.chip} onClick={() => setPHours((v) => applyWorkHoursPreset(v, "24"))}>24/7</button>
                        <button className={styles.chip} onClick={() => setPHours((v) => applyWorkHoursPreset(v, "weekend"))}>Выходные</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Медиа и Контакты */}
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <h2 className={styles.h2}>Брендинг и контакты</h2>
                </div>

                <div className={styles.mediaSplit}>
                  {/* Левая колонка: Логотип */}
                  <div className={styles.logoArea}>
                    <div className={styles.label}>Логотип</div>
                    <div className={styles.logoPreview}>
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" />
                      ) : (
                        <div className={styles.logoPlaceholder}>
                          <span>🖼️</span>
                          <span>Нет логотипа</span>
                        </div>
                      )}
                    </div>
                    <label className={styles.logoInputLabel}>
                      {logoFileName ? "Изменить файл" : "Загрузить логотип"}
                      <input 
                        type="file" 
                        accept="image/png,image/jpeg,image/webp,image/svg+xml" 
                        onChange={(e) => onPickLogo(e.target.files?.[0] || null)} 
                        style={{ display: "none" }} 
                      />
                    </label>
                    <div className={styles.hint}>PNG, JPG, SVG до 3MB</div>
                  </div>

                  {/* Правая колонка: Соцсети */}
                  <div className={styles.field}>
                    <div className={styles.label}>Сайт и социальные сети</div>
                    <div className={styles.socialGrid}>
                      <div className={styles.field}>
                        <input className={styles.input} value={pSite} onChange={(e) => setPSite(e.target.value)} onBlur={() => setPSite(v => v ? normalizeUrl(v) : "")} placeholder="Сайт (https://...)" />
                      </div>
                      <div className={styles.field}>
                        <input className={styles.input} value={pVk} onChange={(e) => setPVk(e.target.value)} onBlur={() => setPVk(v => v ? normalizeUrl(v) : "")} placeholder="ВКонтакте" />
                      </div>
                      <div className={styles.field}>
                        <input className={styles.input} value={pTg} onChange={(e) => setPTg(e.target.value)} onBlur={() => setPTg(v => v ? normalizeUrl(v) : "")} placeholder="Telegram" />
                      </div>
                      <div className={styles.field}>
                        <input className={styles.input} value={pYt} onChange={(e) => setPYt(e.target.value)} onBlur={() => setPYt(v => v ? normalizeUrl(v) : "")} placeholder="YouTube" />
                      </div>
                    </div>
                    <div className={styles.hint}>Ссылки на профили помогают повысить доверие клиентов.</div>
                  </div>
                </div>
              </div>

              {/* Card 3: Описание и Портфолио */}
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <h2 className={styles.h2}>О компании и портфолио</h2>
                  <button className={styles.btnPrimary} onClick={() => saveProfile()} disabled={savingProfile}>
                    {savingProfile ? "Сохранение..." : "Сохранить"}
                  </button>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.fullWidth}>
                    <div className={styles.field}>
                      <label className={styles.label}>Описание деятельности</label>
                      <textarea 
                        className={styles.textarea} 
                        value={about} 
                        onChange={(e) => setAbout(e.target.value)} 
                        placeholder="Расскажите о вашем опыте, преимуществах и подходе к работе..." 
                      />
                      <div className={styles.hint}>Рекомендуем: 300-2000 символов.</div>
                    </div>
                  </div>

                  <div className={styles.fullWidth}>
                    <div className={styles.photosHeader}>
                      <div>
                        <div className={styles.label}>Примеры работ (Портфолио)</div>
                        <div className={styles.hint}>Загрузите фото реальных объектов (до 40 шт).</div>
                      </div>
                      <label className={styles.uploadBtn}>
                        + Добавить фото
                        <input 
                          type="file" 
                          accept="image/png,image/jpeg,image/webp" 
                          multiple 
                          onChange={(e) => onPickCompanyPhotos(e.target.files)} 
                          style={{ display: "none" }} 
                        />
                      </label>
                    </div>

                    <div className={styles.photosGrid}>
                      {companyPhotos.map((src, idx) => (
                        <div key={`exist-${idx}`} className={styles.photoItem}>
                          <img src={absPublicUrl(src)!} alt="portfolio" />
                          <button className={styles.photoRemove} onClick={() => removeCompanyPhoto(idx)}>×</button>
                        </div>
                      ))}
                      {pickedCompanyPhotos.map((ph, idx) => (
                        <div key={`new-${idx}`} className={styles.photoItem}>
                          <img src={ph.dataUrl} alt="new upload" />
                          <button className={styles.photoRemove} onClick={() => removePickedCompanyPhoto(idx)}>×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ===================== LEADS ===================== */}
          {activeMainTab === "leads" && (
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.h2}>Заявки</h2>
                <div className={styles.leadsControls}>
                  <select className={styles.input} value={leadsStatus} onChange={(e) => setLeadsStatus(e.target.value)}>
                    <option value="">Все</option>
                    <option value="new">Новые</option>
                    <option value="in_work">В работе</option>
                    <option value="done">Закрытые</option>
                    <option value="spam">Спам</option>
                  </select>
                  <button type="button" className={styles.btnGhost} onClick={loadLeads}>Обновить</button>
                </div>
              </div>

              {leadsError ? <div className={styles.err}>Ошибка: {leadsError}</div> : null}
              {leadsLoading ? <div className={styles.hint}>Загрузка…</div> : null}

              <div style={{ width: "100%", overflowX: "auto" }}>
                <table className={styles.catalogTable}>
                  <thead className={styles.catalogThead}>
                    <tr>
                      <th>ID</th>
                      <th>Дата</th>
                      <th>Контакт</th>
                      <th>Сообщение</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody className={styles.catalogTbody}>
                    {leads.map((lead) => {
                      const contact = [lead.contact_name, lead.phone, lead.email].filter(Boolean).join(" · ") || "—";
                      const created = lead.created_at ? new Date(lead.created_at).toLocaleString() : "—";
                      return (
                        <tr key={lead.id}>
                          <td>#{lead.id}</td>
                          <td>{created}</td>
                          <td>{contact}</td>
                          <td>{lead.message || lead.custom_title || "—"}</td>
                          <td>
                            <span className={`${styles.leadStatus} ${styles[`leadStatus_${lead.status}`]}`}>
                              {lead.status}
                            </span>
                          </td>
                          <td>
                            <div className={styles.leadsActions}>
                              <button type="button" className={styles.btnGhost} onClick={() => setLeadStatus(lead.id, "new")}>new</button>
                              <button type="button" className={styles.btnGhost} onClick={() => setLeadStatus(lead.id, "in_work")}>in_work</button>
                              <button type="button" className={styles.btnGhost} onClick={() => setLeadStatus(lead.id, "done")}>done</button>
                              <button type="button" className={styles.btnGhost} onClick={() => setLeadStatus(lead.id, "spam")}>spam</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!leads.length && !leadsLoading ? (
                      <tr>
                        <td colSpan={6}>
                          <div className={styles.empty}>Пока заявок нет.</div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===================== CATALOG ===================== */}
          {activeMainTab === "catalog" && (
            <div className={styles.card}>
              <div className={styles.cardHead} style={{ alignItems: "center" }}>
                <h2 className={styles.h2} style={{ marginBottom: 0 }}>Товары и услуги</h2>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button type="button" className={activeCatalogTab === "products" ? styles.btnPrimary : styles.btnGhost} onClick={() => setActiveCatalogTab("products")}>Товары</button>
                  <button type="button" className={activeCatalogTab === "services" ? styles.btnPrimary : styles.btnGhost} onClick={() => setActiveCatalogTab("services")}>Услуги</button>
                </div>
              </div>
              <div className={styles.hint} style={{ marginBottom: 12 }}>Эти данные используются в кабинете и на карточке компании.</div>
              <div className={styles.filtersRow}>
                <div className={`${styles.field} ${styles.fieldWide}`}><div className={styles.label}>Поиск</div><input className={styles.input} value={catalogQuery} onChange={(e) => setCatalogQuery(e.target.value)} placeholder="Название или slug…" /></div>
                {activeCatalogTab === "products" ? (
                  <div className={styles.field}><div className={styles.label}>Категория</div><select className={styles.input} value={catalogCatId} onChange={(e) => setCatalogCatId(e.target.value)}><option value="">Все</option>{productCategoryOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}</select></div>
                ) : null}
                {activeCatalogTab === "services" ? (
                  <div className={styles.field}><div className={styles.label}>Категория</div><select className={styles.input} value={catalogSvcCat} onChange={(e) => setCatalogSvcCat(e.target.value)}><option value="">Все</option>{serviceCategories.map((c) => (<option key={c} value={c}>{c}</option>))}</select></div>
                ) : null}
              </div>
              <div style={{ width: "100%", overflowX: "auto" }}>
                <table className={styles.catalogTable}>
                  <thead className={styles.catalogThead}><tr><th className={styles.catalogPhotoCell}>Фото</th><th>Название</th><th>Категория</th><th>Цена от, ₽</th><th style={{width: 50}}></th></tr></thead>
                  <tbody className={styles.catalogTbody}>
                    {activeCatalogTab === "products" && filteredCatalogProducts.map((p) => {
                      const pid = String(p.id);
                      const key = `product_${pid}`;
                      const img = absPublicUrl(p.image_url);
                      // Check if item exists in company list (for delete button)
                      const exists = items.some(it => it.kind === 'product' && String(it.product_id) === pid);
                      return (
                        <tr key={key}>
                          <td className={styles.catalogPhotoCell}>
                            <div className={styles.catalogPhoto}>
                              {img ? <img src={img} alt="" style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <span style={{ opacity: 0.55 }}>🧱</span>}
                            </div>
                          </td>
                          <td>
                            <div className={styles.catalogName}>{p.name}</div>
                          </td>
                          <td>{catNameById(p.category_id ?? null)}</td>
                          <td>
                            <input 
                              className={styles.input} 
                              style={{width: 120, padding: '8px 12px'}} 
                              placeholder="0" 
                              value={priceDraft[key] ?? ""}
                              onChange={(e) => setPriceDraft(prev => ({...prev, [key]: e.target.value}))}
                              onBlur={(e) => upsertPrice('product', p.id, e.target.value)}
                            />
                          </td>
                          <td>
                            {exists && (
                              <button 
                                title="Удалить из прайса"
                                style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#ef4444', padding: 8}}
                                onClick={() => deleteItemManual('product', p.id)}
                              >
                                ×
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {activeCatalogTab === "services" && filteredCatalogServices.map((s) => {
                      const sid = String(s.id);
                      const key = `service_${sid}`;
                      const img = absPublicUrl(s.image_url);
                      const exists = items.some(it => it.kind === 'service' && String(it.service_id) === sid);
                      return (
                        <tr key={key}>
                          <td className={styles.catalogPhotoCell}>
                            <div className={styles.catalogPhoto}>
                              {img ? <img src={img} alt="" style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <span style={{ opacity: 0.55 }}>🛠️</span>}
                            </div>
                          </td>
                          <td>
                            <div className={styles.catalogName}>{s.name}</div>
                          </td>
                          <td>{normCat(s.category)}</td>
                          <td>
                            <input 
                              className={styles.input} 
                              style={{width: 120, padding: '8px 12px'}} 
                              placeholder="0" 
                              value={priceDraft[key] ?? ""}
                              onChange={(e) => setPriceDraft(prev => ({...prev, [key]: e.target.value}))}
                              onBlur={(e) => upsertPrice('service', s.id, e.target.value)}
                            />
                          </td>
                          <td>
                            {exists && (
                              <button 
                                title="Удалить из прайса"
                                style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#ef4444', padding: 8}}
                                onClick={() => deleteItemManual('service', s.id)}
                              >
                                ×
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {activeCatalogTab === "products" && filteredCatalogProducts.length === 0 && (<tr><td colSpan={5}><div className={styles.empty}>Ничего не найдено.</div></td></tr>)}
                    {activeCatalogTab === "services" && filteredCatalogServices.length === 0 && (<tr><td colSpan={5}><div className={styles.empty}>Ничего не найдено.</div></td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ===================== Drawer ===================== */}
        {showAdd && (
          <AddItemForm
            kind={kind}
            setKind={setKind}
            serviceCategories={serviceCategories}
            serviceCategory={serviceCategory}
            setServiceCategory={setServiceCategory}
            serviceId={serviceId}
            setServiceId={setServiceId}
            filteredServicesForAdd={filteredServicesForAdd}
            productCategoryOptions={productCategoryOptions}
            productCategoryId={productCategoryId}
            setProductCategoryId={setProductCategoryId}
            createNewProduct={createNewProduct}
            setCreateNewProduct={setCreateNewProduct}
            productId={productId}
            setProductId={setProductId}
            filteredProductsForAdd={filteredProductsForAdd}
            // ✅ FIX: Coerce duplicateProduct to boolean
            duplicateProduct={!!duplicateProduct}
            newProductName={newProductName}
            setNewProductName={setNewProductName}
            newProductDescription={newProductDescription}
            setNewProductDescription={setNewProductDescription}
            newProductCover={newProductCover}
            setNewProductCover={setNewProductCover}
            onPickProductCover={onPickProductCover}
            newProductSpecs={newProductSpecs}
            updateSpecRow={updateSpecRow}
            removeSpecRow={removeSpecRow}
            addSpecRow={addSpecRow}
            priceMin={priceMin}
            setPriceMin={setPriceMin}
            onClose={() => setShowAdd(false)}
            onCancel={() => {
              resetNewItemForm();
              setShowAdd(false);
            }}
            onAdd={addItem}
          />
        )}
      </main>
    </div>
  );
}
