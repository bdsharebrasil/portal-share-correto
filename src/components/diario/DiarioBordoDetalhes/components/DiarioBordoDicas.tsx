import { Pencil, Trash2, Columns, ArrowDownUp, AlertTriangle, Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";

export function DiarioBordoDicas() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Botão de Dicas */}
      <motion.button
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/40 text-amber-400 hover:border-amber-400/60 hover:shadow-lg hover:shadow-amber-500/20 transition-all duration-300"
      >
        <span className="text-sm font-medium">DICAS !</span>
      </motion.button>

      {/* Modal de Dicas */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-xl p-6 space-y-4 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <motion.div
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    >
                      <Sparkles className="w-5 h-5 text-amber-400" />
                    </motion.div>
                    <span className="text-sm font-bold uppercase tracking-widest text-slate-300">
                      Dicas de uso · Diário de Bordo
                    </span>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                {/* Cards de dicas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Dica 01 */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="group rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-4 flex flex-col gap-3 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300"
                  >
                    <div className="flex items-center gap-2.5">
                      <motion.div
                        className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 group-hover:border-blue-400/50 transition-colors"
                        whileHover={{ rotate: 5 }}
                      >
                        <Pencil className="w-4 h-4 text-blue-400" />
                      </motion.div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
                        Dica 01
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Na coluna{" "}
                      <kbd className="inline-flex items-center justify-center bg-slate-800/80 border border-slate-600/60 rounded px-1.5 py-0.5 font-mono text-[10px] text-white mx-0.5 shadow-sm">
                        Coluna #
                      </kbd>{" "}
                      clique no número do lançamento para abrir as opções de{" "}
                      <span className="text-white font-medium">editar</span> ou{" "}
                      <span className="text-white font-medium">excluir</span> aquele registro.
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 pt-2 border-t border-slate-700/50">
                      <span className="flex items-center gap-1.5 text-[10px] text-slate-500 group-hover:text-blue-400 transition-colors">
                        <Pencil className="w-3 h-3" /> Editar
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] text-slate-500 group-hover:text-blue-400 transition-colors">
                        <Trash2 className="w-3 h-3" /> Excluir
                      </span>
                    </div>
                  </motion.div>

                  {/* Dica 02 */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="group rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-4 flex flex-col gap-3 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300"
                  >
                    <div className="flex items-center gap-2.5">
                      <motion.div
                        className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 group-hover:border-emerald-400/50 transition-colors"
                        whileHover={{ rotate: -5 }}
                      >
                        <Columns className="w-4 h-4 text-emerald-400" />
                      </motion.div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                        Dica 02
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Arraste a borda direita de qualquer{" "}
                      <span className="text-white font-medium">cabeçalho de coluna</span>{" "}
                      para redimensioná-la e visualizar melhor os dados da tabela.
                    </p>

                    <div className="flex items-center gap-1.5 mt-0.5 pt-2 border-t border-slate-700/50 relative">
                      <div className="flex items-center gap-0.5 relative">
                        <motion.div
                          className="w-6 h-3 rounded-sm bg-slate-700/80 border border-slate-600/60"
                          animate={{ width: [24, 24, 24, 24] }}
                        />
                        <motion.div
                          className="w-0.5 h-4 rounded bg-emerald-500/60 group-hover:bg-emerald-400 transition-colors cursor-col-resize"
                          animate={{
                            x: [0, 12, 12, 0],
                            backgroundColor: [
                              "rgba(16, 185, 129, 0.6)",
                              "rgba(52, 211, 153, 1)",
                              "rgba(52, 211, 153, 1)",
                              "rgba(16, 185, 129, 0.6)",
                            ],
                          }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut",
                            times: [0, 0.4, 0.6, 1],
                          }}
                        />
                        <motion.div
                          className="h-3 rounded-sm bg-slate-700/80 border border-slate-600/60"
                          animate={{
                            width: [36, 24, 24, 36],
                            x: [0, 12, 12, 0],
                          }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut",
                            times: [0, 0.4, 0.6, 1],
                          }}
                        />

                        {/* Cursor Mouse */}
                        <motion.div
                          className="absolute pointer-events-none"
                          animate={{
                            x: [20, 32, 32, 20],
                            y: [0, 0, 0, 0],
                            opacity: [0, 1, 1, 0],
                          }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut",
                            times: [0, 0.15, 0.85, 1],
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            className="drop-shadow-lg"
                          >
                            <path
                              d="M3 3L3 13L6 10L8 13.5L9.5 12.8L7.5 9.3L11 9L3 3Z"
                              fill="white"
                              stroke="black"
                              strokeWidth="0.5"
                            />
                          </svg>
                        </motion.div>

                        {/* Setas de redimensionamento no cursor */}
                        <motion.div
                          className="absolute pointer-events-none flex items-center"
                          animate={{
                            x: [20, 32, 32, 20],
                            opacity: [0, 1, 1, 0],
                          }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut",
                            times: [0, 0.15, 0.85, 1],
                          }}
                        >
                          <span className="text-[8px] text-emerald-400 font-bold drop-shadow-lg">
                            ↔
                          </span>
                        </motion.div>
                      </div>
                      <span className="text-[10px] text-slate-500 ml-1 group-hover:text-emerald-400 transition-colors">
                        arraste para redimensionar
                      </span>
                    </div>
                  </motion.div>

                  {/* Dica 03 */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="group rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-4 flex flex-col gap-3 hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/10 transition-all duration-300"
                  >
                    <div className="flex items-center gap-2.5">
                      <motion.div
                        className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-600/20 border border-violet-500/30 group-hover:border-violet-400/50 transition-colors"
                        whileHover={{ rotate: 180 }}
                        transition={{ duration: 0.3 }}
                      >
                        <ArrowDownUp className="w-4 h-4 text-violet-400" />
                      </motion.div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">
                        Dica 03
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Use os botões{" "}
                      <kbd className="inline-flex items-center bg-slate-800/80 border border-slate-600/60 rounded px-1.5 py-0.5 font-mono text-[10px] text-white mx-0.5 shadow-sm">
                        ↑ Crescente
                      </kbd>{" "}
                      e{" "}
                      <kbd className="inline-flex items-center bg-slate-800/80 border border-slate-600/60 rounded px-1.5 py-0.5 font-mono text-[10px] text-white mx-0.5 shadow-sm">
                        ↓ Decrescente
                      </kbd>{" "}
                      para alternar a{" "}
                      <span className="text-white font-medium">ordem dos registros</span> por data.
                    </p>
                  </motion.div>
                </div>

                {/* Aviso importante */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-amber-600/10 p-4 shadow-lg shadow-amber-500/5"
                >
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  </motion.div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 mb-1.5">
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
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
