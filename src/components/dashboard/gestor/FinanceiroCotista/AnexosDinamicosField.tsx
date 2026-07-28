import React, { useCallback, useRef } from "react";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Paperclip,
  Plus,
  Trash2,
  Upload,
  FileText,
  ExternalLink,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type AnexoTipoId = "comprovante" | "recibo" | "nf" | "boleto" | "outro";

export interface AnexoLinha {
  id: string;
  tipo: AnexoTipoId;
  numero: string;
  url: string | null;
  file: File | null;
  uploading?: boolean;
}

const TIPOS: { id: AnexoTipoId; label: string }[] = [
  { id: "comprovante", label: "Comprovante" },
  { id: "recibo", label: "Recibo" },
  { id: "nf", label: "Nota Fiscal" },
  { id: "boleto", label: "Boleto" },
  { id: "outro", label: "Outro documento" },
];

export function anexoTipoLabel(id: AnexoTipoId) {
  return TIPOS.find((t) => t.id === id)?.label || id;
}

function humanSize(bytes: number) {
  if (!bytes) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

interface Props {
  anexos: AnexoLinha[];
  onChange: (next: AnexoLinha[]) => void;
  /** Prefixo de storage. Ex: "rateio-anexos/<id>" */
  storagePrefix: string;
  bucket?: string;
  className?: string;
}

/**
 * Lista dinâmica de anexos: uma linha por documento, com combobox de tipo,
 * campo de número e upload inline. Faz upload assim que o arquivo é escolhido.
 */
export default function AnexosDinamicosField({
  anexos,
  onChange,
  storagePrefix,
  bucket = "client-documents",
  className,
}: Props) {
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  const updateLinha = useCallback(
    (id: string, patch: Partial<AnexoLinha>) => {
      onChange(anexos.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    },
    [anexos, onChange]
  );

  const removeLinha = (id: string) => onChange(anexos.filter((a) => a.id !== id));

  const addLinha = () =>
    onChange([
      ...anexos,
      {
        id: crypto.randomUUID(),
        tipo: "comprovante",
        numero: "",
        url: null,
        file: null,
        uploading: false,
      },
    ]);

  const handleFile = async (id: string, file: File) => {
    updateLinha(id, { file, uploading: true });
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `${storagePrefix}/${id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      updateLinha(id, { url, uploading: false });
    } catch (e: any) {
      toast.error(`Erro no upload: ${e.message ?? e}`);
      updateLinha(id, { uploading: false, file: null });
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5 text-primary" />
          Anexos do lançamento
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addLinha}
          className="h-8 gap-1.5 rounded-lg text-xs"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar anexo
        </Button>
      </div>

      {anexos.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            Nenhum anexo. Clique em <span className="font-semibold text-foreground">Adicionar anexo</span> para incluir comprovante, recibo, NF ou boleto.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {anexos.map((a) => (
          <div
            key={a.id}
            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-3 transition-all hover:border-border hover:bg-card/60"
          >
            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto_auto] gap-2 items-center">
              {/* Tipo */}
              <SearchableCombobox
                items={TIPOS}
                value={a.tipo}
                onChange={(id) => updateLinha(a.id, { tipo: (id as AnexoTipoId) || "outro" })}
                placeholder="Tipo..."
                searchPlaceholder="Buscar tipo..."
              />

              {/* Numero */}
              <Input
                value={a.numero}
                onChange={(e) => updateLinha(a.id, { numero: e.target.value })}
                placeholder="Número / referência (opcional)"
                className="h-9 rounded-lg text-sm"
              />

              {/* Upload area */}
              <div className="flex items-center gap-2 min-w-[160px]">
                <input
                  ref={(el) => { inputsRef.current[a.id] = el; }}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(a.id, f);
                  }}
                />
                {a.uploading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...
                  </div>
                ) : a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5 text-xs font-medium text-emerald-500 hover:bg-emerald-500/20 transition-colors truncate max-w-[160px]"
                    title={a.file?.name || "Anexo"}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{a.file?.name || "Ver arquivo"}</span>
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => inputsRef.current[a.id]?.click()}
                    className="h-9 gap-1.5 rounded-lg text-xs w-full"
                  >
                    <Upload className="h-3.5 w-3.5" /> Enviar arquivo
                  </Button>
                )}
              </div>

              {/* Remove */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeLinha(a.id)}
                className="h-9 w-9 rounded-lg text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
                title="Remover linha"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {a.file && !a.uploading && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground pl-1">
                <FileText className="h-3 w-3" />
                <span className="truncate">{a.file.name}</span>
                <span>· {humanSize(a.file.size)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}