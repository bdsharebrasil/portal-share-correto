import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export interface EmailEnviadoRow {
  id: string;
  destinatario: string;
  cc: string | null;
  assunto: string;
  status: string;
  erro_mensagem: string | null;
  criado_em: string;
  tipo: string | null;
}

interface Props {
  referenceIds?: string[];
  referenceType?: string;
  /** Recarrega quando este valor muda (ex.: após um envio). */
  refreshKey?: number;
  className?: string;
}

const parseErro = (erro: string | null) => {
  if (!erro) return null;
  try {
    const o = JSON.parse(erro);
    return o?.details?.message || o?.message || o?.error || erro;
  } catch {
    return erro;
  }
};

export function HistoricoEmailsEnviados({ referenceIds = [], referenceType, refreshKey = 0, className }: Props) {
  const [rows, setRows] = useState<EmailEnviadoRow[]>([]);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    if (referenceIds.length === 0) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      let q = (supabase as any)
        .from("emails_enviados")
        .select("id, destinatario, cc, assunto, status, erro_mensagem, criado_em, tipo")
        .in("reference_id", referenceIds.map(String))
        .order("criado_em", { ascending: false });
      if (referenceType) q = q.eq("reference_type", referenceType);
      const { data } = await q;
      setRows((data || []) as EmailEnviadoRow[]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(referenceIds), referenceType]);

  useEffect(() => {
    carregar();
  }, [carregar, refreshKey]);

  if (referenceIds.length === 0) return null;

  return (
    <div className={`space-y-2 rounded-lg border border-border/60 p-3 ${className || ""}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-tight text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Histórico de envios
          {rows.length > 0 && <span className="text-muted-foreground/70">({rows.length})</span>}
        </p>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={carregar} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </div>

      {rows.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground">Nenhum e-mail enviado ainda para este documento.</p>
      )}

      <div className="space-y-1.5 max-h-56 overflow-y-auto">
        {rows.map((r) => {
          const ok = r.status === "enviado";
          return (
            <div
              key={r.id}
              className={`rounded-md border px-2.5 py-2 text-xs ${
                ok
                  ? "border-emerald-500/25 bg-emerald-500/10"
                  : "border-red-500/25 bg-red-500/10"
              }`}
            >
              <div className="flex items-start gap-2">
                {ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                    {ok ? "Enviado com sucesso" : "Falha no envio"} —{" "}
                    {format(new Date(r.criado_em), "dd/MM/yyyy 'às' HH:mm")}
                  </p>
                  <p className="text-muted-foreground truncate">Para: {r.destinatario}</p>
                  {r.cc && <p className="text-muted-foreground truncate">Cópia: {r.cc}</p>}
                  {r.assunto && <p className="text-muted-foreground truncate">Assunto: {r.assunto}</p>}
                  {!ok && parseErro(r.erro_mensagem) && (
                    <p className="text-red-500 mt-1 break-words">Erro: {parseErro(r.erro_mensagem)}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default HistoricoEmailsEnviados;