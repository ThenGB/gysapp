export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="content-shell">
      <h1 className="section-title">{title}</h1>
      <p>Fase design system dan shell selesai; fitur {title} menyusul di fase berikutnya.</p>
    </div>
  );
}
