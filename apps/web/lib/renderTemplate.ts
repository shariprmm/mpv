// /apps/web/lib/renderTemplate.ts
export function renderTemplate(
  tpl: string | null | undefined,
  ctx: Record<string, any>
): string {
  if (!tpl) return "";

  return tpl.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path) => {
    const parts = path.split(".");
    let cur: any = ctx;

    for (const p of parts) {
      if (cur && typeof cur === "object" && p in cur) {
        cur = cur[p];
      } else {
        return ""; // если параметра нет — подставляем пусто
      }
    }

    return cur == null ? "" : String(cur);
  });
}
