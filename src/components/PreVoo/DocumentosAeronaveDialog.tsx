import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DOC_SUBGROUPS } from "./checklistStructure";
import { ClipboardCheck, Check, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docs: Record<string, "sim" | "nao">;
  onChange: (docs: Record<string, "sim" | "nao">) => void;
  readOnly?: boolean;
}

export const TOTAL_DOCS = DOC_SUBGROUPS.reduce((acc, g) => acc + g.items.length, 0);

export function docsCompletos(docs: Record<string, "sim" | "nao">) {
  return DOC_SUBGROUPS.every((g) => g.items.every((i) => !!docs[i.id]));
}

export function DocumentosAeronaveDialog({ open, onOpenChange, docs, onChange, readOnly }: Props) {
  const set = (id: string, value: "sim" | "nao") => {
    if (readOnly) return;
    onChange({ ...docs, [id]: value });
  };

  const respondidos = Object.keys(docs).filter((k) => docs[k]).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94vh] w-[calc(100vw-1rem)] max-w-3xl flex-col overflow-hidden border-border/60 bg-card/95 p-0 backdrop-blur-xl">
        <DialogHeader className="border-b border-border/60 bg-gradient-to-r from-primary/15 to-transparent px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-primary/30 bg-primary/15 p-2.5 text-primary">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl">Documentos na aeronave</DialogTitle>
              <DialogDescription className="mt-1 text-xs sm:text-sm">
                {respondidos} de {TOTAL_DOCS} itens respondidos
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          {DOC_SUBGROUPS.map((g) => (
            <section key={g.id} className="rounded-2xl border border-border/60 bg-muted/10 p-4">
              <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">{g.title}</h3>
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{g.question}</span>
              </header>
              <ul className="space-y-2">
                {g.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-background/40 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 text-sm text-foreground">{item.label}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => set(item.id, "sim")}
                        className={cn(
                          "flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                          docs[item.id] === "sim"
                            ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-400"
                            : "border-border/60 text-muted-foreground hover:bg-accent/40",
                        )}
                      >
                        <Check className="h-3.5 w-3.5" /> Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => set(item.id, "nao")}
                        className={cn(
                          "flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                          docs[item.id] === "nao"
                            ? "border-rose-500/50 bg-rose-500/20 text-rose-400"
                            : "border-border/60 text-muted-foreground hover:bg-accent/40",
                        )}
                      >
                        <X className="h-3.5 w-3.5" /> Não
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <DialogFooter className="border-t border-border/60 bg-card/95 px-4 py-3 sm:px-6">
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            {docsCompletos(docs) ? "Concluir verificação" : "Fechar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
