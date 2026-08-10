import React, { useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
// ATENÇÃO: assume que "@/lib/tarefas-teams" exporta um catálogo completo de
// equipes (EQUIPES). Se o nome ou o formato for outro no seu projeto, ajuste
// este import — o resto do componente só depende de { id, nome, cor }.
import { EQUIPES } from "@/lib/tarefas-teams";
import { PRIORIDADES } from "@/components/tarefas/priority";
import { MultiUserCombobox } from "@/components/tarefas/MultiUserCombobox";
import { COLUMNS, type Priority, type Status, type UserOption, userName } from "@/components/tarefas/types";

const campoClasse = "campo-afundado bg-[#040216] w-full rounded-lg px-3 py-2 text-sm";

export interface NovaTarefaForm {
  titulo: string;
  descricao: string;
  atribuido_para: string[];
  prazo: string;
  prioridade: Priority;
  status: Status;
  publico: boolean;
  equipes: string[];
  progresso: number;
}

interface Props {
  aberto: boolean;
  statusInicial: Status;
  users: UserOption[];
  meId: string | null;
  /** Só gestores/admins podem escolher outros responsáveis. */
  canAssignOthers: boolean;
  onFechar: () => void;
  onCriar: (form: NovaTarefaForm) => Promise<void> | void;
}

export function ModalNovaTarefa({ aberto, statusInicial, users, meId, canAssignOthers, onFechar, onCriar }: Props) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<Priority>("media");
  const [status, setStatus] = useState<Status>(statusInicial);
  const [prazo, setPrazo] = useState("");
  const [progresso, setProgresso] = useState(0);
  const [responsaveis, setResponsaveis] = useState<string[]>([]);
  const [publico, setPublico] = useState(canAssignOthers);
  const [equipes, setEquipes] = useState<string[]>([]);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (aberto) {
      setTitulo("");
      setDescricao("");
      setPrioridade("media");
      setStatus(statusInicial);
      setPrazo("");
      setProgresso(0);
      setResponsaveis(!canAssignOthers && meId ? [meId] : []);
      setPublico(canAssignOthers);
      setEquipes([]);
      setErro("");
    }
  }, [aberto, statusInicial, canAssignOthers, meId]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  const alternar = (lista: string[], valor: string) =>
    lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];

  const salvar = () => {
    if (!titulo.trim()) {
      setErro("Informe o título da tarefa.");
      return;
    }
    const assignees = responsaveis.length > 0 ? responsaveis : meId ? [meId] : [];
    void onCriar({
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      atribuido_para: assignees,
      prazo,
      prioridade,
      status,
      publico: publico || equipes.length > 0,
      equipes,
      progresso,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onFechar} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-nova-tarefa"
        className="relative mx-[5px] my-[-3px] max-h-[120vh] w-full max-w-[619px] overflow-y-auto rounded-2xl border border-noite-600 bg-noite-850 px-[9px] py-4 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.9)]"
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 id="titulo-nova-tarefa" className="text-lg font-semibold text-noite-100">
            Nova Tarefa
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-md p-1 text-noite-400 transition hover:bg-noite-700 hover:text-noite-100"
          >
            <XIcon size={16} />
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label htmlFor="titulo" className="text-xs font-semibold text-noite-300">
              Título *
            </label>
            <input
              id="titulo"
              value={titulo}
              onChange={(e) => {
                setTitulo(e.target.value);
                setErro("");
              }}
              placeholder="Descreva a tarefa..."
              className={`mt-1 ${campoClasse}`}
            />
            {erro && <p className="mt-1 text-[11px] font-medium text-rose-400">{erro}</p>}
          </div>

          <div>
            <label htmlFor="descricao" className="text-xs font-semibold text-noite-300">
              Descrição
            </label>
            <textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Detalhes (opcional)"
              className={`mt-1 resize-none ${campoClasse} px-[15px]`}
            />
          </div>

          <fieldset>
            <legend className="text-xs font-semibold text-noite-300">Prioridade</legend>
            <div className="mt-1 flex gap-1.5">
              {(Object.keys(PRIORIDADES) as Priority[]).map((key) => {
                const p = PRIORIDADES[key];
                const Icon = p.icon;
                const ativo = prioridade === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPrioridade(key)}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg border py-1.5 text-[11px] font-semibold transition ${
                      ativo
                        ? "border-azul-500 bg-azul-500/15 text-noite-100"
                        : "border-noite-600 bg-noite-900/60 text-noite-400 hover:bg-noite-700/60"
                    }`}
                  >
                    <Icon size={12} className={p.cor} />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="prazo" className="text-xs font-semibold text-noite-300">
                Prazo
              </label>
              <input
                id="prazo"
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                className={`mt-1 ${campoClasse}`}
              />
            </div>
            <div>
              <label htmlFor="coluna" className="text-xs font-semibold text-noite-300">
                Coluna
              </label>
              <select
                id="coluna"
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className={`mt-1 ${campoClasse}`}
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {canAssignOthers ? (
            <fieldset>
              <legend className="text-xs font-semibold text-noite-300">Responsáveis</legend>
              <div className="mt-1.5">
                <MultiUserCombobox
                  items={[
                    { id: meId || "", label: "Eu mesmo" },
                    ...users.filter((u) => u.id !== meId).map((u) => ({ id: u.id, label: userName(u) })),
                  ]}
                  value={responsaveis}
                  onChange={setResponsaveis}
                />
              </div>
              {responsaveis.length > 1 && (
                <p className="mt-1 text-[10.5px] text-noite-400">
                  Mais de um responsável: cada um vai ter seu próprio andamento no board.
                </p>
              )}
            </fieldset>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-noite-600 bg-noite-900/60 px-3 py-2.5">
              <label htmlFor="share-gestor" className="cursor-pointer text-xs font-semibold text-noite-300">
                Compartilhar minha tarefa com o gestor
              </label>
              <Switch id="share-gestor" checked={publico} onCheckedChange={setPublico} />
            </div>
          )}

          <fieldset>
            <legend className="text-xs font-semibold text-noite-300">Equipes</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {EQUIPES.map((e) => {
                const ativo = equipes.includes(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setEquipes((prev) => alternar(prev, e.id))}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      ativo
                        ? "border-azul-500 bg-azul-500/15 text-noite-100"
                        : "border-noite-600 bg-noite-900/60 text-noite-400 hover:bg-noite-700/60"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: e.color }} />
                    {e.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="progresso" className="text-xs font-semibold text-noite-300">
                Progresso
              </label>
              <span className="text-xs font-semibold text-noite-100">{progresso}%</span>
            </div>
            <input
              id="progresso"
              type="range"
              min={0}
              max={100}
              step={5}
              value={progresso}
              onChange={(e) => setProgresso(Number(e.target.value))}
              className="mt-2 w-full accent-azul-500"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg border border-noite-600 bg-noite-900/60 px-4 py-2 text-sm font-medium text-noite-300 transition hover:bg-noite-700/60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            className="botao-relevo rounded-lg bg-azul-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-azul-500"
          >
            Criar Tarefa
          </button>
        </div>
      </div>
    </div>
  );
}
