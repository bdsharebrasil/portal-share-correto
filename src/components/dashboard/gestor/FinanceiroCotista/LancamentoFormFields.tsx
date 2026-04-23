import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, AlertTriangle, Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";

export type GrupoCusto = "FIXO" | "VARIAVEL" | "EXTRA";
export const GRUPOS: { value: GrupoCusto; label: string; hint: string }[] = [
  { value: "FIXO", label: "Custo Fixo", hint: "Hangaragem, ADM, seguros" },
  { value: "VARIAVEL", label: "Custo Variável", hint: "Combustível, manutenção/hora, taxas" },
  { value: "EXTRA", label: "Custo Extra", hint: "Pontuais, corretivas, eventos" },
];

export type Socio = {
  id: string;
  nome: string;
  cpf: string | null;
  percentual_participacao: number | null;
};

export type RateioInput = {
  socio_id: string;
  socio_nome: string;
  socio_cpf: string | null;
  percentual: number;
  valor_pago_real: number;
};

export type LancamentoState = {
  descricao: string;
  tipo: "despesa" | "receita";
  grupo: GrupoCusto;
  valor: string;
  data: string;
  pagador: string; // "EMPRESA" | "CLIENTE_ATUAL" | socio.id | cotistaCliente.id
  status: "pago" | "pendente";
  observacoes: string;
  rateios: RateioInput[];
  reembolsavel: boolean;
  anexoUrl: string;
  numeroDocumento: string;
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

interface CotistaVinculado {
  id: string;
  razao_social: string;
  percentual: number;
}

interface LancamentoFormFieldsProps {
  state: LancamentoState;
  setState: React.Dispatch<React.SetStateAction<LancamentoState>>;
  socios: Socio[];
  clienteId: string;
  clienteNome?: string;
  aeronaveId: string | null;
}

export function LancamentoFormFields({
  state,
  setState,
  socios,
  clienteId,
  clienteNome,
  aeronaveId,
}: LancamentoFormFieldsProps) {
  const [uploading, setUploading] = useState(false);

  // Buscar outros cotistas vinculados à mesma aeronave (excluindo o atual)
  const { data: outrosCotistas = [] } = useQuery<CotistaVinculado[]>({
    queryKey: ["outros-cotistas-aeronave", aeronaveId, clienteId],
    enabled: !!aeronaveId && !!clienteId,
    queryFn: async () => {
      const { data: vinculos, error } = await (supabase as any)
        .from("cotistas_aeronave")
        .select("id_clientes, percentual_sociedade")
        .eq("id_aeronave", aeronaveId)
        .neq("id_clientes", clienteId);
      if (error) throw error;
      const ids = (vinculos ?? []).map((v: any) => v.id_clientes).filter(Boolean);
      if (!ids.length) return [];
      const { data: clis } = await (supabase as any)
        .from("clientes")
        .select("id, razao_social, proprietario")
        .in("id", ids);
      return (clis ?? []).map((c: any) => {
        const v = (vinculos ?? []).find((x: any) => x.id_clientes === c.id);
        return {
          id: c.id,
          razao_social: c.razao_social || c.proprietario || "Cotista",
          percentual: Number(v?.percentual_sociedade) || 0,
        };
      });
    },
  });

  const valorNum = Number(state.valor.replace(",", ".")) || 0;
  const somaPct = useMemo(
    () => state.rateios.reduce((s, r) => s + (Number(r.percentual) || 0), 0),
    [state.rateios]
  );
  const somaPago = useMemo(
    () => state.rateios.reduce((s, r) => s + (Number(r.valor_pago_real) || 0), 0),
    [state.rateios]
  );
  const pctOk = Math.abs(somaPct - 100) < 0.01;
  const algumNeg = state.rateios.some((r) => Number(r.percentual) < 0);
  const pagoExcede = somaPago > valorNum + 0.01;

  // ajusta valor_pago_real conforme pagador (apenas para sócios — cotista cliente / empresa não geram rateio)
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      rateios: prev.rateios.map((r) => ({
        ...r,
        valor_pago_real:
          state.pagador === r.socio_id
            ? valorNum
            : state.pagador === "EMPRESA" || state.pagador === "CLIENTE_ATUAL" || isOutroCotista(state.pagador)
            ? 0
            : r.valor_pago_real,
      })),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pagador, state.valor]);

  function isOutroCotista(id: string) {
    return outrosCotistas.some((c) => c.id === id);
  }

  function setPct(idx: number, v: string) {
    const n = Number(v.replace(",", ".")) || 0;
    setState((prev) => ({
      ...prev,
      rateios: prev.rateios.map((r, i) => (i === idx ? { ...r, percentual: n } : r)),
    }));
  }
  function setPago(idx: number, v: string) {
    const n = Number(v.replace(",", ".")) || 0;
    setState((prev) => ({
      ...prev,
      rateios: prev.rateios.map((r, i) => (i === idx ? { ...r, valor_pago_real: n } : r)),
    }));
  }
  function distribuirIgualmente() {
    if (!state.rateios.length) return;
    const p = +(100 / state.rateios.length).toFixed(2);
    setState((prev) => ({
      ...prev,
      rateios: prev.rateios.map((r) => ({ ...r, percentual: p })),
    }));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 20MB)");
      return;
    }
    setUploading(true);
    try {
      const ts = Date.now();
      const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_").substring(0, 80);
      const path = `lancamento_${clienteId}_${ts}_${safe}`;
      const { error } = await supabase.storage
        .from("nfs-share-recebidas")
        .upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("nfs-share-recebidas").getPublicUrl(path);
      setState((prev) => ({ ...prev, anexoUrl: data.publicUrl }));
      toast.success("Anexo enviado");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Linha 1: Tipo + Descrição */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label>Tipo *</Label>
          <Select
            value={state.tipo}
            onValueChange={(v) => setState((p) => ({ ...p, tipo: v as any }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="despesa">Despesa</SelectItem>
              <SelectItem value="receita">Receita</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Descrição *</Label>
          <Input
            value={state.descricao}
            onChange={(e) => setState((p) => ({ ...p, descricao: e.target.value }))}
            placeholder="Ex.: Hangaragem outubro"
          />
        </div>
      </div>

      {/* Linha 2: grupo, data, valor */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label>Grupo de custo</Label>
          <Select
            value={state.grupo}
            onValueChange={(v) => setState((p) => ({ ...p, grupo: v as GrupoCusto }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRUPOS.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  <div>
                    <div className="font-medium">{g.label}</div>
                    <div className="text-xs text-muted-foreground">{g.hint}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Data competência *</Label>
          <Input
            type="date"
            value={state.data}
            onChange={(e) => setState((p) => ({ ...p, data: e.target.value }))}
          />
        </div>
        <div>
          <Label>Valor total (R$) *</Label>
          <Input
            type="number"
            step="0.01"
            value={state.valor}
            onChange={(e) => setState((p) => ({ ...p, valor: e.target.value }))}
            placeholder="0,00"
          />
        </div>
      </div>

      {/* Linha 3: pagador, status, doc */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label>Pagador *</Label>
          <Select
            value={state.pagador}
            onValueChange={(v) => setState((p) => ({ ...p, pagador: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EMPRESA">Empresa (Share Brasil)</SelectItem>
              <SelectItem value="CLIENTE_ATUAL">
                {clienteNome ? `Cliente: ${clienteNome}` : "Próprio cliente"}
              </SelectItem>
              {outrosCotistas.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Outros cotistas da aeronave
                  </div>
                  {outrosCotistas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.razao_social} ({c.percentual}%)
                    </SelectItem>
                  ))}
                </>
              )}
              {socios.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Sócios do cliente
                  </div>
                  {socios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status *</Label>
          <Select
            value={state.status}
            onValueChange={(v) => setState((p) => ({ ...p, status: v as any }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Nº Documento</Label>
          <Input
            value={state.numeroDocumento}
            onChange={(e) => setState((p) => ({ ...p, numeroDocumento: e.target.value }))}
            placeholder="NF, recibo, boleto..."
          />
        </div>
      </div>

      {/* Reembolsável + Anexo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/30">
          <div>
            <Label className="cursor-pointer">Reembolsável</Label>
            <p className="text-xs text-muted-foreground">
              Marque se este lançamento gera reembolso ao pagador.
            </p>
          </div>
          <Switch
            checked={state.reembolsavel}
            onCheckedChange={(v) => setState((p) => ({ ...p, reembolsavel: v }))}
          />
        </div>

        <div>
          <Label>Anexo (PDF / imagem)</Label>
          {state.anexoUrl ? (
            <div className="flex items-center gap-2 p-2.5 bg-muted rounded-xl border border-border/50">
              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
              <a
                href={state.anexoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex-1 truncate"
              >
                Ver anexo
              </a>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setState((p) => ({ ...p, anexoUrl: "" }))}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
                id="lancamento-upload"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("lancamento-upload")?.click()}
                disabled={uploading}
                className="w-full gap-2 h-10 rounded-xl border-dashed"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {uploading ? "Enviando..." : "Anexar arquivo"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Observações */}
      <div>
        <Label>Observações</Label>
        <Textarea
          value={state.observacoes}
          onChange={(e) => setState((p) => ({ ...p, observacoes: e.target.value }))}
          rows={2}
        />
      </div>

      {/* Rateio por sócio */}
      {socios.length > 0 && (
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-semibold text-sm">Rateio por sócio</h3>
              <p className="text-xs text-muted-foreground">
                Defina o % de cada sócio. A soma deve ser 100%.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={distribuirIgualmente}
            >
              Dividir igualmente
            </Button>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground px-2">
              <div className="col-span-5">Sócio</div>
              <div className="col-span-2 text-right">% Rateio</div>
              <div className="col-span-2 text-right">Devido</div>
              <div className="col-span-3 text-right">Pago real (R$)</div>
            </div>
            {state.rateios.map((r, idx) => {
              const devido = +((valorNum * r.percentual) / 100).toFixed(2);
              return (
                <div
                  key={r.socio_id}
                  className="grid grid-cols-12 gap-2 items-center bg-muted/30 rounded p-2"
                >
                  <div className="col-span-5 text-sm font-medium truncate">
                    {r.socio_nome}
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={r.percentual}
                      onChange={(e) => setPct(idx, e.target.value)}
                      className="h-8 text-right"
                    />
                  </div>
                  <div className="col-span-2 text-right text-sm tabular-nums">
                    {fmtBRL(devido)}
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      step="0.01"
                      value={r.valor_pago_real}
                      onChange={(e) => setPago(idx, e.target.value)}
                      className="h-8 text-right"
                    />
                  </div>
                </div>
              );
            })}

            <div
              className={`flex items-center justify-between mt-3 p-3 rounded-lg border text-sm ${
                pctOk
                  ? "bg-success/10 border-success/30 text-success"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-500"
              }`}
            >
              <div className="flex items-center gap-2">
                {pctOk ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <span>
                  Soma dos percentuais: <strong>{somaPct.toFixed(2)}%</strong>
                  {!pctOk && ` — falta ${(100 - somaPct).toFixed(2)}%`}
                </span>
              </div>
              <div className="text-xs">
                Total pago: <strong>{fmtBRL(somaPago)}</strong> / {fmtBRL(valorNum)}
                {pagoExcede && <span className="ml-2 text-destructive">excede!</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function validateLancamento(state: LancamentoState): string | null {
  const valorNum = Number(state.valor.replace(",", ".")) || 0;
  const somaPct = state.rateios.reduce((s, r) => s + (Number(r.percentual) || 0), 0);
  const somaPago = state.rateios.reduce((s, r) => s + (Number(r.valor_pago_real) || 0), 0);
  const pctOk = Math.abs(somaPct - 100) < 0.01;
  const algumNeg = state.rateios.some((r) => Number(r.percentual) < 0);
  const pagoExcede = somaPago > valorNum + 0.01;

  if (!state.descricao.trim()) return "Informe a descrição";
  if (valorNum <= 0) return "Valor deve ser maior que zero";
  if (state.rateios.length && algumNeg) return "Percentuais negativos não são permitidos";
  if (state.rateios.length && !pctOk)
    return `Soma dos percentuais é ${somaPct.toFixed(2)}% (deve ser 100%)`;
  if (pagoExcede) return "Soma dos valores pagos excede o valor total";
  return null;
}
