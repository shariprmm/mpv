// /apps/admin/app/price/page.tsx
"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import React, { useEffect, useMemo, useState } from "react";
import "react-quill/dist/quill.snow.css";
import styles from "./price.module.css";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

type IdLike = string | number;

type Service = { id: IdLike; name: string; slug: string; category?: string | null };

type Product = {
  id: IdLike;
  name: string;
  slug: string;
  category_id?: number | null;
  category?: string | null;
};

type CategoryFlat = {
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

type PickedPhoto = {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
};

type SpecRow = { name: string; value: string };

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

async function jreq(url: string, method: "POST" | "PATCH" | "DELETE", body?: any) {
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

  return (
    s
      .split("")
      .map((ch) => map[ch] ?? ch)
      .join("")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  );
}

function formatPriceForSeo(price: number | null) {
  if (price == null) return "";
  return new Intl.NumberFormat("ru-RU").format(price);
}

function stripHtmlText(value: string) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SITE =
  process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/+$/, "") || "https://moydompro.ru";

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
  return s ? s : "Без категории";
}

function kindLabel(k: CompanyItem["kind"]) {
  if (k === "service") return "Услуга";
  if (k === "product") return "Товар";
  return "Своя";
}

/* =========================
   Work hours: chips + upsert
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
  if (preset === "weekdays") return upsertBlock(base, "будни", "будни 10:00-19:00");
  if (preset === "weekend") return upsertBlock(base, "выходные", "выходные 10:00-18:00");
  if (preset === "break") return upsertBlock(base, "перерыв", "перерыв 12:00-13:00");
  if (preset === "daily") return upsertBlock(base, "ежедневно", "ежедневно 10:00-19:00");
  return upsertBlock(base, "круглосуточно", "круглосуточно");
}

/* =========================
   Phone mask + URL-only socials
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

function looksLikeUrl(v: string) {
  const s = String(v || "").trim();
  if (!s) return true;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeUrl(v: string) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/+/, "")}`;
}

export default function PricePage() {
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

  // ===== sections/tabs =====
  const [activeMainTab, setActiveMainTab] = useState<"catalog" | "company" | "leads">("catalog");
  const [activeCatalogTab, setActiveCatalogTab] = useState<"products" | "services">("products");

  // ===== Leads =====
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [leadsStatus, setLeadsStatus] = useState<string>("");
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState<string>("");

  // ===== Company profile form =====
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

  // ===== Price add/edit =====
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

  // price list UI
  const [priceDraft, setPriceDraft] = useState<Record<number, string>>({});
  const [editDesc, setEditDesc] = useState<Record<number, string>>({});

  const [itemsKindFilter, setItemsKindFilter] = useState<"all" | "service" | "product">("all");
  const [itemsCategoryFilter, setItemsCategoryFilter] = useState<string>(""); // "" = all
  const [itemsQuery, setItemsQuery] = useState("");

  // ===== Catalog (products/services) =====
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogCatId, setCatalogCatId] = useState<string>(""); // for products filter
  const [catalogSvcCat, setCatalogSvcCat] = useState<string>(""); // for services filter

  // modal: edit product/service (removed)

  const serviceCategories = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) set.add(normCat(s.category));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [services]);

  const filteredServicesForAdd = useMemo(() => {
    const cat = serviceCategory ? normCat(serviceCategory) : "";
    if (!cat) return services;
    return services.filter((s) => normCat(s.category) === cat);
  }, [services, serviceCategory]);

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

  const selectedCatIds = useMemo(() => {
    const root = productCategoryId ? Number(productCategoryId) : 0;
    if (!root) return new Set<number>();

    const out = new Set<number>();
    const stack = [root];
    while (stack.length) {
      const cur = stack.pop()!;
      if (out.has(cur)) continue;
      out.add(cur);
      const kids = catChildren.get(cur) || [];
      for (const k of kids) stack.push(k);
    }
    return out;
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

  const titleByItem = useMemo(() => {
    const smap = new Map(services.map((s) => [String(s.id), s.name]));
    const pmap = new Map(products.map((p) => [String(p.id), p.name]));

    return (it: CompanyItem) => {
      if (it.kind === "service") {
        const key = it.service_id == null ? "" : String(it.service_id);
        return it.service_name || smap.get(key) || "Услуга";
      }
      if (it.kind === "product") {
        const key = it.product_id == null ? "" : String(it.product_id);
        return it.product_name || pmap.get(key) || "Товар";
      }
      return it.custom_title || "Своя позиция";
    };
  }, [services, products]);

  const catNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of productCategories) map.set(c.id, c.path_name || c.name);
    return (id: number | null | undefined) => (id ? map.get(id) || "—" : "—");
  }, [productCategories]);

  // ✅ Обновленная логика получения названия категории
  const categoryByItem = useMemo(() => {
    const sMap = new Map<string, string>();
    for (const s of services) sMap.set(String(s.id), normCat(s.category));

    const pMap = new Map<string, string>();
    for (const p of products) {
        // Пробуем взять по category_id, если нет - fallback на текстовое поле category
        let cName = "—";
        if (p.category_id) {
            cName = catNameById(p.category_id) || "—";
        } else if (p.category) {
            cName = p.category;
        }
        pMap.set(String(p.id), cName);
    }

    return (it: CompanyItem) => {
      if (it.kind === "service") return sMap.get(String(it.service_id)) || "—";
      if (it.kind === "product") return pMap.get(String(it.product_id)) || "—";
      return "—";
    };
  }, [services, products, catNameById]);

  // Вычисляем доступные категории для фильтра
  const availableCategories = useMemo(() => {
      const set = new Set<string>();
      const preFiltered = items.filter(it => {
          if (itemsKindFilter !== 'all' && it.kind !== itemsKindFilter) return false;
          return true;
      });

      for (const it of preFiltered) {
          const cat = categoryByItem(it);
          if (cat && cat !== "—") set.add(cat);
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [items, itemsKindFilter, categoryByItem]);

  useEffect(() => {
    setItemsCategoryFilter("");
  }, [itemsKindFilter]);

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

    setEditDesc((prev) => {
      const next = { ...prev };
      for (const it of serverItems) {
        if (next[it.id] === undefined) next[it.id] = (it.description || "").toString();
      }
      return next;
    });

    setPriceDraft((prev) => {
      const next = { ...prev };
      for (const it of serverItems) {
        if (next[it.id] === undefined) next[it.id] = it.price_min == null ? "" : String(it.price_min);
      }
      for (const k of Object.keys(next)) {
        const id = Number(k);
        if (!serverItems.some((x) => x.id === id)) delete next[id];
      }
      return next;
    });

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
    const catToUse = (serviceCategory || firstSvcCat || "").trim();
    const list = catToUse ? svcItems.filter((s) => normCat(s.category) === normCat(catToUse)) : svcItems;
    if (list.length) setServiceId((prev) => prev || String(list[0].id));

    const firstProductCategoryId = catItems.length ? String(catItems[0].id) : "";
    setProductCategoryId((prev) => prev || firstProductCategoryId);
    setCatalogCatId((prev) => prev || firstProductCategoryId);
    setCatalogSvcCat((prev) => prev || firstSvcCat);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMainTab, leadsStatus]);

  async function addItem() {
    setErr(null);
    try {
      const priceValue = toNumOrNull(priceMin);
      let productIdToUse = productId;

      if (kind === "product" && createNewProduct) {
        const trimmedName = newProductName.trim();
        const trimmedDesc = newProductDescription.trim();
        const descText = stripHtmlText(trimmedDesc);
        if (!productCategoryId) { setErr("Выбери категорию товара."); return; }
        if (!trimmedName) { setErr("Укажи название товара."); return; }
        if (!descText) { setErr("Добавь описание товара."); return; }
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

      if (kind === "product" && !productIdToUse) { setErr("Выбери товар."); return; }
      if (kind === "service" && !serviceId) { setErr("Выбери услугу."); return; }
      const body: any = { kind, price_min: priceValue, price_max: null };
      if (kind === "service") body.service_id = serviceId ? Number(serviceId) : null;
      if (kind === "product") body.product_id = productIdToUse ? Number(productIdToUse) : null;
      await jreq(`${API}/company-items`, "POST", body);
      await loadAll();
      resetNewItemForm();
      setShowAdd(false);
    } catch (e: any) { setErr(e?.message || String(e)); }
  }

  async function saveItemPrice(it: CompanyItem, nextPriceMin: number | null) {
    setErr(null);
    setSavingId(it.id);
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, price_min: nextPriceMin, price_max: null } : x)));
    try {
      await jreq(`${API}/company-items/${it.id}`, "PATCH", { price_min: nextPriceMin, price_max: null });
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || String(e));
      await loadAll();
    } finally { setSavingId(null); }
  }

  async function delItem(id: number) {
    setErr(null);
    try { await jreq(`${API}/company-items/${id}`, "DELETE"); await loadAll(); } catch (e: any) { setErr(e?.message || String(e)); }
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

  const filteredItems = useMemo(() => {
    const q = itemsQuery.trim().toLowerCase();
    return (items || []).filter((it) => {
      if (it.kind === "custom") return false;
      if (itemsKindFilter !== "all" && it.kind !== itemsKindFilter) return false;
      
      // Проверка категории
      if (itemsCategoryFilter) {
          const cat = categoryByItem(it);
          if (cat !== itemsCategoryFilter) return false;
      }

      if (!q) return true;
      const t = titleByItem(it).toLowerCase();
      return t.includes(q);
    });
  }, [items, itemsQuery, itemsKindFilter, itemsCategoryFilter, titleByItem, categoryByItem]);

  const filteredCatalogProducts = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    const catId = catalogCatId ? Number(catalogCatId) : 0;
    let list = products.slice(0);
    if (catId && products.some((p) => p.category_id != null)) {
      const out = new Set<number>();
      const stack = [catId];
      while (stack.length) {
        const cur = stack.pop()!;
        if (out.has(cur)) continue; out.add(cur);
        const kids = catChildren.get(cur) || [];
        for (const k of kids) stack.push(k);
      }
      list = list.filter((p) => { const cid = Number(p.category_id || 0); return cid && out.has(cid); });
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
  }, [products, catalogQuery, catalogCatId, catChildren]);

  const filteredCatalogServices = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    const cat = catalogSvcCat ? normCat(catalogSvcCat) : "";
    let list = services.slice(0);
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
  }, [services, catalogQuery, catalogSvcCat]);

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
            <button type="button" className={`${styles.navItem} ${activeMainTab === "catalog" ? styles.navItemActive : ""}`} onClick={() => setActiveMainTab("catalog")}>
              <span className={styles.navIcon}>🧾</span><span className={styles.navLabel}>Товары и услуги</span>
            </button>
            <button type="button" className={`${styles.navItem} ${activeMainTab === "company" ? styles.navItemActive : ""}`} onClick={() => setActiveMainTab("company")}>
              <span className={styles.navIcon}>🏢</span><span className={styles.navLabel}>О компании</span>
            </button>
            <button type="button" className={`${styles.navItem} ${activeMainTab === "leads" ? styles.navItemActive : ""}`} onClick={() => setActiveMainTab("leads")}>
              <span className={styles.navIcon}>📨</span><span className={styles.navLabel}>Заявки</span>
            </button>
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
          <button type="button" className={activeMainTab === "catalog" ? styles.btnPrimary : styles.btnGhost} onClick={() => setActiveMainTab("catalog")}>Товары и услуги</button>
          <button type="button" className={activeMainTab === "company" ? styles.btnPrimary : styles.btnGhost} onClick={() => setActiveMainTab("company")}>О компании</button>
          <button type="button" className={activeMainTab === "leads" ? styles.btnPrimary : styles.btnGhost} onClick={() => setActiveMainTab("leads")}>Заявки</button>
        </div>

        <div className={styles.content}>
          {err && <div className={styles.err}>Ошибка: {err}</div>}

          {/* ===================== COMPANY ===================== */}
          {activeMainTab === "company" && (
            <>
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <h2 className={styles.h2}>Профиль компании</h2>
                  <button className={styles.btnPrimary} onClick={() => saveProfile()} disabled={savingProfile}>{savingProfile ? "Сохранение…" : "Сохранить"}</button>
                </div>
                <div className={styles.profileGrid}>
                  <div className={`${styles.field} ${styles.fieldWide}`}><div className={styles.label}>Название компании</div><input className={styles.input} value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Например: ООО УСАДЬБА-ПРО" /></div>
                  <div className={styles.field}><div className={styles.label}>Телефон</div><input className={styles.input} value={pPhone} onChange={(e) => setPPhone(formatRuPhoneMasked(e.target.value))} onBlur={(e) => setPPhone(formatRuPhoneMasked(e.target.value))} placeholder="+7 (___) ___-__-__" inputMode="tel" autoComplete="tel" /><div className={styles.hint}>Формат: +7 (999) 123-45-67</div></div>
                  <div className={`${styles.field} ${styles.fieldWide}`}><div className={styles.label}>Адрес</div><input className={styles.input} value={pAddress} onChange={(e) => setPAddress(e.target.value)} placeholder="Город, улица, дом" /></div>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <div className={styles.label}>Время работы</div><input className={styles.input} value={pHours} onChange={(e) => setPHours(e.target.value)} onBlur={() => setPHours((v) => normDashesSpaces(v))} placeholder="будни 10:00-19:00, перерыв 12:00-13:00; выходные 10:00-18:00" />
                    <div className={styles.workChips}>
                      <button type="button" className={styles.chip} onClick={() => setPHours((v) => applyWorkHoursPreset(v, "weekdays"))}>Будни</button>
                      <button type="button" className={styles.chip} onClick={() => setPHours((v) => applyWorkHoursPreset(v, "daily"))}>Ежедневно</button>
                      <button type="button" className={styles.chip} onClick={() => setPHours((v) => applyWorkHoursPreset(v, "24"))}>Круглосуточно</button>
                      <button type="button" className={styles.chip} onClick={() => setPHours((v) => applyWorkHoursPreset(v, "weekend"))}>Выходные</button>
                      <button type="button" className={styles.chip} onClick={() => setPHours((v) => applyWorkHoursPreset(v, "break"))}>Перерыв</button>
                    </div>
                    <div className={styles.hint}>Пример: <b>будни 10:00-19:00</b>, <b>перерыв 12:00-13:00</b>; <b>выходные 10:00-18:00</b></div>
                  </div>
                </div>
                <div className={styles.logoRow}>
                  <div className={styles.logoBox}>
                    <div className={styles.label}>Логотип</div>
                    <div className={styles.logoInner}>
                      <div className={styles.logoPreview}>{logoPreview ? <img src={logoPreview} alt="logo" /> : <div className={styles.logoEmpty}>Нет логотипа</div>}</div>
                      <div className={styles.logoActions}>
                        <label className={styles.btnGhost} style={{ cursor: "pointer" }}>Загрузить<input type="file" accept="image/*" onChange={(e) => onPickLogo(e.target.files?.[0] || null)} style={{ display: "none" }} /></label>
                        <div className={styles.hint}>{logoFileName ? logoFileName : "png/jpg/webp/svg, до 3MB"}</div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.note}>
                    <div className={styles.noteTitle}>Сайт и социальные сети</div>
                    <div className={styles.noteText}>Вводи только ссылки вида <b>https://...</b></div>
                    <div className={styles.socialList}>
                      <div><div className={styles.label}>Веб-сайт</div><input className={styles.input} value={pSite} onChange={(e) => setPSite(e.target.value)} onBlur={() => setPSite((v) => (v ? normalizeUrl(v) : ""))} placeholder="https://example.ru/" inputMode="url" /></div>
                      <div><div className={styles.label}>ВКонтакте</div><input className={styles.input} value={pVk} onChange={(e) => setPVk(e.target.value)} onBlur={() => setPVk((v) => (v ? normalizeUrl(v) : ""))} placeholder="https://vk.com/..." inputMode="url" /></div>
                      <div><div className={styles.label}>YouTube</div><input className={styles.input} value={pYt} onChange={(e) => setPYt(e.target.value)} onBlur={() => setPYt((v) => (v ? normalizeUrl(v) : ""))} placeholder="https://youtube.com/..." inputMode="url" /></div>
                      <div><div className={styles.label}>Telegram</div><input className={styles.input} value={pTg} onChange={(e) => setPTg(e.target.value)} onBlur={() => setPTg((v) => (v ? normalizeUrl(v) : ""))} placeholder="https://t.me/..." inputMode="url" /></div>
                    </div>
                    <div className={styles.hint} style={{ marginTop: 8 }}>На публичной странице рендерить ссылки как <code>rel="nofollow noopener noreferrer"</code>.</div>
                  </div>
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <h2 className={styles.h2}>О компании и примеры работ</h2>
                  <button className={styles.btnPrimary} onClick={() => saveProfile()} disabled={savingProfile}>{savingProfile ? "Сохранение…" : "Сохранить"}</button>
                </div>
                <div className={styles.formGrid}>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <div className={styles.label}>Описание</div>
                    <textarea className={`${styles.input} ${styles.textarea}`} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Расскажи о компании, опыте, подходе к работе." rows={6} />
                    <div className={styles.hint}>До 5000 символов.</div>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div className={styles.detailsTitle}>Примеры работ (фото)</div>
                  <div className={styles.photosRow}>
                    <label className={styles.btnGhost} style={{ cursor: "pointer" }}>Добавить фото<input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => onPickCompanyPhotos(e.target.files)} style={{ display: "none" }} /></label>
                    <div className={styles.hint}>До 40 фото, png/jpg/webp, до 3MB каждое.</div>
                  </div>
                  {(companyPhotos.length > 0 || pickedCompanyPhotos.length > 0) && (
                    <div className={styles.photosGrid}>
                      {companyPhotos.map((src, idx) => {
                        const url = absPublicUrl(src);
                        return (<div key={`existing-${idx}`} className={styles.photoCard}>{url ? <img src={url} alt={`company-${idx + 1}`} /> : <div className={styles.logoEmpty}>Нет фото</div>}<button className={styles.photoDel} type="button" onClick={() => removeCompanyPhoto(idx)} title="Убрать">×</button></div>);
                      })}
                      {pickedCompanyPhotos.map((ph, idx) => (<div key={`new-${idx}`} className={styles.photoCard}><img src={ph.dataUrl} alt={ph.name} /><button className={styles.photoDel} type="button" onClick={() => removePickedCompanyPhoto(idx)} title="Убрать">×</button><div className={styles.photoName} title={ph.name}>{ph.name}</div></div>))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ===================== PRICE ===================== */}
          {activeMainTab === "catalog" && (
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.h2}>Позиции прайса</h2>
              </div>

              <div className={styles.filtersRow}>
                <div className={styles.field}>
                  <div className={styles.label}>Тип</div>
                  <select className={styles.input} value={itemsKindFilter} onChange={(e) => setItemsKindFilter(e.target.value as any)}>
                    <option value="all">Все</option>
                    <option value="service">Услуги</option>
                    <option value="product">Товары</option>
                  </select>
                </div>

                {/* ✅ Новый фильтр по категориям */}
                <div className={styles.field} style={{ minWidth: 200 }}>
                  <div className={styles.label}>Категория</div>
                  <select className={styles.input} value={itemsCategoryFilter} onChange={(e) => setItemsCategoryFilter(e.target.value)}>
                    <option value="">Все категории</option>
                    {availableCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <div className={styles.label}>Поиск</div>
                  <input className={styles.input} value={itemsQuery} onChange={(e) => setItemsQuery(e.target.value)} placeholder="Название…" />
                </div>
              </div>

              <div className={styles.listCompact}>
                {filteredItems.map((it) => {
                  const draft = priceDraft[it.id] ?? (it.price_min == null ? "" : String(it.price_min));
                  return (
                    <div key={it.id} className={styles.row}>
                      <div className={styles.rowMain}>
                        <div className={styles.rowTitle}>
                          <div className={styles.rowTitleTop}>
                            <span className={`${styles.badge} ${styles["badge_" + it.kind]}`}>{kindLabel(it.kind)}</span>
                            <span className={styles.rowName}>{titleByItem(it)}</span>
                            {/* ✅ Вывод названия категории */}
                            <span style={{ color: "#888", fontSize: "13px", marginLeft: "10px" }}>{categoryByItem(it)}</span>
                          </div>
                          <div className={styles.rowMeta}>
                            {/* ✅ УБРАН ID, оставлен только статус сохранения */}
                            {savingId === it.id ? <span className={styles.savingInline}>сохранение…</span> : null}
                          </div>
                        </div>
                        <div className={styles.rowPrice}>
                          <label className={styles.miniField}>
                            <span className={styles.miniLabel}>Цена от, ₽</span>
                            <input className={styles.input} value={draft} onChange={(e) => setPriceDraft((prev) => ({ ...prev, [it.id]: e.target.value }))} onBlur={() => { const v = toNumOrNull(priceDraft[it.id] ?? draft); saveItemPrice(it, v); }} inputMode="decimal" />
                          </label>
                          {/* ✅ УБРАН БЛОК "ИТОГО" */}
                        </div>
                        <div className={styles.rowActions}>
                          <button className={styles.btnGhost} onClick={() => delItem(it.id)}>Удалить</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!filteredItems.length && <div className={styles.empty}>Пока нет позиций (или фильтр всё скрыл).</div>}
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
                  <thead className={styles.catalogThead}><tr><th className={styles.catalogPhotoCell}>Фото</th><th>Название</th><th>Категория</th><th>Slug</th></tr></thead>
                  <tbody className={styles.catalogTbody}>
                    {activeCatalogTab === "products" && filteredCatalogProducts.map((p) => (
                      <tr key={`p-${String(p.id)}`}><td className={styles.catalogPhotoCell}><div className={styles.catalogPhoto}><span style={{ opacity: 0.55 }}>🧱</span></div></td><td><div className={styles.catalogName}>{p.name}</div><div className={styles.catalogMeta}>ID: {String(p.id)}</div></td><td>{catNameById(p.category_id ?? null)}</td><td><div className={styles.catalogSlug}>{p.slug || "—"}</div></td></tr>
                    ))}
                    {activeCatalogTab === "services" && filteredCatalogServices.map((s) => (
                      <tr key={`s-${String(s.id)}`}><td className={styles.catalogPhotoCell}><div className={styles.catalogPhoto}><span style={{ opacity: 0.55 }}>🛠️</span></div></td><td><div className={styles.catalogName}>{s.name}</div><div className={styles.catalogMeta}>ID: {String(s.id)}</div></td><td>{normCat(s.category)}</td><td><div className={styles.catalogSlug}>{s.slug || "—"}</div></td></tr>
                    ))}
                    {activeCatalogTab === "products" && filteredCatalogProducts.length === 0 && (<tr><td colSpan={4}><div className={styles.empty}>Ничего не найдено.</div></td></tr>)}
                    {activeCatalogTab === "services" && filteredCatalogServices.length === 0 && (<tr><td colSpan={4}><div className={styles.empty}>Ничего не найдено.</div></td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ===================== Drawer ===================== */}
        {showAdd && (
          <div className={styles.drawerOverlay} role="dialog" aria-modal="true">
            <div className={styles.drawer}>
              <div className={styles.drawerHead}><div><div className={styles.drawerTitle}>Добавить позицию</div><div className={styles.drawerSub}>Добавь услугу или товар с ценой. Для товара можно создать карточку с нуля.</div></div><button className={styles.btnGhost} onClick={() => setShowAdd(false)}>Закрыть</button></div>
              <div className={styles.drawerBody}>
                <div className={styles.formGrid}>
                <div className={styles.field}><div className={styles.label}>Тип</div><select className={styles.input} value={kind} onChange={(e) => setKind(e.target.value as any)}><option value="service">Услуга</option><option value="product">Товар</option></select></div>
                {kind === "service" && (
                  <>
                    <div className={styles.field}><div className={styles.label}>Категория</div><select className={styles.input} value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value)}>{serviceCategories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}</select></div>
                    <div className={`${styles.field} ${styles.fieldWide}`}><div className={styles.label}>Услуга</div><select className={styles.input} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>{filteredServicesForAdd.map((s) => (<option key={String(s.id)} value={String(s.id)}>{s.name}</option>))}</select></div>
                  </>
                )}
                {kind === "product" && (
                  <>
                    <div className={styles.field}><div className={styles.label}>Категория товара</div><select className={styles.input} value={productCategoryId} onChange={(e) => setProductCategoryId(e.target.value)}><option value="">— выбери категорию —</option>{productCategoryOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}</select></div>
                    <div className={`${styles.field} ${styles.fieldWide}`}>
                      <div className={styles.label}>Создать новый товар</div>
                      <label className={styles.toggleRow}>
                        <input type="checkbox" checked={createNewProduct} onChange={(e) => setCreateNewProduct(e.target.checked)} />
                        <span>Создать товар с нуля</span>
                      </label>
                    </div>
                    {!createNewProduct && (
                      <div className={`${styles.field} ${styles.fieldWide}`}>
                        <div className={styles.label}>Товар</div><select className={styles.input} value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">— выбери товар —</option>{filteredProductsForAdd.map((p) => (<option key={String(p.id)} value={String(p.id)}>{p.name}</option>))}</select>
                        {productCategoryId && filteredProductsForAdd.length === 0 && (<div className={styles.hint}>В этой категории пока нет товаров. Проверь category_id у товара в БД/API.</div>)}
                      </div>
                    )}
                    {createNewProduct && (
                      <>
                        <div className={`${styles.field} ${styles.fieldWide}`}>
                          <div className={styles.label}>Название товара</div>
                          <input className={`${styles.input} ${duplicateProduct ? styles.inputError : ""}`} value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="Напр. Пластиковые окна" />
                          {duplicateProduct && (<div className={styles.fieldError}>Товар с таким названием уже существует.</div>)}
                        </div>
                        <div className={`${styles.field} ${styles.fieldWide}`}>
                          <div className={styles.label}>Описание товара (каноничное)</div>
                          <div className={styles.editor}>
                            <ReactQuill theme="snow" value={newProductDescription} onChange={setNewProductDescription} placeholder="Каноничное описание товара" />
                          </div>
                        </div>
                        <div className={`${styles.field} ${styles.fieldWide}`}>
                          <div className={styles.label}>Cover-картинка товара</div>
                          <div className={styles.coverRow}>
                            <input className={styles.input} type="file" accept="image/*" onChange={(e) => onPickProductCover(e.target.files?.[0] || null)} />
                            {newProductCover && (
                              <div className={styles.coverPreview}>
                                <img src={newProductCover.dataUrl} alt="cover-preview" />
                                <button type="button" className={styles.photoDel} onClick={() => setNewProductCover(null)} title="Убрать">×</button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={`${styles.field} ${styles.fieldWide}`}>
                          <div className={styles.label}>Характеристики (до 10)</div>
                          <div className={styles.specsList}>
                            {newProductSpecs.map((row, idx) => (
                              <div key={`spec-${idx}`} className={styles.specRow}>
                                <input className={styles.input} value={row.name} onChange={(e) => updateSpecRow(idx, "name", e.target.value)} placeholder="Название" />
                                <input className={styles.input} value={row.value} onChange={(e) => updateSpecRow(idx, "value", e.target.value)} placeholder="Значение" />
                                <button type="button" className={styles.specRemove} onClick={() => removeSpecRow(idx)}>×</button>
                              </div>
                            ))}
                          </div>
                          <button type="button" className={styles.btnGhost} onClick={addSpecRow} disabled={newProductSpecs.length >= 10}>Добавить характеристику</button>
                          <div className={styles.hint}>SEO (h1/title/description) генерируется автоматически из названия компании, региона и цены.</div>
                        </div>
                      </>
                    )}
                  </>
                )}
                <div className={styles.field}><div className={styles.label}>Цена от, ₽</div><input className={styles.input} value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="Напр. 1500" inputMode="decimal" /></div>
                </div>
              </div>
              <div className={styles.drawerFooter}><button className={styles.btnGhost} onClick={() => { resetNewItemForm(); setShowAdd(false); }}>Отмена</button><button className={styles.btnPrimary} onClick={addItem}>Добавить</button></div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
