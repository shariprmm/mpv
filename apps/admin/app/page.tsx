export default function Admin() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>MPV Admin</h1>
      <p style={{ color: "#444", marginBottom: 24 }}>
        Концепция админок разделена на два уровня доступа.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        <section
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Master</h2>
          <p style={{ color: "#555", marginBottom: 12 }}>
            Доступ только для владельца (superadmin). Управление мастер-данными,
            каталогом и контентом.
          </p>
          <a href="/master" style={{ color: "#0b57d0", fontWeight: 600 }}>
            Перейти в Master
          </a>
        </section>

        <section
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            padding: 16,
            background: "#fff",
          }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Кабинет компании</h2>
          <p style={{ color: "#555", marginBottom: 12 }}>
            Доступ для зарегистрированных компаний: прайс, товары, услуги и профиль.
          </p>
          <a href="/price" style={{ color: "#0b57d0", fontWeight: 600 }}>
            Перейти в кабинет
          </a>
        </section>
      </div>
    </main>
  );
}
