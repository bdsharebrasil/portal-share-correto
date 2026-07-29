import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import EditCaixaClienteModal from "./EditCaixaClienteModal";
import EditCaixaShareModal from "./EditCaixaShareModal";

interface Props {
  movId: string;
  onClose: () => void;
  onSaved: (movPatch: any, rateioPatch?: any) => void;
}

/**
 * Dispatcher: carrega a movimentação e delega para o editor correto
 * conforme `tipo_caixa` (share ou cliente).
 */
export default function EditLancamentoModal({ movId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [mov, setMov] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("movimentacoes").select("*").eq("id", movId).maybeSingle();
      if (error) setErr(error.message);
      setMov(data || null);
      setLoading(false);
    })();
  }, [movId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-slate-300"><Loader2 className="h-4 w-4 animate-spin" /> Carregando lançamento...</div>
      </div>
    );
  }

  if (err || !mov) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80" onClick={onClose}>
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err || "Lançamento não encontrado"}</div>
      </div>
    );
  }

  const tipo = (mov.tipo_caixa || "").toLowerCase();
  if (tipo === "share") {
    return <EditCaixaShareModal movId={movId} mov={mov} onClose={onClose} onSaved={(p) => onSaved(p)} />;
  }
  return <EditCaixaClienteModal movId={movId} mov={mov} onClose={onClose} onSaved={(p) => onSaved(p)} />;
}
