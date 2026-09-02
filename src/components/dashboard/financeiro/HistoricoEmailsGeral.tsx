import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Mail,
  Paperclip,
  RefreshCw,
  Search,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface AnexoJson {
  filename?: string;
  label?: string;
  url?: string;
}

interface EmailRow {
  id: string;
  destinatario: string;
  cc: string | null;
  assunto: string | null;
  mensagem: string | null;
  status: string;
  erro_mensagem: string | null;
  criado_em: string;
  tipo: string | null;
  anexos: AnexoJson[] | null;
  enviado_por: string | null;
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

const formatarData = (v: string) =>
  new Date(v).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const normalizarUrlAnexo = (valor: string | undefined) => {
  if (!valor) return null;
  let url = valor.trim();
  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    if (/^https?:\/\//i.test(url)) return url;
    if (!/^https?:%2f%2f/i.test(url)) return null;
    try {
      url = decodeURIComponent(url);
    } catch {
      return null;
    }
  }
  return /^https?:\/\//i.test(url) ? url : null;
};

export function HistoricoEmailsGeral({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [autores, setAutores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [expandido, setExpandido] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("emails_enviados")
        .select("id, destinatario, cc, assunto, mensagem, status, erro_mensagem, criado_em, tipo, anexos, enviado_por")
        .order("criado_em", { ascending: false })
        .limit(200);

      const lista = (data || []) as EmailRow[];
      setRows(lista);

      const ids = Array.from(new Set(lista.map((r) => r.enviado_por).filter(Boolean))) as string[];
      if (ids.length > 0) {
        const { data: perfis } = await (supabase as any)
          .from("user_profiles")
          .select("id, full_name, display_name, email")
          .in("id", ids);
        const mapa: Record<string, string> = {};
        for (const p of perfis || []) {
          mapa[p.id] = p.display_name || p.full_name || p.email || "Usuário";
        }
        setAutores(mapa);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar, refreshKey]);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      [r.destinatario, r.cc, r.assunto, r.tipo, r.status, autores[r.enviado_por || ""]]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t)),
    );
  }, [rows, busca, autores]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por destinatário, assunto, status ou usuário..."
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading} className="shrink-0">
          {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
          Atualizar
        </Button>
      </div>

      {loading && rows.length === 0 && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando e-mails enviados...
        </div>
      )}

      {!loading && filtradas.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Nenhum e-mail encontrado.</p>
      )}

      <div className="space-y-2">
        {filtradas.map((r) => {
          const ok = r.status === "enviado";
          const aberto = expandido === r.id;
          const anexos = Array.isArray(r.anexos) ? r.anexos : [];
          return (
            <div
              key={r.id}
              className="overflow-hidden rounded-xl border border-border/60 bg-card/60 transition-colors hover:border-border"
            >
              <button
                type="button"
                onClick={() => setExpandido(aberto ? null : r.id)}
                className="flex w-full items-start gap-3 p-3 text-left"
              >
                <div
                  className={`mt-0.5 shrink-0 rounded-lg border p-2 ${
                    ok ? "border-emerald-500/25 bg-emerald-500/10" : "border-red-500/25 bg-red-500/10"
                  }`}
                >
                  {ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-medium text-foreground">{r.destinatario}</span>
                    {r.cc && (
                      <span className="truncate text-xs text-muted-foreground">cc: {r.cc}</span>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        ok
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                          : "border-red-500/30 bg-red-500/10 text-red-500"
                      }
                    >
                      {ok ? "enviado" : "erro"}
                    </Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{r.assunto || "(sem assunto)"}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/80">
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3" /> {autores[r.enviado_por || ""] || "—"}
                    </span>
                    <span>{formatarData(r.criado_em)}</span>
                    {anexos.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Paperclip className="h-3 w-3" /> {anexos.length}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronDown
                  className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`}
                />
              </button>

              {aberto && (
                <div className="space-y-3 border-t border-border/60 bg-background/40 p-3">
                  {!ok && parseErro(r.erro_mensagem) && (
                    <p className="rounded-md border border-red-500/25 bg-red-500/10 p-2 text-xs text-red-500 break-words">
                      Erro: {parseErro(r.erro_mensagem)}
                    </p>
                  )}

                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Mail className="h-3 w-3" /> Mensagem
                    </p>
                    <p className="whitespace-pre-wrap rounded-md border border-border/50 bg-card/60 p-2.5 text-sm text-foreground/90">
                      {r.mensagem || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Paperclip className="h-3 w-3" /> Anexos
                    </p>
                    {anexos.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {anexos.map((a, i) => (
                          <a
                            key={`${r.id}-anexo-${i}`}
                            href={normalizarUrlAnexo(a.url) || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs text-sky-500 hover:bg-sky-500/20"
                          >
                            <Paperclip className="h-3 w-3 shrink-0" />
                            <span className="truncate">{a.label || a.filename || `Anexo ${i + 1}`}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default HistoricoEmailsGeral;
