export default function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      {children}
    </div>
  );
}
