// apps/admin/app/master/leads/page.tsx
import { headers } from "next/headers";

const API =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.moydompro.ru";

export const revalidate = 0;

type LeadItem = {
  id: number;
  company_id: number;
  company_name?: string | null;
  kind: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  message?: string | null;
  custom_title?: string | null;
  status: string;
  created_at: string;
};

async function apiGet(path: string) {
  const h = headers();
  const cookie = h.get("cookie") || "";

  const r = await fetch(`${API}${path}`, {
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`API ${r.status}: ${txt}`);
  }
  return r.json();
}

export default async function MasterLeadsPage({
  searchParams,
}: {
  searchParams?: { status?: string; company_id?: string };
}) {
  const status = String(searchParams?.status ?? "").trim();
  const companyId = String(searchParams?.company_id ?? "").trim();

  const q = new URLSearchParams();
  if (status) q.set("status", status);
  if (companyId) q.set("company_id", companyId);

  const data = await apiGet(`/admin/leads${q.toString() ? `?${q.toString()}` : ""}`);
  const items: LeadItem[] = Array.isArray(data?.items) ? data.items : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Заявки всех компаний</h1>
          <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
            {items.length} заявок
          </span>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <form className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-[0.12em]">Статус</label>
            <select
              name="status"
              defaultValue={status}
              className="mt-2 block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
            >
              <option value="">Все</option>
              <option value="new">Новые</option>
              <option value="in_work">В работе</option>
              <option value="done">Закрытые</option>
              <option value="spam">Спам</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-[0.12em]">Компания ID</label>
            <input
              name="company_id"
              defaultValue={companyId}
              placeholder="Например 42"
              className="mt-2 block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-all shadow-md shadow-gray-200 text-sm"
            >
              Применить
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">ID</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">Дата</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">Компания</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">Контакт</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">Сообщение</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.1em]">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((lead) => {
                const contact = [lead.contact_name, lead.phone, lead.email].filter(Boolean).join(" · ") || "—";
                const created = lead.created_at ? new Date(lead.created_at).toLocaleString() : "—";
                return (
                  <tr key={lead.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-400">
                      #{lead.id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{created}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{lead.company_name || `#${lead.company_id}`}</div>
                      <div className="text-xs text-gray-400">ID: {lead.company_id}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{contact}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{lead.message || lead.custom_title || "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{lead.status}</td>
                  </tr>
                );
              })}
              {!items.length ? (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-sm text-gray-500">
                    Пока заявок нет.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
