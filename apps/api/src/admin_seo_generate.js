// apps/api/src/admin_seo_generate.js
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function clampStr(s, maxLen) {
  const v = String(s ?? "").trim();
  if (!v) return "";
  return v.length > maxLen ? v.slice(0, maxLen).trim() : v;
}

function stripJsonFences(text) {
  // на случай если модель обернула в ```json
  return String(text ?? "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function normalizeTone(tone) {
  const t = String(tone || "neutral");
  if (t === "selling" || t === "technical" || t === "neutral") return t;
  return "neutral";
}

function normalizeMode(mode) {
  const m = String(mode || "base");
  if (m === "override" || m === "base") return m;
  return "base";
}

function buildPrompt({ entity, name, slug, mode, tone, region }) {
  const toneMap = {
    neutral: "нейтрально-деловой, без воды, без кликбейта",
    selling: "продающий, но без агрессии и без обещаний, фокус на выгодах и доверии",
    technical: "технический/экспертный, точные формулировки, без маркетинговых штампов",
  };

  const isOverride = mode === "override";
  const regionLine = isOverride && region?.name ? `Город/регион: ${region.name} (${region.slug || ""})` : "Город/регион: (не указывать)";

  // ВАЖНО: просим строго JSON.
  return `
Ты пишешь SEO для маркетплейса услуг для дома. Нужны короткие и точные формулировки.
Стиль: ${toneMap[tone]}

Сущность: ${entity}
Категория: ${name} (${slug})

${regionLine}
Режим: ${isOverride ? "override (обязательно упоминать город/регион в H1/Title/Description естественно)" : "base (НЕ упоминать город/регион вообще)"}

Требования:
- Верни СТРОГО валидный JSON (без markdown, без пояснений, без текста вокруг).
- Поля: h1, title, description, seo_text.
- title: 50–65 символов (по возможности), без кавычек, без CAPS.
- description: 140–170 символов (по возможности), 1–2 предложения.
- h1: ясный, без спецсимволов, без точек в конце.
- seo_text: HTML разрешён. Сделай 2–4 абзаца (<p>) + список (<ul><li>), общий объём 900–1500 знаков.
- Не выдумывай конкретные цены, сроки, гарантии, “№1”, “лучшие”, “официальный дилер” и т.п.
- Пиши по-русски.
`;
}

/**
 * Простейшая проверка, чтобы UI не ломался от мусора.
 */
function validateResult(obj) {
  if (!obj || typeof obj !== "object") return null;

  const h1 = clampStr(obj.h1, 140);
  const title = clampStr(obj.title, 120);
  const description = clampStr(obj.description, 220);
  let seo_text = String(obj.seo_text ?? "").trim();

  // минимальная санитария
  if (!h1 || !title || !description) return null;
  if (!seo_text) seo_text = "";

  return { h1, title, description, seo_text };
}

/**
 * Регистрирует роут /admin/seo/generate
 * @param {import("express").Express} app
 * @param {object} opts
 * @param {(req,res,next)=>any} [opts.requireAuth] - если у тебя есть middleware авторизации, передай сюда
 */
export function registerAdminSeoGenerate(app, opts = {}) {
  const requireAuth = opts.requireAuth;

  const handler = async (req, res) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
      }

      const body = req.body || {};
      const entity = String(body.entity || "service_category");
      const name = String(body.name || "").trim();
      const slug = String(body.slug || "").trim();

      const mode = normalizeMode(body.mode);
      const tone = normalizeTone(body.tone);

      const region =
        mode === "override" && body.region && typeof body.region === "object"
          ? {
              id: body.region.id ?? null,
              name: String(body.region.name || "").trim(),
              slug: String(body.region.slug || "").trim(),
            }
          : null;

      if (!name || !slug) {
        return res.status(400).json({ error: "name and slug are required" });
      }
      if (mode === "override" && (!region?.name || !region?.slug)) {
        return res.status(400).json({ error: "region.name and region.slug are required for override" });
      }

      const prompt = buildPrompt({ entity, name, slug, mode, tone, region });

      const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

      const resp = await openai.chat.completions.create({
        model,
        temperature: 0.6,
        messages: [
          { role: "system", content: "You are a careful SEO copywriter. Always obey output format constraints." },
          { role: "user", content: prompt },
        ],
      });

      const raw = resp?.choices?.[0]?.message?.content || "";
      const cleaned = stripJsonFences(raw);

      let obj = safeJsonParse(cleaned);

      // fallback: если модель вернула лишний текст — пытаемся вытащить JSON по первой/последней скобке
      if (!obj) {
        const s = cleaned;
        const i = s.indexOf("{");
        const j = s.lastIndexOf("}");
        if (i !== -1 && j !== -1 && j > i) {
          obj = safeJsonParse(s.slice(i, j + 1));
        }
      }

      const result = validateResult(obj);

      if (!result) {
        return res.status(502).json({
          error: "Model returned invalid JSON or missing fields",
          debug_preview: cleaned.slice(0, 4000),
        });
      }

      // Можно обернуть в item (как у тебя в других эндпоинтах), чтобы унифицировать
      return res.json({ item: result });
    } catch (e) {
      console.error("admin/seo/generate error:", e);
      return res.status(500).json({ error: e?.message || "Internal error" });
    }
  };

  if (requireAuth) {
    app.post("/admin/seo/generate", requireAuth, handler);
  } else {
    // если авторизация подключается иначе — оставляем без middleware, но лучше подключить
    app.post("/admin/seo/generate", handler);
  }
}
