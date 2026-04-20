import { Info, Pencil, Trash2, Columns, ArrowDownUp, AlertTriangle } from "lucide-react";

export function DiarioBordoDicas() {
  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-4 space-y-3">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-slate-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Dicas de uso · Diário de Bordo
        </span>
      </div>

      {/* Cards de dicas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">

        {/* Dica 01 */}
        <div className="rounded-lg border border-slate-700/40 bg-slate-900/50 p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-500/10 border border-blue-500/20">
              <Pencil className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Dica 01</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Na coluna{" "}
            <kbd className="inline-flex items-center justify-center bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 font-mono text-[10px] text-white mx-0.5">
              #
            </kbd>{" "}
            clique no número do lançamento para abrir as opções de{" "}
            <span className="text-white font-medium">editar</span> ou{" "}
            <span className="text-white font-medium">excluir</span> aquele registro.
          </p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <Pencil className="w-3 h-3" /> Editar
            </span>
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <Trash2 className="w-3 h-3" /> Excluir
            </span>
          </div>
        </div>

        {/* Dica 02 */}
        <div className="rounded-lg border border-slate-700/40 bg-slate-900/50 p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <Columns className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Dica 02</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Arraste a borda direita de qualquer{" "}
            <span className="text-white font-medium">cabeçalho de coluna</span>{" "}
            para redimensioná-la e visualizar melhor os dados da tabela.
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <div className="flex items-center gap-0.5">
              <div className="w-5 h-3 rounded-sm bg-slate-700 border border-slate-600" />
              <div className="w-0.5 h-4 rounded bg-slate-500" />
              <div className="w-8 h-3 rounded-sm bg-slate-700 border border-slate-600" />
            </div>
            <span className="text-[10px] text-slate-500 ml-1">cursor ↔ na borda</span>
          </div>
        </div>

        {/* Dica 03 */}
        <div className="rounded-lg border border-slate-700/40 bg-slate-900/50 p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-slate-700/60 border border-slate-600/40">
              <ArrowDownUp className="w-3.5 h-3.5 text-slate-300" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Dica 03</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Use os botões{" "}
            <kbd className="inline-flex items-center bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 font-mono text-[10px] text-white mx-0.5">
              ↑ Crescente
            </kbd>{" "}
            e{" "}
            <kbd className="inline-flex items-center bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 font-mono text-[10px] text-white mx-0.5">
              ↓ Decrescente
            </kbd>{" "}
            para alternar a{" "}
            <span className="text-white font-medium">ordem dos registros</span> por data.
          </p>
        </div>

      </div>

      {/* Aviso importante */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-1">
            Atenção — lançamentos conferidos
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Após a conferência do Piloto Chefe e o lançamento marcado como{" "}
            <span className="text-white font-medium">conferido</span>, não será mais possível
            editá-lo. Caso haja necessidade de correção, entre em contato com o{" "}
            <span className="text-white font-medium">Gestor</span> e solicite a liberação.
            Somente o Gestor poderá realizar modificações em lançamentos fechados.
          </p>
        </div>
      </div>

    </div>
  );
}
