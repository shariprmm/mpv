/**
 * Leads (Requests) module
 * - Public: POST /leads (create lead)
 * - Company: GET /company-leads
 * - Company: PATCH /company-leads/:id
 * - Company: POST /company/integrations (set telegram/crm webhook)
 */
export function registerLeadsRoutes(app, pool, requireAuth) {
  const normKind = (k) => {
    const t = String(k ?? "").trim().toLowerCase();
    if (["service","services","svc","услуга","услуги"].includes(t)) return "service";
    if (["product","products","товар","товары"].includes(t)) return "product";
    if (["custom","кастом","свое","своя","прочее","другое"].includes(t)) return "custom";
    return "custom";
  };

  const toNumOrNull = (v) => {
    if (v === null || v === undefined) return null;
    const t = String(v).trim();
    if (!t) return null;
    const n = Number(t.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  async function getCompanyIntegrations(companyId) {
    const r = await pool.query(
      "SELECT kind, is_enabled, config FROM company_integrations WHERE company_id=$1",
      [companyId]
    );
    const out = {};
    for (const row of r.rows) out[row.kind] = row;
    return out;
  }

  async function dispatchLead(companyId, lead) {
    try {
      const integrations = await getCompanyIntegrations(companyId);

      // --- Telegram ---
      const tg = integrations.telegram;
      if (tg?.is_enabled && tg?.config?.bot_token && tg?.config?.chat_id) {
        const text =
          `🧾 Новая заявка #${lead.id}\n` +
          `Компания: ${lead.company_id}\n` +
          `Тип: ${lead.kind}\n` +
          `${lead.kind === "service" ? `service_id: ${lead.service_id}\n` : ""}` +
          `${lead.kind === "product" ? `product_id: ${lead.product_id}\n` : ""}` +
          `${lead.kind === "custom" ? `Тема: ${lead.custom_title ?? ""}\n` : ""}` +
          `Имя: ${lead.contact_name ?? ""}\n` +
          `Тел: ${lead.phone ?? ""}\n` +
          `Email: ${lead.email ?? ""}\n` +
          `Сообщение: ${lead.message ?? ""}\n` +
          `Источник: ${lead.source}\n` +
          `Дата: ${lead.created_at}`;

        await fetch(`https://api.telegram.org/bot${tg.config.bot_token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: tg.config.chat_id, text }),
        });
      }

      // --- CRM webhook ---
      const crm = integrations.crm_webhook;
      if (crm?.is_enabled && crm?.config?.url) {
        await fetch(String(crm.config.url), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "lead_created", lead }),
        });
      }
    } catch (e) {
      // не валим создание лида из-за интеграций
      console.error("dispatchLead error:", e);
    }
  }

  // =========================
  // PUBLIC: create lead
  // =========================
  app.post("/leads", async (req, res) => {
    try {
      const b = req.body || {};

      const company_id = Number(b.company_id ?? b.companyId ?? 0);
      if (!company_id) return res.status(400).json({ ok: false, error: "bad_company_id" });

      const kind = normKind(b.kind);
      const service_id = kind === "service" ? toNumOrNull(b.service_id ?? b.serviceId) : null;
      const product_id = kind === "product" ? toNumOrNull(b.product_id ?? b.productId) : null;
      const custom_title = kind === "custom" ? String(b.custom_title ?? b.customTitle ?? b.title ?? "").trim() : null;

      const contact_name = String(b.contact_name ?? b.name ?? "").trim() || null;
      const phone = String(b.phone ?? "").trim() || null;
      const email = String(b.email ?? "").trim() || null;
      const message = String(b.message ?? b.text ?? "").trim() || null;

      if (!phone && !email) return res.status(400).json({ ok: false, error: "no_contacts" });

      const status = "new";
      const source = String(b.source ?? "web").trim() || "web";
      const meta = b.meta && typeof b.meta === "object" ? b.meta : {};

      const q = `
        INSERT INTO leads (company_id, kind, service_id, product_id, custom_title, contact_name, phone, email, message, status, source, meta)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
        RETURNING *
      `;
      const r = await pool.query(q, [
        company_id, kind, service_id, product_id, custom_title,
        contact_name, phone, email, message,
        status, source, JSON.stringify(meta),
      ]);

      const lead = r.rows[0];
      // async dispatch (не блокируем)
      dispatchLead(company_id, lead);

      return res.json({ ok: true, lead });
    } catch (e) {
      console.error("POST /leads error:", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  // =========================
  // COMPANY: list leads
  // =========================
  app.get("/company-leads", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.user?.company_id);
      if (!companyId) return res.status(401).json({ ok: false, error: "Unauthorized" });

      const status = String(req.query.status ?? "").trim();
      const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
      const offset = Math.max(0, Number(req.query.offset ?? 0));

      const where = ["company_id=$1"];
      const args = [companyId];
      if (status) {
        where.push(`status=$${args.length + 1}`);
        args.push(status);
      }

      const q = `
        SELECT *
        FROM leads
        WHERE ${where.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const r = await pool.query(q, args);

      return res.json({ ok: true, items: r.rows });
    } catch (e) {
      console.error("GET /company-leads error:", e);
      return res.status(500).json({ ok: false, error: "server_error" });
    }
  });

  // =========================
  // COMPANY: update lead status
  // =========================
  app.patch("/company-leads/:id", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.user?.company_id);
      const id = Number(req.params.id);
      if (!companyId || !id) return res.status(400).json({ ok: false, error: "bad_request" });

      const b = req.body || {};
      const status = String(b.status ?? "").trim();
      if (!["new","in_work","done","spam"].includes(status)) {
        return res.status(400).json({ ok:false, error:"bad_status" });
      }

      const r = await pool.query(
        "UPDATE leads SET status=$1 WHERE id=$2 AND company_id=$3 RETURNING *",
        [status, id, companyId]
      );
      if (!r.rowCount) return res.status(404).json({ ok:false, error:"not_found" });

      return res.json({ ok:true, lead: r.rows[0] });
    } catch (e) {
      console.error("PATCH /company-leads/:id error:", e);
      return res.status(500).json({ ok:false, error:"server_error" });
    }
  });

  // =========================
  // COMPANY: set integrations
  // =========================
  app.post("/company/integrations", requireAuth, async (req, res) => {
    try {
      const companyId = Number(req.user?.company_id);
      if (!companyId) return res.status(401).json({ ok:false, error:"Unauthorized" });

      const b = req.body || {};
      const kind = String(b.kind ?? "").trim(); // telegram | crm_webhook
      if (!["telegram","crm_webhook"].includes(kind)) {
        return res.status(400).json({ ok:false, error:"bad_kind" });
      }

      const is_enabled = b.is_enabled === undefined ? true : !!b.is_enabled;
      const config = b.config && typeof b.config === "object" ? b.config : {};

      const r = await pool.query(
        `INSERT INTO company_integrations(company_id, kind, is_enabled, config)
         VALUES ($1,$2,$3,$4::jsonb)
         ON CONFLICT (company_id, kind)
         DO UPDATE SET is_enabled=EXCLUDED.is_enabled, config=EXCLUDED.config
         RETURNING *`,
        [companyId, kind, is_enabled, JSON.stringify(config)]
      );

      return res.json({ ok:true, integration: r.rows[0] });
    } catch (e) {
      console.error("POST /company/integrations error:", e);
      return res.status(500).json({ ok:false, error:"server_error" });
    }
  });
}
