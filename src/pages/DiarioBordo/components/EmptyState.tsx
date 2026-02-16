// components/EmptyState.tsx
export function EmptyState() {
  return (
    <div className="flex items-center justify-center h-96 bg-slate-900 rounded-[2rem] border border-slate-800">
      <p className="text-slate-500">Nenhuma aeronave encontrada</p>
    </div>
  );
}