// /apps/admin/app/price/page.tsx
"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
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
  vk_url: string | null;
  tg_url: string | null;
  youtube_url: string | null;
  website_url?: string | null;
  logo_url: string | null;
};

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

const SITE =
  process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/+$/, "") || "https://moydompro.ru";

function absPublicUrl(p: string | null | undefined) {
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;

  const path = p.startsWith("/") ? p : `/${p}`;
  if (path.startsWith("/uploads/")) return `${SITE}${path}`;
  return `${API}${path}`;
}

type PickedPhoto = {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
};

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = () => reject(new Error("Не удалось прочитать файл"));
    fr.readAsDataURL(file);
  });
}

function isAllowedImageType(mime: string) {
  const t = String(mime || "").toLowerCase();
  return ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(t);
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
  const [activeMainTab, setActiveMainTab] = useState<"price" | "catalog" | "company">("price");
  const [activeCatalogTab, setActiveCatalogTab] = useState<"products" | "services" | "custom">(
    "products"
  );

  // ===== Company profile form =====
  const [pName, setPName] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pAddress, setPAddress] = useState("");
  const [pHours, setPHours] = useState("");
  const [pSite, setPSite] = useState("");
  const [pVk, setPVk] = useState("");
  const [pTg, setPTg] = useState("");
  const [pYt, setPYt] = useState("");

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string>("");

  // ===== Price add/edit =====
  const [kind, setKind] = useState<"service" | "product" | "custom">("service");
  const [serviceCategory, setServiceCategory] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [customTitle, setCustomTitle] = useState<string>("");
  const [priceMin, setPriceMin] = useState<string>("");
  const [newDesc, setNewDesc] = useState<string>("");
  const [newPhotos, setNewPhotos] = useState<PickedPhoto[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  // price list UI
  const [openItem, setOpenItem] = useState<Record<number, boolean>>({});
  const [priceDraft, setPriceDraft] = useState<Record<number, string>>({});
  const [editDesc, setEditDesc] = useState<Record<number, string>>({});
  const [editPhotos, setEditPhotos] = useState<Record<number, PickedPhoto[]>>({});

  const [itemsKindFilter, setItemsKindFilter] = useState<"all" | "service" | "product" | "custom">(
    "all"
  );
  const [itemsQuery, setItemsQuery] = useState("");

  // ===== Catalog (products/services/custom) =====
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogCatId, setCatalogCatId] = useState<string>(""); // for products filter
  const [catalogSvcCat, setCatalogSvcCat] = useState<string>(""); // for services filter

  // modal: edit product/service/custom
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editMode, setEditMode] = useState<"product" | "service" | "custom">("product");
  const [editId, setEditId] = useState<number | null>(null);

  const [eName, setEName] = useState("");
  const [eSlug, setESlug] = useState("");
  const [eCatId, setECatId] = useState<string>("");
  const [eSvcCat, setESvcCat] = useState<string>("");
  const [eDesc, setEDesc] = useState("");
  const [ePicked, setEPicked] = useState<PickedPhoto[]>([]);
  const [eKeepServerPhotos, setEKeepServerPhotos] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  // create product in drawer (existing feature)
  const [newProductName, setNewProductName] = useState<string>("");
  const [newProductSlug, setNewProductSlug] = useState<string>("");
  const [creatingProduct, setCreatingProduct] = useState<boolean>(false);

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

  function resetNewItemForm() {
    setCustomTitle("");
    setPriceMin("");
    setNewDesc("");
    setNewPhotos([]);
  }

  async function onPickNewPhotos(files: FileList | null) {
    if (!files || !files.length) return;
    setErr(null);

    const existing = newPhotos.slice(0);
    const canAdd = Math.max(0, 5 - existing.length);
    const list = Array.from(files).slice(0, canAdd);

    if (!list.length) {
      setErr("Можно прикрепить максимум 5 фото.");
      return;
    }

    const added: PickedPhoto[] = [];
    for (const f of list) {
      if (!isAllowedImageType(f.type)) {
        setErr("Фото: поддерживаются только png/jpg/webp.");
        continue;
      }
      if (f.size > 3 * 1024 * 1024) {
        setErr("Фото: файл слишком большой (макс 3MB).");
        continue;
      }
      const dataUrl = await fileToDataUrl(f);
      added.push({ name: f.name, size: f.size, type: f.type, dataUrl });
    }

    const next = [...existing, ...added].slice(0, 5);
    setNewPhotos(next);
  }

  function removeNewPhoto(idx: number) {
    setNewPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onPickEditPhotos(itemId: number, files: FileList | null) {
    if (!files || !files.length) return;
    setErr(null);

    const existing = (editPhotos[itemId] || []).slice(0);
    const canAdd = Math.max(0, 5 - existing.length);
    const list = Array.from(files).slice(0, canAdd);

    if (!list.length) {
      setErr("Можно прикрепить максимум 5 фото.");
      return;
    }

    const added: PickedPhoto[] = [];
    for (const f of list) {
      if (!isAllowedImageType(f.type)) {
        setErr("Фото: поддерживаются только png/jpg/webp.");
        continue;
      }
      if (f.size > 3 * 1024 * 1024) {
        setErr("Фото: файл слишком большой (макс 3MB).");
        continue;
      }
      const dataUrl = await fileToDataUrl(f);
      added.push({ name: f.name, size: f.size, type: f.type, dataUrl });
    }

    const next = [...existing, ...added].slice(0, 5);
    setEditPhotos((prev) => ({ ...prev, [itemId]: next }));
  }

  function removeEditPhoto(itemId: number, idx: number) {
    setEditPhotos((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || []).filter((_, i) => i !== idx),
    }));
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
    setLogoPreview(absPublicUrl(cp.logo_url));

    const firstSvcCat = svcItems.length ? normCat(svcItems[0].category) : "";
    setServiceCategory((prev) => prev || firstSvcCat);

    const catToUse = (serviceCategory || firstSvcCat || "").trim();
    const list = catToUse
      ? svcItems.filter((s) => normCat(s.category) === normCat(catToUse))
      : svcItems;
    if (list.length) setServiceId((prev) => prev || String(list[0].id));

    const firstProductCategoryId = catItems.length ? String(catItems[0].id) : "";
    setProductCategoryId((prev) => prev || firstProductCategoryId);

    // catalog filters defaults
    setCatalogCatId((prev) => prev || firstProductCategoryId);
    setCatalogSvcCat((prev) => prev || firstSvcCat);
  }

  useEffect(() => {
    (async () => {
      try {
        await loadAll();
      } catch (e: any) {
        const m = String(e?.message || "");
        if (m.includes("401") || m.toLowerCase().includes("unauthorized")) {
          location.href = "/login";
          return;
        }
        setErr(e?.message || String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // on service category change (add drawer)
  useEffect(() => {
    if (kind !== "service") return;
    if (!services.length) return;

    const list = serviceCategory
      ? services.filter((s) => normCat(s.category) === normCat(serviceCategory))
      : services;

    const allowed = new Set(list.map((s) => String(s.id)));
    if (!allowed.has(String(serviceId))) setServiceId(list[0] ? String(list[0].id) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceCategory, services, kind]);

  // product category change (add drawer)
  useEffect(() => {
    if (kind !== "product") return;
    setProductId("");
    setNewProductName("");
    setNewProductSlug("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productCategoryId, kind]);

  async function createProduct() {
    setErr(null);

    if (!productCategoryId) {
      setErr("Сначала выбери категорию товара.");
      return;
    }
    const name = newProductName.trim();
    const slug = newProductSlug.trim();

    if (!name) {
      setErr("Введи название товара.");
      return;
    }

    setCreatingProduct(true);
    try {
      const r = await jreq(`${API}/products`, "POST", {
        name,
        slug: slug || undefined,
        category_id: Number(productCategoryId),
      });

      const created: Product | undefined = r?.item;
      if (created?.id != null) setProductId(String(created.id));

      await loadAll();
      setNewProductName("");
      setNewProductSlug("");
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setCreatingProduct(false);
    }
  }

  async function addItem() {
    setErr(null);
    try {
      if (kind === "product" && !productId) {
        setErr("Сначала создай или выбери товар.");
        return;
      }
      if (kind === "service" && !serviceId) {
        setErr("Выбери услугу.");
        return;
      }
      if (kind === "custom" && !customTitle.trim()) {
        setErr("Введи название своей позиции.");
        return;
      }

      const body: any = {
        kind,
        price_min: toNumOrNull(priceMin),
        price_max: null,
        description: newDesc ? newDesc.trim() : null,
        photos_base64: newPhotos.map((p) => p.dataUrl),
        photos_filenames: newPhotos.map((p) => p.name),
      };

      if (kind === "service") body.service_id = serviceId ? Number(serviceId) : null;
      if (kind === "product") body.product_id = productId ? Number(productId) : null;
      if (kind === "custom") body.custom_title = customTitle;

      await jreq(`${API}/company-items`, "POST", body);

      await loadAll();
      resetNewItemForm();
      setShowAdd(false);
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function saveItemPrice(it: CompanyItem, nextPriceMin: number | null) {
    setErr(null);
    setSavingId(it.id);

    setItems((prev) =>
      prev.map((x) => (x.id === it.id ? { ...x, price_min: nextPriceMin, price_max: null } : x))
    );

    try {
      await jreq(`${API}/company-items/${it.id}`, "PATCH", {
        price_min: nextPriceMin,
        price_max: null,
      });
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || String(e));
      await loadAll();
    } finally {
      setSavingId(null);
    }
  }

  async function saveItemDetails(it: CompanyItem) {
    setErr(null);
    setSavingId(it.id);
    try {
      const desc = (editDesc[it.id] ?? "").trim();
      const picked = editPhotos[it.id] || [];

      const body: any = { description: desc ? desc : null };

      if (picked.length) {
        body.photos_base64 = picked.map((p) => p.dataUrl);
        body.photos_filenames = picked.map((p) => p.name);
      }

      await jreq(`${API}/company-items/${it.id}`, "PATCH", body);

      setEditPhotos((prev) => {
        const n = { ...prev };
        delete n[it.id];
        return n;
      });

      await loadAll();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setSavingId(null);
    }
  }

  async function delItem(id: number) {
    setErr(null);
    try {
      await jreq(`${API}/company-items/${id}`, "DELETE");
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  async function logout() {
    try {
      await jreq(`${API}/auth/logout`, "POST", {});
    } catch {}
    location.href = "/login";
  }

  async function saveProfile(payloadExtra?: any) {
    setErr(null);

    const site = normalizeUrl(pSite);
    const vk = normalizeUrl(pVk);
    const tg = normalizeUrl(pTg);
    const yt = normalizeUrl(pYt);

    const urlChecks: Array<[string, string]> = [
      ["Сайт", site],
      ["VK", vk],
      ["Telegram", tg],
      ["YouTube", yt],
    ];
    for (const [label, val] of urlChecks) {
      if (val && !looksLikeUrl(val)) {
        setErr(`${label}: нужно указать ссылку вида https://...`);
        return;
      }
    }

    setSavingProfile(true);
    try {
      const body: any = {
        name: pName || null,
        phone: pPhone ? digitsOnly(pPhone) : null,
        address: pAddress || null,
        work_hours: pHours || null,
        website_url: site || null,
        vk_url: vk || null,
        tg_url: tg || null,
        youtube_url: yt || null,
        ...(payloadExtra || {}),
      };

      const r = await jreq(`${API}/company/profile`, "PATCH", body);
      const cp = r.company as CompanyProfile;
      setProfile(cp);
      setLogoPreview(absPublicUrl(cp.logo_url));

      setMe((prev) =>
        prev
          ? {
              ...prev,
              company: { ...prev.company, name: cp.name || prev.company.name },
            }
          : prev
      );
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setSavingProfile(false);
    }
  }

  async function onPickLogo(file: File | null) {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setErr("Логотип: нужен файл изображения (png/jpg/webp/svg).");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setErr("Логотип: файл слишком большой (макс 3MB).");
      return;
    }
    setErr(null);
    setLogoFileName(file.name);

    const dataUrl = await fileToDataUrl(file);
    setLogoPreview(dataUrl);
    await saveProfile({ logo_base64: dataUrl, logo_filename: file.name });
  }

  // ===== main computed =====
  const companyTitle = me?.company?.name || profile?.name || "Компания";
  const verified = me?.company?.is_verified;
  const regionName = me?.company?.region_name || "";
  const addressText = pAddress || profile?.address || "";

  const filteredItems = useMemo(() => {
    const q = itemsQuery.trim().toLowerCase();
    return (items || []).filter((it) => {
      if (itemsKindFilter !== "all" && it.kind !== itemsKindFilter) return false;
      if (!q) return true;
      const t = titleByItem(it).toLowerCase();
      const d = String(it.description || "").toLowerCase();
      return t.includes(q) || d.includes(q);
    });
  }, [items, itemsQuery, itemsKindFilter, titleByItem]);

  // ===== catalog lists =====
  const filteredCatalogProducts = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    const catId = catalogCatId ? Number(catalogCatId) : 0;

    let list = products.slice(0);

    if (catId && products.some((p) => p.category_id != null)) {
      const out = new Set<number>();
      const stack = [catId];
      while (stack.length) {
        const cur = stack.pop()!;
        if (out.has(cur)) continue;
        out.add(cur);
        const kids = catChildren.get(cur) || [];
        for (const k of kids) stack.push(k);
      }
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

  const filteredCatalogCustom = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    let list = items.filter((x) => x.kind === "custom");
    if (q) {
      list = list.filter((it) => {
        const n = String(it.custom_title || "").toLowerCase();
        const d = String(it.description || "").toLowerCase();
        return n.includes(q) || d.includes(q) || String(it.id).includes(q);
      });
    }
    list.sort((a, b) =>
      String(a.custom_title || "").localeCompare(String(b.custom_title || ""), "ru")
    );
    return list;
  }, [items, catalogQuery]);

  // ===== edit modal helpers =====
  function openEditProduct(p: Product) {
    setErr(null);
    setEditMode("product");
    setEditId(Number(p.id));
    setEName(p.name || "");
    setESlug(p.slug || "");
    setECatId(p.category_id != null ? String(p.category_id) : "");
    setESvcCat("");
    setEDesc("");
    setEPicked([]);
    setEKeepServerPhotos([]);
    setEditModalOpen(true);
  }

  function openEditService(s: Service) {
    setErr(null);
    setEditMode("service");
    setEditId(Number(s.id));
    setEName(s.name || "");
    setESlug(s.slug || "");
    setESvcCat(normCat(s.category));
    setECatId("");
    setEDesc("");
    setEPicked([]);
    setEKeepServerPhotos([]);
    setEditModalOpen(true);
  }

  function openEditCustom(it: CompanyItem) {
    setErr(null);
    setEditMode("custom");
    setEditId(it.id);
    setEName(it.custom_title || "");
    setESlug("");
    setECatId("");
    setESvcCat("");
    setEDesc(String(it.description || ""));
    setEPicked([]);
    setEKeepServerPhotos(
      (it.photos || []).map((p) => absPublicUrl(p)).filter(Boolean) as string[]
    );
    setEditModalOpen(true);
  }

  async function onPickModalPhotos(files: FileList | null) {
    if (!files || !files.length) return;
    setErr(null);

    const existing = ePicked.slice(0);
    const canAdd = Math.max(0, 5 - existing.length);
    const list = Array.from(files).slice(0, canAdd);

    if (!list.length) {
      setErr("Можно прикрепить максимум 5 фото.");
      return;
    }

    const added: PickedPhoto[] = [];
    for (const f of list) {
      if (!isAllowedImageType(f.type)) {
        setErr("Фото: поддерживаются только png/jpg/webp.");
        continue;
      }
      if (f.size > 3 * 1024 * 1024) {
        setErr("Фото: файл слишком большой (макс 3MB).");
        continue;
      }
      const dataUrl = await fileToDataUrl(f);
      added.push({ name: f.name, size: f.size, type: f.type, dataUrl });
    }

    setEPicked([...existing, ...added].slice(0, 5));
  }

  function removeModalPhoto(idx: number) {
    setEPicked((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveEditModal() {
    if (!editId) return;
    setErr(null);
    setEditSaving(true);

    try {
      if (editMode === "product") {
        const body: any = {
          name: eName.trim(),
          slug: eSlug.trim() || undefined,
          category_id: eCatId ? Number(eCatId) : null,
        };
        await jreq(`${API}/products/${editId}`, "PATCH", body);
      }

      if (editMode === "service") {
        const body: any = {
          name: eName.trim(),
          slug: eSlug.trim() || undefined,
          category: eSvcCat ? eSvcCat.trim() : null,
        };
        await jreq(`${API}/services/${editId}`, "PATCH", body);
      }

      if (editMode === "custom") {
        const body: any = {
          custom_title: eName.trim() || null,
          description: eDesc.trim() || null,
        };

        if (ePicked.length) {
          body.photos_base64 = ePicked.map((p) => p.dataUrl);
          body.photos_filenames = ePicked.map((p) => p.name);
        }

        await jreq(`${API}/company-items/${editId}`, "PATCH", body);
      }

      setEditModalOpen(false);
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setEditSaving(false);
    }
  }

  // ===== render =====
  return (
    <div className={styles.shell}>
      {/* ===== Sidebar ===== */}
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
            <div className={styles.companyName}>
              {companyTitle} {verified ? <span className={styles.verified}>✔</span> : null}
            </div>
            {regionName ? <div className={styles.companyMeta}>{regionName}</div> : null}
            {addressText ? <div className={styles.companyMeta}>{addressText}</div> : null}
          </div>

          <nav className={styles.nav}>
            <button
              type="button"
              className={`${styles.navItem} ${activeMainTab === "price" ? styles.navItemActive : ""}`}
              onClick={() => setActiveMainTab("price")}
            >
              <span className={styles.navIcon}>💰</span>
              <span className={styles.navLabel}>Прайс</span>
            </button>

            <button
              type="button"
              className={`${styles.navItem} ${activeMainTab === "catalog" ? styles.navItemActive : ""}`}
              onClick={() => setActiveMainTab("catalog")}
            >
              <span className={styles.navIcon}>🧾</span>
              <span className={styles.navLabel}>Товары и услуги</span>
            </button>

            <button
              type="button"
              className={`${styles.navItem} ${activeMainTab === "company" ? styles.navItemActive : ""}`}
              onClick={() => setActiveMainTab("company")}
            >
              <span className={styles.navIcon}>🏢</span>
              <span className={styles.navLabel}>О компании</span>
            </button>
          </nav>

          <div className={styles.sidebarBottom}>
            <div className={styles.progressTitle}>Заполненность профиля</div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: "60%" }} />
            </div>
          </div>
        </div>
      </aside>

      {/* ===== Main ===== */}
      <main className={styles.main}>
        <div className={styles.topbar}>
          <div>
            <h1 className={styles.h1}>
              {activeMainTab === "price"
                ? "Прайс"
                : activeMainTab === "catalog"
                ? "Товары и услуги"
                : "О компании"}
            </h1>
            <div className={styles.sub}>
              {me ? (
                <>
                  <b>{companyTitle}</b> · {me.company.region_name} ·{" "}
                  {verified ? "✅ проверенная" : "⏳ не проверенная"}
                </>
              ) : (
                "Загрузка…"
              )}
            </div>
          </div>

          <div className={styles.topbarActions}>
            {activeMainTab === "price" ? (
              <button className={styles.btnPrimary} onClick={() => setShowAdd(true)}>
                + Добавить позицию
              </button>
            ) : null}
            <button className={styles.btnGhost} onClick={logout}>
              Выйти
            </button>
          </div>
        </div>

        <div className={styles.content}>
          {err && <div className={styles.err}>Ошибка: {err}</div>}

          {/* ===================== COMPANY (profile) ===================== */}
          {(activeMainTab === "company" || activeMainTab === "price") && (
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.h2}>Профиль компании</h2>
                <button
                  className={styles.btnPrimary}
                  onClick={() => saveProfile()}
                  disabled={savingProfile}
                >
                  {savingProfile ? "Сохранение…" : "Сохранить"}
                </button>
              </div>

              <div className={styles.profileGrid}>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <div className={styles.label}>Название компании</div>
                  <input
                    className={styles.input}
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    placeholder="Например: ООО УСАДЬБА-ПРО"
                  />
                </div>

                <div className={styles.field}>
                  <div className={styles.label}>Телефон</div>
                  <input
                    className={styles.input}
                    value={pPhone}
                    onChange={(e) => setPPhone(formatRuPhoneMasked(e.target.value))}
                    onBlur={(e) => setPPhone(formatRuPhoneMasked(e.target.value))}
                    placeholder="+7 (___) ___-__-__"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                  <div className={styles.hint}>Формат: +7 (999) 123-45-67</div>
                </div>

                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <div className={styles.label}>Адрес</div>
                  <input
                    className={styles.input}
                    value={pAddress}
                    onChange={(e) => setPAddress(e.target.value)}
                    placeholder="Город, улица, дом"
                  />
                </div>

                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <div className={styles.label}>Время работы</div>
                  <input
                    className={styles.input}
                    value={pHours}
                    onChange={(e) => setPHours(e.target.value)}
                    onBlur={() => setPHours((v) => normDashesSpaces(v))}
                    placeholder="будни 10:00-19:00, перерыв 12:00-13:00; выходные 10:00-18:00"
                  />

                  <div className={styles.workChips}>
                    <button
                      type="button"
                      className={styles.chip}
                      onClick={() => setPHours((v) => applyWorkHoursPreset(v, "weekdays"))}
                    >
                      Будни
                    </button>
                    <button
                      type="button"
                      className={styles.chip}
                      onClick={() => setPHours((v) => applyWorkHoursPreset(v, "daily"))}
                    >
                      Ежедневно
                    </button>
                    <button
                      type="button"
                      className={styles.chip}
                      onClick={() => setPHours((v) => applyWorkHoursPreset(v, "24"))}
                    >
                      Круглосуточно
                    </button>
                    <button
                      type="button"
                      className={styles.chip}
                      onClick={() => setPHours((v) => applyWorkHoursPreset(v, "weekend"))}
                    >
                      Выходные
                    </button>
                    <button
                      type="button"
                      className={styles.chip}
                      onClick={() => setPHours((v) => applyWorkHoursPreset(v, "break"))}
                    >
                      Перерыв
                    </button>
                  </div>

                  <div className={styles.hint}>
                    Пример: <b>будни 10:00-19:00</b>, <b>перерыв 12:00-13:00</b>;{" "}
                    <b>выходные 10:00-18:00</b>
                  </div>
                </div>
              </div>

              <div className={styles.logoRow}>
                <div className={styles.logoBox}>
                  <div className={styles.label}>Логотип</div>
                  <div className={styles.logoInner}>
                    <div className={styles.logoPreview}>
                      {logoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoPreview} alt="logo" />
                      ) : (
                        <div className={styles.logoEmpty}>Нет логотипа</div>
                      )}
                    </div>

                    <div className={styles.logoActions}>
                      <label className={styles.btnGhost} style={{ cursor: "pointer" }}>
                        Загрузить
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => onPickLogo(e.target.files?.[0] || null)}
                          style={{ display: "none" }}
                        />
                      </label>
                      <div className={styles.hint}>
                        {logoFileName ? logoFileName : "png/jpg/webp/svg, до 3MB"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.note}>
                  <div className={styles.noteTitle}>Сайт и социальные сети</div>
                  <div className={styles.noteText}>
                    Вводи только ссылки вида <b>https://...</b>
                  </div>

                  {/* ВАЖНО: тут оставил input-ы, но классы были у тебя уже — соц блок теперь не ломает верстку */}
                  <div className={styles.socialList}>
                    <div>
                      <div className={styles.label}>Веб-сайт</div>
                      <input
                        className={styles.input}
                        value={pSite}
                        onChange={(e) => setPSite(e.target.value)}
                        onBlur={() => setPSite((v) => (v ? normalizeUrl(v) : ""))}
                        placeholder="https://example.ru/"
                        inputMode="url"
                      />
                    </div>

                    <div>
                      <div className={styles.label}>ВКонтакте</div>
                      <input
                        className={styles.input}
                        value={pVk}
                        onChange={(e) => setPVk(e.target.value)}
                        onBlur={() => setPVk((v) => (v ? normalizeUrl(v) : ""))}
                        placeholder="https://vk.com/..."
                        inputMode="url"
                      />
                    </div>

                    <div>
                      <div className={styles.label}>YouTube</div>
                      <input
                        className={styles.input}
                        value={pYt}
                        onChange={(e) => setPYt(e.target.value)}
                        onBlur={() => setPYt((v) => (v ? normalizeUrl(v) : ""))}
                        placeholder="https://youtube.com/..."
                        inputMode="url"
                      />
                    </div>

                    <div>
                      <div className={styles.label}>Telegram</div>
                      <input
                        className={styles.input}
                        value={pTg}
                        onChange={(e) => setPTg(e.target.value)}
                        onBlur={() => setPTg((v) => (v ? normalizeUrl(v) : ""))}
                        placeholder="https://t.me/..."
                        inputMode="url"
                      />
                    </div>
                  </div>

                  <div className={styles.hint} style={{ marginTop: 8 }}>
                    На публичной странице рендерить ссылки как{" "}
                    <code>rel="nofollow noopener noreferrer"</code>.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================== PRICE ===================== */}
          {activeMainTab === "price" && (
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.h2}>Позиции прайса</h2>
              </div>

              <div className={styles.filtersRow}>
                <div className={styles.field}>
                  <div className={styles.label}>Фильтр</div>
                  <select
                    className={styles.input}
                    value={itemsKindFilter}
                    onChange={(e) => setItemsKindFilter(e.target.value as any)}
                  >
                    <option value="all">Все</option>
                    <option value="service">Услуги</option>
                    <option value="product">Товары</option>
                    <option value="custom">Свои</option>
                  </select>
                </div>

                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <div className={styles.label}>Поиск</div>
                  <input
                    className={styles.input}
                    value={itemsQuery}
                    onChange={(e) => setItemsQuery(e.target.value)}
                    placeholder="Название или описание…"
                  />
                </div>
              </div>

              <div className={styles.listCompact}>
                {filteredItems.map((it) => {
                  const isOpen = !!openItem[it.id];
                  const serverPhotos = (it.photos || [])
                    .map((p) => absPublicUrl(p))
                    .filter(Boolean) as string[];
                  const picked = editPhotos[it.id] || [];
                  const descVal = editDesc[it.id] ?? (it.description || "");
                  const draft =
                    priceDraft[it.id] ?? (it.price_min == null ? "" : String(it.price_min));

                  return (
                    <div key={it.id} className={styles.row}>
                      <div className={styles.rowMain}>
                        <button
                          className={styles.rowExpand}
                          type="button"
                          onClick={() => setOpenItem((prev) => ({ ...prev, [it.id]: !prev[it.id] }))}
                          aria-label={isOpen ? "Свернуть" : "Развернуть"}
                          title={isOpen ? "Свернуть" : "Развернуть"}
                        >
                          {isOpen ? "▾" : "▸"}
                        </button>

                        <div className={styles.rowTitle}>
                          <div className={styles.rowTitleTop}>
                            <span className={`${styles.badge} ${styles["badge_" + it.kind]}`}>
                              {kindLabel(it.kind)}
                            </span>
                            <span className={styles.rowName}>{titleByItem(it)}</span>
                          </div>
                          <div className={styles.rowMeta}>
                            ID: {it.id}
                            {savingId === it.id ? (
                              <span className={styles.savingInline}> · сохранение…</span>
                            ) : null}
                          </div>
                        </div>

                        <div className={styles.rowPrice}>
                          <label className={styles.miniField}>
                            <span className={styles.miniLabel}>Цена от, ₽</span>
                            <input
                              className={styles.input}
                              value={draft}
                              onChange={(e) =>
                                setPriceDraft((prev) => ({ ...prev, [it.id]: e.target.value }))
                              }
                              onBlur={() => {
                                const v = toNumOrNull(priceDraft[it.id] ?? draft);
                                saveItemPrice(it, v);
                              }}
                              inputMode="decimal"
                            />
                          </label>

                          <div className={styles.miniField}>
                            <span className={styles.miniLabel}>Итого</span>
                            <div className={styles.readonlyBox}>{fmtRub(it.price_min)} ₽</div>
                          </div>
                        </div>

                        <div className={styles.rowActions}>
                          <button className={styles.btnGhost} onClick={() => delItem(it.id)}>
                            Удалить
                          </button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className={styles.rowDetails}>
                          <div className={styles.detailsHead}>
                            <div className={styles.detailsTitle}>Описание</div>
                            <button
                              className={styles.btnPrimary}
                              onClick={() => saveItemDetails(it)}
                              disabled={savingId === it.id}
                            >
                              {savingId === it.id ? "Сохранение…" : "Сохранить"}
                            </button>
                          </div>

                          <textarea
                            className={`${styles.input} ${styles.textarea}`}
                            value={descVal}
                            onChange={(e) =>
                              setEditDesc((prev) => ({ ...prev, [it.id]: e.target.value }))
                            }
                            rows={3}
                            placeholder="Добавь описание…"
                          />

                          <div className={styles.photosRow}>
                            <label className={styles.btnGhost} style={{ cursor: "pointer" }}>
                              Заменить фото (до 5)
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                multiple
                                onChange={(e) => onPickEditPhotos(it.id, e.target.files)}
                                style={{ display: "none" }}
                              />
                            </label>
                            <div className={styles.hint}>
                              Если выбрать — при сохранении заменит фото у позиции.
                            </div>
                          </div>

                          {serverPhotos.length > 0 && (
                            <>
                              <div className={styles.detailsTitle} style={{ marginTop: 10 }}>
                                Текущие фото
                              </div>
                              <div className={styles.photosGrid}>
                                {serverPhotos.slice(0, 5).map((u, i) => (
                                  <a
                                    key={i}
                                    className={`${styles.photoCard} ${styles.linkCard}`}
                                    href={u}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={u} alt={`photo-${i + 1}`} />
                                  </a>
                                ))}
                              </div>
                            </>
                          )}

                          {picked.length > 0 && (
                            <>
                              <div className={styles.detailsTitle} style={{ marginTop: 10 }}>
                                Новые фото (будут сохранены)
                              </div>
                              <div className={styles.photosGrid}>
                                {picked.map((ph, i) => (
                                  <div key={i} className={styles.photoCard}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={ph.dataUrl} alt={ph.name} />
                                    <button
                                      className={styles.photoDel}
                                      type="button"
                                      onClick={() => removeEditPhoto(it.id, i)}
                                      title="Убрать"
                                    >
                                      ×
                                    </button>
                                    <div className={styles.photoName} title={ph.name}>
                                      {ph.name}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {!filteredItems.length && (
                  <div className={styles.empty}>Пока нет позиций (или фильтр всё скрыл).</div>
                )}
              </div>
            </div>
          )}

          {/* ===================== CATALOG ===================== */}
          {activeMainTab === "catalog" && (
            <div className={styles.card}>
              <div className={styles.cardHead} style={{ alignItems: "center" }}>
                <h2 className={styles.h2} style={{ marginBottom: 0 }}>
                  Товары и услуги
                </h2>

                {/* без отдельных segment-классов — чтобы не разваливалось */}
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className={activeCatalogTab === "products" ? styles.btnPrimary : styles.btnGhost}
                    onClick={() => setActiveCatalogTab("products")}
                  >
                    Товары
                  </button>
                  <button
                    type="button"
                    className={activeCatalogTab === "services" ? styles.btnPrimary : styles.btnGhost}
                    onClick={() => setActiveCatalogTab("services")}
                  >
                    Услуги
                  </button>
                  <button
                    type="button"
                    className={activeCatalogTab === "custom" ? styles.btnPrimary : styles.btnGhost}
                    onClick={() => setActiveCatalogTab("custom")}
                  >
                    Свои
                  </button>
                </div>
              </div>

              <div className={styles.hint} style={{ marginBottom: 12 }}>
                Эти данные используются в кабинете и на карточке компании. Для кастомных позиций можно
                задавать описание и фото.
              </div>

              {/* filters row */}
              <div className={styles.filtersRow}>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <div className={styles.label}>Поиск</div>
                  <input
                    className={styles.input}
                    value={catalogQuery}
                    onChange={(e) => setCatalogQuery(e.target.value)}
                    placeholder="Название, slug, описание…"
                  />
                </div>

                {activeCatalogTab === "products" ? (
                  <div className={styles.field}>
                    <div className={styles.label}>Категория</div>
                    <select
                      className={styles.input}
                      value={catalogCatId}
                      onChange={(e) => setCatalogCatId(e.target.value)}
                    >
                      <option value="">Все</option>
                      {productCategoryOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {activeCatalogTab === "services" ? (
                  <div className={styles.field}>
                    <div className={styles.label}>Категория</div>
                    <select
                      className={styles.input}
                      value={catalogSvcCat}
                      onChange={(e) => setCatalogSvcCat(e.target.value)}
                    >
                      <option value="">Все</option>
                      {serviceCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              {/* ✅ ВСТАВИЛ ТАБЛИЦУ КАК НА ПРИМЕРЕ (table/thead/tbody) */}
              <div style={{ width: "100%", overflowX: "auto" }}>
                <table className={styles.catalogTable}>
                  <thead className={styles.catalogThead}>
                    <tr>
                      <th className={styles.catalogPhotoCell}>Фото</th>
                      <th>Название</th>
                      <th>Категория</th>
                      <th>Slug</th>
                      <th style={{ width: 180 }}>Действия</th>
                    </tr>
                  </thead>

                  <tbody className={styles.catalogTbody}>
                    {activeCatalogTab === "products" &&
                      filteredCatalogProducts.map((p) => (
                        <tr key={`p-${String(p.id)}`}>
                          <td className={styles.catalogPhotoCell}>
                            <div className={styles.catalogPhoto}>
                              <span style={{ opacity: 0.55 }}>🧱</span>
                            </div>
                          </td>
                          <td>
                            <div className={styles.catalogName}>{p.name}</div>
                            <div className={styles.catalogMeta}>ID: {String(p.id)}</div>
                          </td>
                          <td>{catNameById(p.category_id ?? null)}</td>
                          <td>
                            <div className={styles.catalogSlug}>{p.slug || "—"}</div>
                          </td>
                          <td>
                            <button className={styles.btnGhost} onClick={() => openEditProduct(p)}>
                              Редактировать
                            </button>
                          </td>
                        </tr>
                      ))}

                    {activeCatalogTab === "services" &&
                      filteredCatalogServices.map((s) => (
                        <tr key={`s-${String(s.id)}`}>
                          <td className={styles.catalogPhotoCell}>
                            <div className={styles.catalogPhoto}>
                              <span style={{ opacity: 0.55 }}>🛠️</span>
                            </div>
                          </td>
                          <td>
                            <div className={styles.catalogName}>{s.name}</div>
                            <div className={styles.catalogMeta}>ID: {String(s.id)}</div>
                          </td>
                          <td>{normCat(s.category)}</td>
                          <td>
                            <div className={styles.catalogSlug}>{s.slug || "—"}</div>
                          </td>
                          <td>
                            <button className={styles.btnGhost} onClick={() => openEditService(s)}>
                              Редактировать
                            </button>
                          </td>
                        </tr>
                      ))}

                    {activeCatalogTab === "custom" &&
                      filteredCatalogCustom.map((it) => {
                        const photo =
                          (it.photos || [])
                            .map((p) => absPublicUrl(p))
                            .filter(Boolean)?.[0] || null;

                        return (
                          <tr key={`c-${it.id}`}>
                            <td className={styles.catalogPhotoCell}>
                              <div className={styles.catalogPhoto}>
                                {photo ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={photo}
                                    alt=""
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                ) : (
                                  <span style={{ opacity: 0.55 }}>🧩</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div className={styles.catalogName}>{it.custom_title || "Своя позиция"}</div>
                              <div className={styles.catalogMeta}>ID: {it.id}</div>
                            </td>
                            <td>—</td>
                            <td>
                              <div className={styles.catalogSlug}>—</div>
                            </td>
                            <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button className={styles.btnGhost} onClick={() => openEditCustom(it)}>
                                Редактировать
                              </button>
                              <button className={styles.btnGhost} onClick={() => delItem(it.id)}>
                                Удалить
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                    {activeCatalogTab === "products" && filteredCatalogProducts.length === 0 && (
                      <tr>
                        <td colSpan={5}>
                          <div className={styles.empty}>Ничего не найдено.</div>
                        </td>
                      </tr>
                    )}

                    {activeCatalogTab === "services" && filteredCatalogServices.length === 0 && (
                      <tr>
                        <td colSpan={5}>
                          <div className={styles.empty}>Ничего не найдено.</div>
                        </td>
                      </tr>
                    )}

                    {activeCatalogTab === "custom" && filteredCatalogCustom.length === 0 && (
                      <tr>
                        <td colSpan={5}>
                          <div className={styles.empty}>Кастомных позиций пока нет.</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ===================== Drawer: Add price item ===================== */}
        {showAdd && (
          <div className={styles.drawerOverlay} role="dialog" aria-modal="true">
            <div className={styles.drawer}>
              <div className={styles.drawerHead}>
                <div>
                  <div className={styles.drawerTitle}>Добавить позицию</div>
                  <div className={styles.drawerSub}>
                    Выбери тип, заполни цену и (опционально) описание/фото.
                  </div>
                </div>
                <button className={styles.btnGhost} onClick={() => setShowAdd(false)}>
                  Закрыть
                </button>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <div className={styles.label}>Тип</div>
                  <select
                    className={styles.input}
                    value={kind}
                    onChange={(e) => setKind(e.target.value as any)}
                  >
                    <option value="service">Услуга</option>
                    <option value="product">Товар</option>
                    <option value="custom">Своя позиция</option>
                  </select>
                </div>

                {kind === "service" && (
                  <>
                    <div className={styles.field}>
                      <div className={styles.label}>Категория</div>
                      <select
                        className={styles.input}
                        value={serviceCategory}
                        onChange={(e) => setServiceCategory(e.target.value)}
                      >
                        {serviceCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={`${styles.field} ${styles.fieldWide}`}>
                      <div className={styles.label}>Услуга</div>
                      <select
                        className={styles.input}
                        value={serviceId}
                        onChange={(e) => setServiceId(e.target.value)}
                      >
                        {filteredServicesForAdd.map((s) => (
                          <option key={String(s.id)} value={String(s.id)}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {kind === "product" && (
                  <>
                    <div className={styles.field}>
                      <div className={styles.label}>Категория товара</div>
                      <select
                        className={styles.input}
                        value={productCategoryId}
                        onChange={(e) => setProductCategoryId(e.target.value)}
                      >
                        <option value="">— выбери категорию —</option>
                        {productCategoryOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={`${styles.field} ${styles.fieldWide}`}>
                      <div className={styles.label}>Название товара</div>
                      <input
                        className={styles.input}
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        placeholder="Например: Биодека 5"
                        disabled={!productCategoryId}
                      />
                      <div className={styles.hint}>
                        Сначала создай товар в выбранной категории, потом добавь его в прайс.
                      </div>
                    </div>

                    <div className={styles.field}>
                      <div className={styles.label}>Slug (необязательно)</div>
                      <input
                        className={styles.input}
                        value={newProductSlug}
                        onChange={(e) => setNewProductSlug(e.target.value)}
                        placeholder="Например: biodeka-5"
                        disabled={!productCategoryId}
                      />
                    </div>

                    <div className={styles.field}>
                      <div className={styles.label}>&nbsp;</div>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={createProduct}
                        disabled={!productCategoryId || creatingProduct}
                      >
                        {creatingProduct ? "Создание…" : "Создать товар"}
                      </button>
                    </div>

                    <div className={`${styles.field} ${styles.fieldWide}`}>
                      <div className={styles.label}>Или выбери существующий</div>
                      <select
                        className={styles.input}
                        value={productId}
                        onChange={(e) => setProductId(e.target.value)}
                        disabled={!productCategoryId}
                      >
                        <option value="">
                          {productCategoryId ? "— выбери товар —" : "— сначала выбери категорию —"}
                        </option>
                        {filteredProductsForAdd.map((p) => (
                          <option key={String(p.id)} value={String(p.id)}>
                            {p.name}
                          </option>
                        ))}
                      </select>

                      {productCategoryId && filteredProductsForAdd.length === 0 && (
                        <div className={styles.hint}>
                          В этой категории пока нет товаров. Проверь category_id у товара в БД/API.
                        </div>
                      )}
                    </div>
                  </>
                )}

                {kind === "custom" && (
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <div className={styles.label}>Название</div>
                    <input
                      className={styles.input}
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="Например: Выезд инженера"
                    />
                  </div>
                )}

                <div className={styles.field}>
                  <div className={styles.label}>Цена от, ₽</div>
                  <input
                    className={styles.input}
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    placeholder="Напр. 1500"
                    inputMode="decimal"
                  />
                </div>

                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <div className={styles.label}>Описание</div>
                  <textarea
                    className={`${styles.input} ${styles.textarea}`}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Коротко опиши услугу/товар…"
                    rows={4}
                  />
                  <div className={styles.hint}>До 5000 символов. Можно оставить пустым.</div>
                </div>

                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <div className={styles.label}>Фото (до 5)</div>

                  <div className={styles.photosRow}>
                    <label className={styles.btnGhost} style={{ cursor: "pointer" }}>
                      Прикрепить фото
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        multiple
                        onChange={(e) => onPickNewPhotos(e.target.files)}
                        style={{ display: "none" }}
                      />
                    </label>
                    <div className={styles.hint}>png/jpg/webp, до 3MB каждое</div>
                  </div>

                  {newPhotos.length > 0 && (
                    <div className={styles.photosGrid}>
                      {newPhotos.map((ph, i) => (
                        <div key={i} className={styles.photoCard}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ph.dataUrl} alt={ph.name} />
                          <button
                            className={styles.photoDel}
                            type="button"
                            onClick={() => removeNewPhoto(i)}
                            title="Убрать"
                          >
                            ×
                          </button>
                          <div className={styles.photoName} title={ph.name}>
                            {ph.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.drawerFooter}>
                <button
                  className={styles.btnGhost}
                  onClick={() => {
                    resetNewItemForm();
                    setShowAdd(false);
                  }}
                >
                  Отмена
                </button>
                <button className={styles.btnPrimary} onClick={addItem}>
                  Добавить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== Modal: Edit product/service/custom ===================== */}
        {editModalOpen && (
          <div className={styles.drawerOverlay} role="dialog" aria-modal="true">
            <div className={styles.drawer} style={{ width: "min(920px, 100%)" }}>
              <div className={styles.drawerHead}>
                <div>
                  <div className={styles.drawerTitle}>
                    {editMode === "product"
                      ? "Редактировать товар"
                      : editMode === "service"
                      ? "Редактировать услугу"
                      : "Редактировать свою позицию"}
                  </div>
                  <div className={styles.drawerSub}>
                    {editMode === "custom"
                      ? "Измените название, добавьте описание и фото."
                      : "Измените название / slug / категорию."}
                  </div>
                </div>

                <button className={styles.btnGhost} onClick={() => setEditModalOpen(false)}>
                  Закрыть
                </button>
              </div>

              <div style={{ padding: 16 }}>
                <div className={styles.formGrid}>
                  <div className={`${styles.field} ${styles.fieldWide}`}>
                    <div className={styles.label}>Название</div>
                    <input
                      className={styles.input}
                      value={eName}
                      onChange={(e) => setEName(e.target.value)}
                      placeholder="Название"
                    />
                  </div>

                  {editMode !== "custom" && (
                    <div className={styles.field}>
                      <div className={styles.label}>Категория</div>

                      {editMode === "product" ? (
                        <select
                          className={styles.input}
                          value={eCatId}
                          onChange={(e) => setECatId(e.target.value)}
                        >
                          <option value="">— выбери категорию —</option>
                          {productCategoryOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          className={styles.input}
                          value={eSvcCat}
                          onChange={(e) => setESvcCat(e.target.value)}
                        >
                          <option value="">— выбери категорию —</option>
                          {serviceCategories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {editMode !== "custom" && (
                    <div className={`${styles.field} ${styles.fieldWide}`}>
                      <div className={styles.label}>Slug (необязательно)</div>
                      <input
                        className={styles.input}
                        value={eSlug}
                        onChange={(e) => setESlug(e.target.value)}
                        placeholder="slug"
                      />
                      <div className={styles.hint}>
                        Если оставить пустым — пусть сервер сгенерирует автоматически (если поддерживается).
                      </div>
                    </div>
                  )}

                  {editMode === "custom" && (
                    <>
                      <div className={`${styles.field} ${styles.fieldWide}`}>
                        <div className={styles.label}>Описание</div>
                        <textarea
                          className={`${styles.input} ${styles.textarea}`}
                          value={eDesc}
                          onChange={(e) => setEDesc(e.target.value)}
                          placeholder="Описание товара…"
                          rows={4}
                        />
                      </div>

                      <div className={`${styles.field} ${styles.fieldWide}`}>
                        <div className={styles.label}>Фото (до 5)</div>

                        <div className={styles.photosRow}>
                          <label className={styles.btnGhost} style={{ cursor: "pointer" }}>
                            Прикрепить фото
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              multiple
                              onChange={(e) => onPickModalPhotos(e.target.files)}
                              style={{ display: "none" }}
                            />
                          </label>
                          <div className={styles.hint}>png/jpg/webp, до 3MB каждое</div>
                        </div>

                        {eKeepServerPhotos.length > 0 && (
                          <>
                            <div className={styles.detailsTitle} style={{ marginTop: 10 }}>
                              Текущие фото
                            </div>
                            <div className={styles.photosGrid}>
                              {eKeepServerPhotos.slice(0, 5).map((u, i) => (
                                <a
                                  key={i}
                                  className={`${styles.photoCard} ${styles.linkCard}`}
                                  href={u}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={u} alt={`server-${i + 1}`} />
                                </a>
                              ))}
                            </div>
                            <div className={styles.hint}>
                              Если прикрепить новые — при сохранении они заменят текущие.
                            </div>
                          </>
                        )}

                        {ePicked.length > 0 && (
                          <>
                            <div className={styles.detailsTitle} style={{ marginTop: 10 }}>
                              Новые фото (будут сохранены)
                            </div>
                            <div className={styles.photosGrid}>
                              {ePicked.map((ph, i) => (
                                <div key={i} className={styles.photoCard}>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={ph.dataUrl} alt={ph.name} />
                                  <button
                                    className={styles.photoDel}
                                    type="button"
                                    onClick={() => removeModalPhoto(i)}
                                    title="Убрать"
                                  >
                                    ×
                                  </button>
                                  <div className={styles.photoName} title={ph.name}>
                                    {ph.name}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.drawerFooter}>
                <button className={styles.btnGhost} onClick={() => setEditModalOpen(false)}>
                  Отмена
                </button>
                <button className={styles.btnPrimary} onClick={saveEditModal} disabled={editSaving}>
                  {editSaving ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
