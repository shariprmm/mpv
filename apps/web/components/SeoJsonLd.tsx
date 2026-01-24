// apps/web/components/SeoJsonLd.tsx
export default function SeoJsonLd({ data }: { data: any | any[] }) {
  const arr = Array.isArray(data) ? data : [data];
  return (
    <>
      {arr
        .filter(Boolean)
        .map((obj, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }}
          />
        ))}
    </>
  );
}
