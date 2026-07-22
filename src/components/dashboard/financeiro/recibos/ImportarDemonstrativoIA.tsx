import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Sparkles, FileImage, Trash2, AlertCircle, CheckCircle2, Receipt, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { generateSequentialReceiptNumber } from "@/lib/receiptUtils";
import { useReceiptPdfGenerator } from "@/hooks/useReceiptPdfGenerator";
import { buildCotistaOptions, normalizeTextForMatching } from "./demonstrativoUtils";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { SolicitacaoPagamentoModal } from "@/components/dashboard/financeiro/SolicitacaoPagamentoModal";

type TipoDemonstrativo = "INFRAERO" | "DECEA";

interface DemonstrativoItem {
  data: string;
  hora?: string;
  operacao?: string;
  matricula?: string;
  valor: number;
}

interface DemonstrativoResult {
  tipo: TipoDemonstrativo;
  numero_documento: string | null;
  competencia: string | null;
  data_faturamento: string | null;
  aeronave_matricula: string | null;
  cliente_nome: string | null;
  valor_total: number | null;
  itens: DemonstrativoItem[];
}

interface Aeronave {
  id: string;
  matricula: string;
}

interface CotistaOption {
  id: string;
  cliente_id?: string | null;
  socio_id?: string | null;
  nome: string;
  documento: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  percentual: number;
}

interface LinhaItem extends DemonstrativoItem {
  cotistaNome: string;
  sugeridoDoDiario?: boolean;
  naoIdentificado?: boolean;
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [, mime, b64] = result.match(/^data:(.+);base64,(.+)$/) || [];
      if (!b64) reject(new Error("Falha ao ler arquivo"));
      else resolve({ base64: b64, mimeType: mime || file.type || "image/png" });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const STORAGE_BUCKET = "n.f-boletos-clients";

async function uploadDemonstrativo(file: File, tipo: TipoDemonstrativo): Promise<string | null> {
  try {
    const timestamp = Date.now();
    const suffix = Math.random().toString(36).substring(2, 8);
    const sanitized = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_").substring(0, 80);
    const path = `demonstrativo_${tipo.toLowerCase()}_${timestamp}_${suffix}_${sanitized}`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (err) {
    console.error("Erro no upload do demonstrativo:", err);
    return null;
  }
}

export default function ImportarDemonstrativoIA({
  onGenerated,
}: {
  onGenerated?: () => void;
}) {
  const [tipo, setTipo] = useState<TipoDemonstrativo>("INFRAERO");
  const [aeronaves, setAeronaves] = useState<Aeronave[]>([]);
  const [aeronaveId, setAeronaveId] = useState<string>("");
  const [cotistas, setCotistas] = useState<CotistaOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatingMode, setGeneratingMode] = useState<null | "recibo" | "recibo_pgto" | "pgto">(null);
  const [result, setResult] = useState<DemonstrativoResult | null>(null);
  const [linhas, setLinhas] = useState<LinhaItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { generateAndUploadPdf } = useReceiptPdfGenerator();

  // Modal de solicitação de pagamento
  const [solicitacaoOpen, setSolicitacaoOpen] = useState(false);
  const [solicitacaoInitialData, setSolicitacaoInitialData] = useState<any>(null);

  useEffect(() => {
    supabase
      .from("aeronave")
      .select("id, matricula")
      .order("matricula")
      .then(({ data }) => setAeronaves((data || []) as Aeronave[]));
  }, []);

  useEffect(() => {
    if (!aeronaveId) {
      setCotistas([]);
      return;
    }
    Promise.all([
      supabase
        .from("cotistas_aeronave")
        .select(
          "id_clientes, socios_id, percentual_sociedade, clientes:id_clientes(id, razao_social, cnpj, endereco, cidade, uf)"
        )
        .eq("id_aeronave", aeronaveId),
      supabase.from("socios").select("id, nome, cpf, cliente_id, endereco, cidade, uf").order("nome"),
    ]).then(([cotistasResponse, sociosResponse]) => {
      if (cotistasResponse.error) {
        console.error(cotistasResponse.error);
        return;
      }
      if (sociosResponse.error) {
        console.error(sociosResponse.error);
        return;
      }
      const opts = buildCotistaOptions(
        (cotistasResponse.data as any[]) || [],
        (sociosResponse.data as any[]) || []
      );
      setCotistas(opts as CotistaOption[]);
    });
  }, [aeronaveId]);

  const handleFileChange = (f: File | null) => {
    setFile(f);
    setResult(null);
    setLinhas([]);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast({ title: "Selecione uma imagem", variant: "destructive" });
      return;
    }
    if (!aeronaveId) {
      toast({ title: "Selecione a aeronave antes de analisar", variant: "destructive" });
      return;
    }
    setIsAnalyzing(true);
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("demonstrativo-ocr", {
        body: { imageBase64: base64, mimeType, tipo },
      });
      if (error) throw error;
      const res = data as DemonstrativoResult;

      const toIso = (d: string): string | null => {
        const m = (d || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
      };

      const datasIso = Array.from(
        new Set(res.itens.map((i) => toIso(i.data)).filter(Boolean) as string[])
      );

      let diarioRows: Array<{
        data_registro: string;
        aerodromo_partida: string | null;
        aerodromo_chegada: string | null;
        socios_nome: string | null;
        socios_id: string | null;
        clientes_id: string | null;
      }> = [];

      if (datasIso.length > 0) {
        const { data: diarioData, error: diarioErr } = await (supabase as any)
          .from("lancamentos_diario_bordo")
          .select(
            "data_registro, aerodromo_partida, aerodromo_chegada, socios_nome, socios_id, clientes_id"
          )
          .eq("aeronave_id", aeronaveId)
          .in("data_registro", datasIso);
        if (diarioErr) console.warn("Falha ao consultar diário:", diarioErr.message);
        diarioRows = (diarioData || []) as typeof diarioRows;
      }

      const findSugestao = (item: DemonstrativoItem): string | null => {
        const iso = toIso(item.data);
        if (!iso) return null;
        const op = (item.operacao || "").trim().toUpperCase();
        let match = diarioRows.find(
          (r) =>
            r.data_registro === iso &&
            (r.aerodromo_partida || "").trim().toUpperCase() === op
        );
        if (!match) {
          match = diarioRows.find(
            (r) =>
              r.data_registro === iso &&
              (r.aerodromo_chegada || "").trim().toUpperCase() === op
          );
        }
        if (!match) {
          const doDia = diarioRows.filter((r) => r.data_registro === iso);
          if (doDia.length === 1) match = doDia[0];
        }
        return match?.socios_nome?.trim() || null;
      };

      const novasLinhas: LinhaItem[] = res.itens.map((it) => {
        const sugestao = findSugestao(it);
        return {
          ...it,
          cotistaNome: sugestao || "",
          sugeridoDoDiario: !!sugestao,
          naoIdentificado: !sugestao,
        };
      });

      const naoIdent = novasLinhas.filter((l) => l.naoIdentificado).length;
      setResult(res);
      setLinhas(novasLinhas);
      toast({
        title: "Análise concluída",
        description:
          `${res.itens.length} operações detectadas` +
          (naoIdent > 0
            ? ` — ${naoIdent} sem correspondência no diário de bordo`
            : " — todos os sócios sugeridos a partir do diário"),
      });
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Falha ao processar a imagem";
      toast({ title: "Erro na análise", description: message, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const consolidado = useMemo(() => {
    const total = linhas.reduce((s, l) => s + (l.valor || 0), 0);
    const map = new Map<string, { nome: string; valor: number; itens: number }>();
    for (const l of linhas) {
      const nome = (l.cotistaNome || "").trim();
      if (!nome) continue;
      const cur = map.get(nome) || { nome, valor: 0, itens: 0 };
      cur.valor += l.valor || 0;
      cur.itens += 1;
      map.set(nome, cur);
    }
    const rows = Array.from(map.values()).map((r) => ({
      ...r,
      percentual: total > 0 ? (r.valor / total) * 100 : 0,
    }));
    return { total, rows, semAtribuicao: linhas.filter((l) => !l.cotistaNome.trim()).length };
  }, [linhas]);

  const validarAntesDeGerar = (): boolean => {
    if (!result || consolidado.rows.length === 0) {
      toast({ title: "Nenhum sócio atribuído às linhas", variant: "destructive" });
      return false;
    }
    if (consolidado.semAtribuicao > 0) {
      toast({
        title: "Existem linhas sem sócio",
        description: `${consolidado.semAtribuicao} linha(s) sem atribuição.`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const resetForm = () => {
    setFile(null);
    setResult(null);
    setLinhas([]);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const criarRecibos = async (demonstrativoUrl: string | null): Promise<number> => {
    if (!result) return 0;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error("Usuário não autenticado");

    const tipoLabel = tipo === "INFRAERO" ? "Tarifa INFRAERO" : "Tarifa DECEA";
    const descBase = `${tipoLabel} - Doc ${result.numero_documento || "?"}${
      result.competencia ? " - Comp " + result.competencia : ""
    } - Aeronave ${result.aeronave_matricula || ""}`;

    let sucesso = 0;
    for (const row of consolidado.rows) {
      const normalizedRowName = normalizeTextForMatching(row.nome);
      const cotistaMatch = cotistas.find(
        (c) => normalizeTextForMatching(c.nome) === normalizedRowName
      );
      const numeroRecibo = await generateSequentialReceiptNumber(
        row.nome,
        supabase,
        cotistaMatch?.cliente_id || cotistaMatch?.id || null
      );
      const payload: Record<string, unknown> = {
        usuario_id: userId,
        nome_pagador: row.nome,
        documento_pagador: cotistaMatch?.documento || "",
        endereco_pagador: cotistaMatch?.endereco || null,
        cidade_pagador: cotistaMatch?.cidade || null,
        uf_pagador: cotistaMatch?.uf || null,
        valor: Number(row.valor.toFixed(2)),
        descricao_servico: `${descBase} - Rateio ${row.percentual.toFixed(2)}% (${row.itens} op.)`,
        tipo_recibo: "reembolso",
        data_emissao: new Date().toISOString().split("T")[0],
        numero_recibo: numeroRecibo,
        cliente_id: cotistaMatch?.id || null,
        aeronave_id: aeronaveId || null,
        compartilhado: true,
        percentual: Number(row.percentual.toFixed(2)),
        valor_total: Number(consolidado.total.toFixed(2)),
        numero_documento: result.numero_documento || null,
        [tipo === "DECEA" ? "competencia_decea" : "competencia_infraero"]:
          result.competencia || null,
        demonstrativo_url: demonstrativoUrl || null,
        [tipo === "DECEA" ? "decea_url" : "infraero_url"]: demonstrativoUrl || null,
      };

      const { data: inserted, error } = await (supabase as any)
        .from("recibos")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      try {
        await generateAndUploadPdf({
          receiptData: { ...(inserted || {}), ...payload } as any,
          userId,
        });
      } catch (pdfErr) {
        console.error("Falha ao gerar PDF do recibo", pdfErr);
      }
      sucesso++;
    }
    return sucesso;
  };

  const abrirSolicitacaoPagamento = (demonstrativoUrl: string | null) => {
    if (!result) return;
    const tipoLabel = tipo === "INFRAERO" ? "Tarifa INFRAERO" : "Tarifa DECEA";
    const subcategoria =
      tipo === "INFRAERO"
        ? "TARIFA INFRAERO"
        : "TARIFA DE NAVEGAÇÃO AÉREA - DECEA";

    // Agrupar rows por clienteId (cotista pode compartilhar cliente com socio diferente)
    const grupos = new Map<
      string,
      {
        cliente_id: string;
        valor_total_cliente: number;
        percentual_uso: number;
        valorOverridesSocio: Record<string, string>;
      }
    >();

    for (const row of consolidado.rows) {
      const normalizedRowName = normalizeTextForMatching(row.nome);
      const cotistaMatch = cotistas.find(
        (c) => normalizeTextForMatching(c.nome) === normalizedRowName
      );
      const clienteId = cotistaMatch?.cliente_id || cotistaMatch?.id || null;
      const socioId = (cotistaMatch as any)?.socio_id || null;
      if (!clienteId) continue;

      const g =
        grupos.get(clienteId) ||
        ({
          cliente_id: clienteId,
          valor_total_cliente: 0,
          percentual_uso: 0,
          valorOverridesSocio: {},
        } as any);
      g.valor_total_cliente += row.valor;
      g.percentual_uso += row.percentual;
      if (socioId) {
        g.valorOverridesSocio[socioId] = row.valor.toFixed(2);
      }
      grupos.set(clienteId, g);
    }

    const rateio_cliente = Array.from(grupos.values()).map((g) => ({
      cliente_id: g.cliente_id,
      valor_total_cliente: Number(g.valor_total_cliente.toFixed(2)),
      percentual_uso: Number(g.percentual_uso.toFixed(2)),
      valorOverridesSocio: g.valorOverridesSocio,
    }));

    const initial = {
      aeronave_id: aeronaveId,
      tipo_despesa_label: "TAXAS AEROPORTUARIAS E NAVEGAÇÃO AEREA",
      subcategoria,
      nome_categoria: tipoLabel,
      tipo_rateio: "VARIAVEL POR VOO",
      periodicidade: "MENSAL",
      taxa_origem: tipo,
      numero_doc: result.numero_documento || null,
      valor_total: Number(consolidado.total.toFixed(2)),
      valor: Number(consolidado.total.toFixed(2)),
      descricao_despesa: `${tipoLabel} - Doc ${result.numero_documento || "?"}${
        result.competencia ? " - Comp " + result.competencia : ""
      }`,
      competencia_infraero: tipo === "INFRAERO" ? result.competencia || null : null,
      competencia_decea: tipo === "DECEA" ? result.competencia || null : null,
      demonstrativo_url: demonstrativoUrl,
      anexos: demonstrativoUrl
        ? [{ tipo: "demonstrativo", url: demonstrativoUrl, numero: result.numero_documento || "" }]
        : [],
      rateio_cliente,
    };

    setSolicitacaoInitialData(initial);
    setSolicitacaoOpen(true);
  };

  const handleAcao = async (modo: "recibo" | "recibo_pgto" | "pgto") => {
    if (!validarAntesDeGerar()) return;
    if (!file) {
      toast({ title: "Imagem do demonstrativo não encontrada", variant: "destructive" });
      return;
    }
    setGeneratingMode(modo);
    try {
      const demonstrativoUrl = await uploadDemonstrativo(file, tipo);
      if (!demonstrativoUrl) {
        toast({
          title: "Aviso",
          description: "Falha ao salvar imagem no storage — seguindo sem URL.",
        });
      }

      if (modo === "recibo") {
        const n = await criarRecibos(demonstrativoUrl);
        toast({ title: "Recibos gerados", description: `${n} recibo(s) criado(s).` });
        onGenerated?.();
        resetForm();
        return;
      }

      if (modo === "recibo_pgto") {
        const n = await criarRecibos(demonstrativoUrl);
        toast({ title: "Recibos gerados", description: `${n} recibo(s) criado(s). Abrindo solicitação de pagamento…` });
        onGenerated?.();
        abrirSolicitacaoPagamento(demonstrativoUrl);
        return;
      }

      // modo === "pgto"
      abrirSolicitacaoPagamento(demonstrativoUrl);
      toast({ title: "Solicitação de pagamento", description: "Preencha os dados e confirme." });
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Falha desconhecida";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setGeneratingMode(null);
    }
  };

  const isGenerating = generatingMode !== null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Reconhecimento Automatico — Demonstrativos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Tipo de demonstrativo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoDemonstrativo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INFRAERO">TARIFA INFRAERO</SelectItem>
                  <SelectItem value="DECEA">TARIFA DE NAVEGAÇÃO AÉREA - DECEA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Matrícula da aeronave</Label>
              <Select value={aeronaveId} onValueChange={setAeronaveId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a aeronave" />
                </SelectTrigger>
                <SelectContent>
                  {aeronaves.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.matricula}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Imagem do demonstrativo</Label>
            <div className="mt-1 flex items-center gap-3">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
              <Button
                type="button"
                onClick={handleAnalyze}
                disabled={!file || isAnalyzing}
                className="gap-2"
              >
                {isAnalyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Analisar demonstrativo
              </Button>
            </div>
            {previewUrl && (
              <div className="mt-3 rounded-lg border border-border/50 p-2 bg-muted/30 inline-block">
                <img src={previewUrl} alt="Prévia demonstrativo" className="max-h-48 rounded" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileImage className="h-4 w-4" /> Dados extraídos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Nº Documento</div>
                  <div className="font-medium">{result.numero_documento || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Competência</div>
                  <div className="font-medium">{result.competencia || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Matrícula</div>
                  <div className="font-medium">{result.aeronave_matricula || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Valor total</div>
                  <div className="font-medium">
                    {result.valor_total != null ? brl(result.valor_total) : brl(consolidado.total)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Operações — atribua o sócio/cliente por linha
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Hora</TableHead>
                      <TableHead>Operação</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="min-w-[240px]">Sócio / Cliente</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((l, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{l.data}</TableCell>
                        <TableCell>{l.hora || "—"}</TableCell>
                        <TableCell className="text-xs">{l.operacao || "—"}</TableCell>
                        <TableCell className="text-right font-medium">{brl(l.valor)}</TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            <SearchableCombobox
                              items={cotistas.map((c) => ({ id: c.nome, label: c.nome }))}
                              value={l.cotistaNome}
                              onChange={(_id, label) => {
                                setLinhas((prev) =>
                                  prev.map((it, i) =>
                                    i === idx
                                      ? {
                                          ...it,
                                          cotistaNome: label,
                                          sugeridoDoDiario: false,
                                          naoIdentificado: false,
                                        }
                                      : it
                                  )
                                );
                              }}
                              placeholder="Selecione o sócio/cliente"
                              searchPlaceholder="Buscar cotista ou digitar novo..."
                              emptyMessage="Nenhum cotista cadastrado"
                              allowFreeText
                            />
                            {l.sugeridoDoDiario && l.cotistaNome && (
                              <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" />
                                Sugerido a partir do diário de bordo
                              </div>
                            )}
                            {l.naoIdentificado && !l.cotistaNome && (
                              <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                                <AlertCircle className="h-3 w-3" />
                                Não identificado no diário — informe manualmente
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setLinhas((prev) => prev.filter((_, i) => i !== idx))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rateio consolidado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {consolidado.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Atribua os sócios nas linhas acima para ver o rateio.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sócio / Cliente</TableHead>
                      <TableHead className="text-center">Operações</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consolidado.rows.map((r) => (
                      <TableRow key={r.nome}>
                        <TableCell className="font-medium">{r.nome}</TableCell>
                        <TableCell className="text-center">{r.itens}</TableCell>
                        <TableCell className="text-right">{brl(r.valor)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{r.percentual.toFixed(2)}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-bold">Total</TableCell>
                      <TableCell />
                      <TableCell className="text-right font-bold">
                        {brl(consolidado.total)}
                      </TableCell>
                      <TableCell className="text-right font-bold">100%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => handleAcao("recibo")}
                  disabled={
                    isGenerating ||
                    consolidado.rows.length === 0 ||
                    consolidado.semAtribuicao > 0
                  }
                  className="gap-2"
                >
                  {generatingMode === "recibo" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Receipt className="h-4 w-4" />
                  )}
                  Apenas gerar recibo
                </Button>
                <Button
                  onClick={() => handleAcao("recibo_pgto")}
                  disabled={
                    isGenerating ||
                    consolidado.rows.length === 0 ||
                    consolidado.semAtribuicao > 0
                  }
                  className="gap-2"
                >
                  {generatingMode === "recibo_pgto" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Gerar recibo e enviar para pagamento
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleAcao("pgto")}
                  disabled={
                    isGenerating ||
                    consolidado.rows.length === 0 ||
                    consolidado.semAtribuicao > 0
                  }
                  className="gap-2"
                >
                  {generatingMode === "pgto" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Apenas enviar para pagamento
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <SolicitacaoPagamentoModal
        open={solicitacaoOpen}
        onOpenChange={(v) => {
          setSolicitacaoOpen(v);
          if (!v) {
            // ao fechar, se veio de fluxo "pgto only" ou "recibo_pgto" - resetar
            resetForm();
            onGenerated?.();
          }
        }}
        initialData={solicitacaoInitialData}
      />
    </div>
  );
}
