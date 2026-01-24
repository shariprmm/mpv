import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import express from "express";

export function makeAuthRouter({ pool }) {
  const r = express.Router();

  const COOKIE_NAME = "mdp_sess";

  function setSessionCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain: ".moydompro.ru",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
  }

  async function auth(req, res, next) {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: "Not authorized" });

    const { rows } = await pool.query(
      `SELECT s.token, s.expires_at, u.id as user_id, u.company_id, u.email, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = $1
       LIMIT 1`,
      [token]
    );

    const s = rows[0];
    if (!s) return res.status(401).json({ error: "Session not found" });
    if (new Date(s.expires_at).getTime() < Date.now()) {
      await pool.query("DELETE FROM sessions WHERE token=$1", [token]);
      return res.status(401).json({ error: "Session expired" });
    }

    req.user = { id: s.user_id, company_id: s.company_id, email: s.email, role: s.role };
    next();
  }

  r.post("/register-company", async (req, res) => {
    const { companyName, email, password, phone, inn } = req.body || {};
    if (!companyName || !email || !password) {
      return res.status(400).json({ error: "companyName, email, password are required" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 chars" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existing = await client.query("SELECT id FROM users WHERE email=$1 LIMIT 1", [email]);
      if (existing.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "User with this email already exists" });
      }

      const slug =
        String(companyName)
          .toLowerCase()
          .replace(/[^a-z0-9а-яё]+/gi, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 64) || null;

      const c1 = await client.query(
        `INSERT INTO companies(name, slug, phone, inn)
         VALUES ($1,$2,$3,$4)
         RETURNING id, name, slug`,
        [companyName, slug, phone || null, inn || null]
      );

      const password_hash = await bcrypt.hash(String(password), 10);

      const u1 = await client.query(
        `INSERT INTO users(company_id, email, password_hash, role)
         VALUES ($1,$2,$3,'owner')
         RETURNING id, email, role, company_id`,
        [c1.rows[0].id, email, password_hash]
      );

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

      await client.query(
        `INSERT INTO sessions(user_id, token, expires_at) VALUES ($1,$2,$3)`,
        [u1.rows[0].id, token, expiresAt]
      );

      await client.query("COMMIT");
      setSessionCookie(res, token);

      res.json({ ok: true, user: u1.rows[0], company: c1.rows[0] });
    } catch (e) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: "Register failed", details: String(e?.message || e) });
    } finally {
      client.release();
    }
  });

  r.post("/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email, password required" });

    const { rows } = await pool.query(
      `SELECT id, email, password_hash, role, company_id FROM users WHERE email=$1 LIMIT 1`,
      [email]
    );

    const u = rows[0];
    if (!u) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(String(password), u.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    await pool.query(`INSERT INTO sessions(user_id, token, expires_at) VALUES ($1,$2,$3)`, [
      u.id,
      token,
      expiresAt,
    ]);

    setSessionCookie(res, token);
    res.json({ ok: true });
  });

  r.post("/logout", auth, async (req, res) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) await pool.query("DELETE FROM sessions WHERE token=$1", [token]);
    res.clearCookie(COOKIE_NAME, { path: "/", domain: ".moydompro.ru" });
    res.json({ ok: true });
  });

  r.get("/me", auth, async (req, res) => {
    const { rows } = await pool.query(
      "SELECT id, name, slug FROM companies WHERE id=$1 LIMIT 1",
      [req.user.company_id]
    );
    res.json({ ok: true, user: req.user, company: rows[0] || null });
  });

  return r;
}
