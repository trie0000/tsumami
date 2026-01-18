export function PropertyGroup({ title, compact, children }) {
  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      <div className="mb-2 text-xs font-semibold text-neutral-600">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
