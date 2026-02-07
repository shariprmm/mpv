import crypto from "node:crypto";

const MAX_EXCERPT_LEN = 380;
const MIN_EXCERPT_LEN = 300;

function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(html) {
  return normalizeWhitespace(String(html || "").replace(/<[^>]*>/g, " "));
}

function stripMarkdown(md) {
  const cleaned = String(md || "")
    .replace(/`{1,3}[^`]*`{1,3}/g, " ")
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^\)]*\)/g, " ")
    .replace(/[*_~>#-]/g, " ")
    .replace(/\s+/g, " ");
  return normalizeWhitespace(cleaned);
}

function buildExcerpt(post) {
  const explicit = normalizeWhitespace(post?.excerpt || "");
  if (explicit) return explicit;

  const fromHtml = stripHtml(post?.content_html || "");
  const fromMd = stripMarkdown(post?.content_md || "");
  const source = fromHtml || fromMd;
  if (!source) return "";

  if (source.length <= MAX_EXCERPT_LEN) return source;
  const slice = source.slice(0, MAX_EXCERPT_LEN);
  const trimmed = slice.replace(/\s+\S*$/, "").trim();
  const base = trimmed.length >= MIN_EXCERPT_LEN ? trimmed : slice.trim();
  return `${base}…`;
}

export function buildTelegramText(post, { siteUrl }) {
  const title = normalizeWhitespace(post?.title || "");
  const excerpt = buildExcerpt(post);
  const baseUrl = String(siteUrl || "").replace(/\/+$/, "");
  const url = `${baseUrl}/journal/${post?.slug || ""}`;

  return `🛠 <b>${title}</b>\n\n${excerpt}\n\n👉 <a href="${url}">Читать полностью</a>`;
}

function ensureAbsoluteUrl(url, siteUrl) {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const baseUrl = String(siteUrl || "").replace(/\/+$/, "");
  return `${baseUrl}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

async function sendTelegramRequest({ token, method, payload }) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const description = data?.description || res.statusText || "telegram_error";
    return { ok: false, error: description };
  }
  return { ok: true, message_id: data.result?.message_id };
}

export async function sendToTelegram({ chatId, text, imageUrl, token, siteUrl }) {
  if (!token) {
    return { ok: false, error: "missing_tg_token" };
  }
  const safeChat = String(chatId || "").trim();
  if (!safeChat) {
    return { ok: false, error: "missing_tg_chat" };
  }

  try {
    if (imageUrl) {
      const photo = ensureAbsoluteUrl(imageUrl, siteUrl);
      const result = await sendTelegramRequest({
        token,
        method: "sendPhoto",
        payload: {
          chat_id: safeChat,
          photo,
          caption: text,
          parse_mode: "HTML",
        },
      });
      return result;
    }

    return await sendTelegramRequest({
      token,
      method: "sendMessage",
      payload: {
        chat_id: safeChat,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      },
    });
  } catch (err) {
    const id = crypto.randomUUID();
    console.error("TG_SEND_ERROR", id, err);
    return { ok: false, error: `telegram_failed:${id}` };
  }
}

export function resolveTelegramChat(inputChatId, defaultChatId) {
  const trimmed = String(inputChatId || "").trim();
  if (trimmed) return trimmed;
  return String(defaultChatId || "").trim();
}

export function resolveCoverUrl(post, siteUrl) {
  return ensureAbsoluteUrl(post?.cover_image, siteUrl);
}
