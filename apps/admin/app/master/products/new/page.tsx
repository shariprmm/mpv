import Link from "next/link";
import NewProductForm from "./NewProductForm";

export const dynamic = "force-dynamic";

export default function NewProductPage() {
  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: "0 0 12px" }}>Добавить товар</h1>
        <div style={{ opacity: 0.7 }}>Создание нового товара в канонике</div>
      </div>

      <NewProductForm />

      <div style={{ marginTop: 18 }}>
        <Link href="/master/products">← Назад к списку</Link>
      </div>
    </div>
  );
}
