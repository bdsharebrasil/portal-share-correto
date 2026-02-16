import { BookOpen } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="p-4 bg-slate-800/50 rounded-lg mb-4">
        <BookOpen className="w-12 h-12 text-slate-500" />
      </div>
      <h3 className="text-lg font-semibold text-slate-200 mb-2">
        Nenhuma aeronave cadastrada
      </h3>
      <p className="text-slate-400 text-sm text-center max-w-sm">
        Cadastre uma aeronave para começar a registrar seus voos no diário de bordo.
      </p>
    </div>
  );
}
