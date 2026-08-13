import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import AnexosDinamicosField, { type AnexoLinha } from "@/components/dashboard/gestor/FinanceiroCotista/AnexosDinamicosField";
import { supabase } from "@/integrations/supabase/client";
import { useClientesCombo } from "@/hooks/useClientesCombo";
import { useAerodromes } from "@/hooks/useAerodromes";
import { useFuelSuppliers } from "@/hooks/useFuelSuppliers";
import { useVooPorNumero } from "@/hooks/useVooPorNumero";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Fuel, Loader2, Users, Plane, CalendarDays, MapPin, Upload, X, Info,
  CheckCircle2, CreditCard, Building2, FileText, Hash,
} from "lucide-react";

const db = supabase as any;

const TIPOS_COMBUSTIVEL = [
  { id: "AVGAS", label: "AVGAS" },
  { id: "JET A1", label: "JET A1" },
];

const TIPOS_FATURAMENTO = [
  { id: "BOLETO", label: "BOLETO" },
  { id: "NOTA FISCAL FATURADO", label: "NOTA FISCAL FATURADO" },
  { id: "NOTA FISCAL A VISTA", label: "NOTA FISCAL A VISTA" },
  { id: "FATURADO RECIBO", label: "FATURADO RECIBO" },
  { id: "PIX", label: "PIX" },
  { id: "CARTAO", label: "CARTÃO" },
  { id: "OUTRO", label: "OUTRO" },
];

const FATURADOS = ["BOLETO", "NOTA FISCAL FATURADO", "FATURADO RECIBO"];
const A_VISTA = ["NOTA FISCAL A VISTA", "PIX", "CARTAO"];

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultClienteId?: string | null;
  defaultAeronaveId?: string | null;
  defaultData?: string;
  defaultNumeroVoo?: string | null;
  onSaved: (abastecimentoId: string) => void;
}

export function AbastecimentoPreVooDialog({
  open,
  onOpenChange,
  defaultClienteId,
  defaultAeronaveId,
  defaultData,
  defaultNumeroVoo,
  onSaved,
}: Props) {
  const { clientes } = useClientesCombo();
  const { aerodromes } = useAerodromes();
  const { data: fornecedores = [] } = useFuelSuppliers();
  const { data: vooInfo } = useVooPorNumero(defaultNumeroVoo);

  const [clienteId, setClienteId] = useState(defaultClienteId || "");
  const [socioNome, setSocioNome] = useState("");
  const [aeronaveId, setAeronaveId] = useState(defaultAeronaveId || "");
  const [data, setData] = useState(defaultData || new Date().toISOString().split("T")[0]);
  const [trechoOrigem, setTrechoOrigem] = useState("");
  const [trechoDestino, setTrechoDestino] = useState("");
  const [local, setLocal] = useState("");
  const [tipoCombustivel, setTipoCombustivel] = useState("");
  const [abastecedorId, setAbastecedorId] = useState("");
  const [abastecedor, setAbastecedor] = useState("");
  const [valorUnitario, setValorUnitario] = useState("");
  const [litros, setLitros] = useState("");
  const [comanda, setComanda] = useState("");
  const [comandaUrl, setComandaUrl] = useState<string | null>(null);
  const [uploadingComanda, setUploadingComanda] = useState(false);
  const [tipoFaturamento, setTipoFaturamento] = useState("");
  const [prazo, setPrazo] = useState("");
  const [dataPagamento, setDataPagamento] = useState("");
  const [pagoPor, setPagoPor] = useState("SHARE BRASIL");
  const [observacao, setObservacao] = useState("");
  const [anexos, setAnexos] = useState<AnexoLinha[]>([]);
  const [avisoFechado, setAvisoFechado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Ao abrir, cliente/aeronave/trecho vêm do voo (fonte única de verdade) quando
  // há um numero_voo em contexto (vindo do checklist); os defaults soltos
  // continuam funcionando como fallback caso o voo ainda não tenha sido
  // encontrado ou o dialog seja aberto sem numero_voo.
  useEffect(() => {
    if (!open) return;
    setClienteId(vooInfo?.cliente_id || defaultClienteId || "");
    setAeronaveId(vooInfo?.aeronave_id || defaultAeronaveId || "");
    if (vooInfo?.origem) setTrechoOrigem(vooInfo.origem);
    if (vooInfo?.destino) setTrechoDestino(vooInfo.destino);
    setData(vooInfo?.data_agendada || defaultData || new Date().toISOString().split("T")[0]);
    setAvisoFechado(false);
  }, [open, defaultClienteId, defaultAeronaveId, defaultData, vooInfo]);

  const { data: aeronaves = [] } = useQuery({
    queryKey: ["abast-aeronaves"],
    queryFn: async () => {
      const { data, error } = await db
        .from("aeronave")
        .select("id, matricula, modelo")
        .order("matricula");
      if (error) throw error;
      return (data || []) as { id: string; matricula: string; modelo: string | null }[];
    },
  });

  const { data: socios = [] } = useQuery({
    queryKey: ["abast-socios", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await db
        .from("socios")
        .select("id, nome")
        .eq("clientes_id", clienteId)
        .order("nome");
      if (error) throw error;
      return (data || []) as { id: string; nome: string }[];
    },
  });

  // Cotistas da aeronave selecionada (para pago_por e para saber se é voo emprestado)
  const { data: cotistas = [] } = useQuery({
    queryKey: ["abast-cotistas", aeronaveId],
    enabled: !!aeronaveId,
    queryFn: async () => {
      const { data, error } = await db
        .from("cotistas_aeronave")
        .select("id, id_clientes, clientes:id_clientes(razao_social)")
        .eq("id_aeronave", aeronaveId);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Último lançamento no diário de bordo da aeronave
  const { data: ultimoLancamento } = useQuery({
    queryKey: ["abast-ultimo-lancamento", aeronaveId],
    enabled: !!aeronaveId,
    queryFn: async () => {
      const { data, error } = await db
        .from("lancamentos_diario_bordo")
        .select("aerodromo_partida, aerodromo_chegada, data_registro, trecho")
        .eq("aeronave_id", aeronaveId)
        .order("data_registro", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data as any;
    },
  });

  const vooEmprestado = useMemo(() => {
    if (!clienteId || !aeronaveId || cotistas.length === 0) return false;
    return !cotistas.some((c: any) => c.id_clientes === clienteId);
  }, [clienteId, aeronaveId, cotistas]);

  const litrosNum = Number(String(litros).replace(",", ".")) || 0;
  const unitNum = Number(String(valorUnitario).replace(",", ".")) || 0;
  const valorTotal = litrosNum * unitNum;

  const isFaturado = FATURADOS.includes(tipoFaturamento);
  const isAVista = A_VISTA.includes(tipoFaturamento);

  const aerodromeItems = useMemo(
    () => aerodromes.map((a: any) => ({ id: a.designativo, label: `${a.designativo} — ${a.nome}` })),
    [aerodromes],
  );

  const pagoPorItems = useMemo(() => {
    const base = [{ id: "SHARE BRASIL", label: "SHARE BRASIL" }];
    cotistas.forEach((c: any) => {
      const nome = c.clientes?.razao_social;
      if (nome) base.push({ id: nome, label: nome });
    });
    return base;
  }, [cotistas]);

  const handleComandaUpload = async (file: File) => {
    setUploadingComanda(true);
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `abastecimentos/comandas/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("client-documents").upload(path, file, { upsert: true });
      if (error) throw error;
      setComandaUrl(supabase.storage.from("client-documents").getPublicUrl(path).data.publicUrl);
    } catch (e: any) {
      toast.error(`Erro no upload da comanda: ${e.message ?? e}`);
    } finally {
      setUploadingComanda(false);
    }
  };

  const urlPorTipo = (tipo: string) => anexos.find((a) => a.tipo === tipo && a.url)?.url ?? null;

  const handleSalvar = async () => {
    if (!clienteId) return toast.error("Selecione o cliente");
    if (!aeronaveId) return toast.error("Selecione a aeronave");
    if (!trechoOrigem || !trechoDestino) return toast.error("Informe o trecho (origem e destino)");
    if (!local) return toast.error("Informe o local");
    if (litrosNum <= 0 || unitNum <= 0) return toast.error("Informe litros e valor unitário");
    if (!tipoFaturamento) return toast.error("Selecione o tipo de faturamento");
    if (isFaturado && !prazo) return toast.error("Informe o prazo do faturamento");
    if (isAVista && !dataPagamento) return toast.error("Informe a data do pagamento");
    if (anexos.some((a) => a.uploading) || uploadingComanda) return toast.error("Aguarde o envio dos anexos");

    setSalvando(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id ?? null;
      let criadoPor = authData?.user?.email ?? null;
      if (userId) {
        const { data: perfil } = await db
          .from("user_profiles")
          .select("full_name, display_name")
          .eq("id", userId)
          .maybeSingle();
        criadoPor = perfil?.full_name || perfil?.display_name || criadoPor;
      }

      const nfAnexo = anexos.find((a) => a.tipo === "nf");
      const comprovante = urlPorTipo("comprovante");

      const payload: Record<string, any> = {
        id_clientes: clienteId,
        socio_nome: socioNome || null,
        aeronave_id: aeronaveId,
        numero_voo: defaultNumeroVoo || null,
        voo_emprestado: vooEmprestado,
        data,
        trecho: `${trechoOrigem} x ${trechoDestino}`,
        local,
        tipo_combustivel: tipoCombustivel || null,
        abastecedor_id: abastecedorId || null,
        abastecedor: abastecedor || null,
        litros: litrosNum,
        valor_unitario: unitNum,
        comanda: comanda || null,
        comanda_url: comandaUrl || urlPorTipo("comanda"),
        tipo_faturamento: tipoFaturamento,
        prazo: isFaturado ? prazo : null,
        status: isFaturado ? "pendente" : isAVista ? "pago" : "pendente",
        data_pagamento: isAVista ? dataPagamento : null,
        comprovante_pagamento: isAVista ? comprovante : null,
        comprovante_url: comprovante,
        nota_url: urlPorTipo("nf"),
        nf: nfAnexo?.numero || null,
        boleto_url: urlPorTipo("boleto"),
        pago_por: pagoPor || null,
        observacao: observacao || null,
        criado_por: criadoPor,
      };

      const { data: inserted, error } = await db
        .from("abastecimentos")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      toast.success("Abastecimento registrado");
      onSaved(inserted.id);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar abastecimento");
    } finally {
      setSalvando(false);
    }
  };

  const Section = ({
    icon: Icon,
    title,
    children,
    active = true,
  }: { icon: any; title: string; children: React.ReactNode; active?: boolean }) => (
    <section
      className={cn(
        "rounded-2xl border border-border/60 bg-muted/10 p-4 transition-all sm:p-5",
        !active && "pointer-events-none select-none opacity-40",
      )}
    >
      <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      {children}
    </section>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94vh] w-[calc(100vw-1rem)] max-w-4xl flex-col overflow-hidden border-border/60 bg-card/95 p-0 backdrop-blur-xl">
        <DialogHeader className="border-b border-border/60 bg-gradient-to-r from-primary/15 to-transparent px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-primary/30 bg-primary/15 p-2.5 text-primary">
              <Fuel className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg sm:text-xl">Registro de abastecimento</DialogTitle>
              <DialogDescription className="mt-1 text-xs sm:text-sm">
                Preencha os dados do abastecimento para liberar a conclusão do checklist.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {defaultNumeroVoo && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 sm:mx-6">
            <Hash className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Abastecimento vinculado ao voo</span>
            <span className="font-mono text-sm font-semibold text-primary">{defaultNumeroVoo}</span>
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <Section icon={Users} title="Cliente e aeronave">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <SearchableCombobox
                  items={clientes.map((c) => ({ id: c.id, label: c.razao_social }))}
                  value={clienteId}
                  onChange={(id) => { setClienteId(id); setSocioNome(""); }}
                  placeholder="Selecione o cliente"
                  icon={<Users className="h-4 w-4" />}
                />
              </div>
              {socios.length > 0 && (
                <div className="space-y-2">
                  <Label>Sócio</Label>
                  <SearchableCombobox
                    items={socios.map((s) => ({ id: s.nome, label: s.nome }))}
                    value={socioNome}
                    onChange={(id) => setSocioNome(id)}
                    placeholder="Selecione o sócio"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Aeronave</Label>
                <SearchableCombobox
                  items={aeronaves.map((a) => ({ id: a.id, label: `${a.matricula}${a.modelo ? ` — ${a.modelo}` : ""}` }))}
                  value={aeronaveId}
                  onChange={(id) => setAeronaveId(id)}
                  placeholder="Selecione a aeronave"
                  icon={<Plane className="h-4 w-4" />}
                />
                {aeronaveId && clienteId && (
                  <p className={cn("text-xs", vooEmprestado ? "text-amber-500" : "text-emerald-500")}>
                    {vooEmprestado ? "Voo de empréstimo (aeronave não é do cliente)" : "Aeronave do próprio cliente"}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="rounded-lg" />
              </div>
            </div>
          </Section>

          {ultimoLancamento && !avisoFechado && (
            <div className="flex items-start gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
              <p className="flex-1 text-xs text-sky-200">
                O último lançamento no diário de bordo desta aeronave foi o trecho{" "}
                <strong>
                  {ultimoLancamento.aerodromo_partida || "—"} x {ultimoLancamento.aerodromo_chegada || "—"}
                </strong>{" "}
                em <strong>{ultimoLancamento.data_registro
                  ? new Date(`${ultimoLancamento.data_registro}T12:00:00`).toLocaleDateString("pt-BR")
                  : "—"}</strong>.
              </p>
              <button type="button" onClick={() => setAvisoFechado(true)} className="text-sky-300 hover:text-sky-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <Section icon={MapPin} title="Trecho e local" active={!!aeronaveId}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Aeródromo de origem</Label>
                <SearchableCombobox
                  items={aerodromeItems}
                  value={trechoOrigem}
                  onChange={(id) => setTrechoOrigem(id)}
                  placeholder="Origem"
                  allowFreeText
                />
              </div>
              <div className="space-y-2">
                <Label>Aeródromo de destino</Label>
                <SearchableCombobox
                  items={aerodromeItems}
                  value={trechoDestino}
                  onChange={(id) => setTrechoDestino(id)}
                  placeholder="Destino"
                  allowFreeText
                />
              </div>
              <div className="space-y-2">
                <Label>Local do abastecimento</Label>
                <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex: SBCY" className="rounded-lg" />
              </div>
            </div>
          </Section>

          <Section icon={Fuel} title="Combustível" active={!!trechoOrigem && !!trechoDestino}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de combustível</Label>
                <SearchableCombobox
                  items={TIPOS_COMBUSTIVEL}
                  value={tipoCombustivel}
                  onChange={(id) => setTipoCombustivel(id)}
                  placeholder="AVGAS ou JET A1"
                />
              </div>
              <div className="space-y-2">
                <Label>Fornecedor (abastecedor)</Label>
                <SearchableCombobox
                  items={fornecedores.map((f) => ({
                    id: f.id,
                    label: `${f.nome_fornecedor}${f.codigo_icao ? ` — ${f.codigo_icao}` : ""}`,
                  }))}
                  value={abastecedorId}
                  onChange={(id, label) => {
                    setAbastecedorId(id);
                    setAbastecedor(label.split(" — ")[0]);
                    const f = fornecedores.find((x) => x.id === id);
                    if (f) {
                      const preco = tipoCombustivel === "JET A1" ? f.preco_jet : f.preco_avgas;
                      if (preco) setValorUnitario(String(preco));
                    }
                  }}
                  placeholder="Selecione o fornecedor"
                />
              </div>
              <div className="space-y-2">
                <Label>Abastecedor (nome)</Label>
                <Input value={abastecedor} onChange={(e) => setAbastecedor(e.target.value)} className="rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Valor unitário</Label>
                  <Input value={valorUnitario} onChange={(e) => setValorUnitario(e.target.value)} inputMode="decimal" placeholder="0,00" className="rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label>Litros</Label>
                  <Input value={litros} onChange={(e) => setLitros(e.target.value)} inputMode="decimal" placeholder="0" className="rounded-lg" />
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Valor total</span>
              <span className="text-lg font-bold tabular-nums text-emerald-400">{brl(valorTotal)}</span>
            </div>
          </Section>

          <Section icon={FileText} title="Comanda" active={litrosNum > 0 && unitNum > 0}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Número da comanda</Label>
                <Input value={comanda} onChange={(e) => setComanda(e.target.value)} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label>Imagem da comanda</Label>
                {comandaUrl ? (
                  <a
                    href={comandaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-10 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-400"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Comanda enviada
                  </a>
                ) : (
                  <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-background px-3 text-xs text-muted-foreground hover:bg-accent/40">
                    {uploadingComanda ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploadingComanda ? "Enviando..." : "Enviar imagem da comanda"}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleComandaUpload(f);
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </Section>

          <Section icon={CreditCard} title="Faturamento" active={litrosNum > 0 && unitNum > 0}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de faturamento</Label>
                <SearchableCombobox
                  items={TIPOS_FATURAMENTO}
                  value={tipoFaturamento}
                  onChange={(id) => setTipoFaturamento(id)}
                  placeholder="Selecione"
                />
              </div>
              {isFaturado && (
                <div className="space-y-2">
                  <Label>Prazo do faturamento</Label>
                  <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="rounded-lg" />
                  <p className="text-xs text-amber-500">Status: pendente (aguardando conclusão financeira)</p>
                </div>
              )}
              {isAVista && (
                <div className="space-y-2">
                  <Label>Data do pagamento</Label>
                  <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} className="rounded-lg" />
                  <p className="text-xs text-emerald-500">Status: pago</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Pago por</Label>
                <SearchableCombobox
                  items={pagoPorItems}
                  value={pagoPor}
                  onChange={(id) => setPagoPor(id)}
                  placeholder="Selecione"
                  icon={<Building2 className="h-4 w-4" />}
                />
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Anexos (NF, boleto, comprovante)
              </p>
              <AnexosDinamicosField
                anexos={anexos}
                onChange={setAnexos}
                storagePrefix={`abastecimentos/${clienteId || "sem-cliente"}`}
              />
            </div>
          </Section>

          <Section icon={FileText} title="Observações">
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Informações adicionais do abastecimento"
              className="min-h-[80px] rounded-lg"
            />
          </Section>
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-border/60 bg-card/95 px-4 py-3 sm:flex-row sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando} className="w-full sm:w-auto">
            Preencher depois
          </Button>
          <Button onClick={handleSalvar} disabled={salvando} className="w-full gap-2 sm:w-auto sm:min-w-52">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Salvar abastecimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}