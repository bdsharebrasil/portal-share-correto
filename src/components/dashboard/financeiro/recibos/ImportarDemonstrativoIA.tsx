import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload, Sparkles, FileImage, Trash2, AlertCircle, CheckCircle2,
  Receipt, Send, Repeat, Loader2, Hourglass, Plane, FileText, Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { useReceiptPdfGenerator } from "@/hooks/useReceiptPdfGenerator";
import { generateSequentialReceiptNumber } from "@/lib/receiptUtils";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { SolicitacaoPagamentoModal } from "@/components/dashboard/financeiro/SolicitacaoPagamentoModal";
import { EnviarEmailClienteDialog } from "@/components/dashboard/financeiro/EnviarEmailClienteDialog";
import { expandSpecialRateioLine } from "@/components/dashboard/financeiro/recibos/demonstrativoUtils";
import {
  type Aeronave, type Cotista,
  norm, num,
} from "../../gestor/FinanceiroCotista/balancoTypes";

type TipoDemo = "INFRAERO" | "DECEA" | "POUSO";

const TIPO_LABEL: Record<TipoDemo, string> = {
  INFRAERO: "Tarifa INFRAERO",
  DECEA: "Tarifa DECEA",
  POUSO: "Tarifa de Pouso",
};
const TIPO_FORNECEDOR: Record<TipoDemo, string> = {
  INFRAERO: "INFRAERO",
  DECEA: "DECEA",
  POUSO: "TARIFA DE POUSO",
};
const TIPO_SUBCATEGORIA: Record<TipoDemo, string> = {
  INFRAERO: "TARIFA INFRAERO",
  DECEA: "TARIFA DE NAVEGAÇÃO AÉREA - DECEA",
  POUSO: "TARIFA DE POUSO",
};

import { AIS_API_BASE_URL } from "@/config/api";

const WORKER_URL = AIS_API_BASE_URL.replace(/\/$/, "");

interface DemoItem {
  data: string;
  hora?: string;
  operacao?: string;
  matricula?: string;
  valor: number;
}

interface DemoResult {
  tipo: TipoDemo;
  numero_documento: string | null;
  competencia: string | null;
  data_faturamento: string | null;
  aeronave_matricula: string | null;
  cliente_nome: string | null;
  valor_total: number | null;
  itens: DemoItem[];
}

interface LinhaItem extends DemoItem {
  cotistaNome: string;
  sugeridoDoDiario: boolean;
  naoIdentificado: boolean;
  isEmprestimo: boolean;
}

interface DiarioRow {
  data_registro: string;
  aerodromo_partida: string | null;
  aerodromo_chegada: string | null;
  socios_nome: string | null;
  socios_id: string | null;
  clientes_id: string | null;
  divisao_igual: boolean | null;
  emprestimo: boolean | null;
  cliente_tomador_emprestimo_id: string | null;
  socio_tomador_emprestimo_id: string | null;
}

interface Tomador {
  id: string;
  nome: string;
  cliente_id: string;
  documento?: string;
  isEmprestimo: true;
}

const brl = (v: number) => formatBRL(v || 0);

const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const match = result.match(/^data:(.+);base64,(.+)$/);
      if (!match) reject(new Error("Falha ao ler arquivo"));
      else resolve({ base64: match[2], mimeType: match[1] || file.type });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const toIso = (d: string): string | null => {
  const m = (d || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

export default function ImportarDemonstrativoTab() {
  const [tipo, setTipo] = useState<TipoDemo>("INFRAERO");
  const [aeronaves, setAeronaves] = useState<Aeronave[]>([]);
  const [aircraftId, setAircraftId] = useState("");
  const [cotistas, setCotistas] = useState<Cotista[]>([]);
  const [tomadores, setTomadores] = useState<Tomador[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatingMode, setGeneratingMode] = useState<null | "recibo" | "pgto">(null);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [linhas, setLinhas] = useState<LinhaItem[]>([]);
  const [clienteRateioSelecionado, setClienteRateioSelecionado] = useState("");
  const [solicitacaoModalOpen, setSolicitacaoModalOpen] = useState(false);
  const [solicitacaoInitialData, setSolicitacaoInitialData] = useState<any>(null);
  const [recibosGerados, setRecibosGerados] = useState<any[]>([]);
  const [perguntarEmail, setPerguntarEmail] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { generateAndUploadPdf } = useReceiptPdfGenerator();

  useEffect(() => {
    supabase.from("aeronave").select("id, matricula, modelo").eq("status", "ativa").order("matricula")
      .then(({ data }) => setAeronaves((data || []) as Aeronave[]));
  }, []);

  useEffect(() => {
    if (!aircraftId) { setCotistas([]); setTomadores([]); return; }
    const fetchData = async () => {
      const { data: cotData } = await supabase
        .from("cotistas_aeronave")
        .select("id_clientes, socios_id, percentual_sociedade, clientes(id, razao_social, cnpj), socios(id, nome, cpf)")
        .eq("id_aeronave", aircraftId);
      const socioIds = Array.from(new Set((cotData || []).map((r: any) => r.socios_id).filter(Boolean)));
      let sociosMap: Record<string, any> = {};
      if (socioIds.length > 0) {
        const { data: sociosData } = await supabase.from("socios").select("id, nome, cpf").in("id", socioIds);
        (sociosData || []).forEach((s: any) => { sociosMap[s.id] = s; });
      }
      setCotistas((cotData || []).map((r: any) => ({
        id: `${r.id_clientes}|${r.socios_id || ""}`,
        cliente_id: r.id_clientes ?? null,
        socio_id: r.socios_id ?? null,
        nome: sociosMap[r.socios_id]?.nome || r.clientes?.razao_social || "Cotista",
        percentual: num(r.percentual_sociedade),
      })));

      // Buscar tomadores de empréstimo — por cliente_id E por socio_id
      const { data: empData } = await supabase
        .from("lancamentos_diario_bordo")
        .select("cliente_tomador_emprestimo_id, socio_tomador_emprestimo_id")
        .eq("aeronave_id", aircraftId)
        .eq("emprestimo", true);

      // tomadores via cliente
      const clienteIds = Array.from(new Set(
        (empData || []).map((r: any) => r.cliente_tomador_emprestimo_id).filter(Boolean)
      ));
      // tomadores via sócio
      const socioTomadorIds = Array.from(new Set(
        (empData || []).map((r: any) => r.socio_tomador_emprestimo_id).filter(Boolean)
      ));

      const newTomadores: Tomador[] = [];

      if (clienteIds.length > 0) {
        const { data: clientesData } = await supabase
          .from("clientes")
          .select("id, razao_social, cnpj")
          .in("id", clienteIds);
        (clientesData || []).forEach((c: any) => {
          newTomadores.push({ id: c.razao_social, nome: c.razao_social, cliente_id: c.id, documento: c.cnpj, isEmprestimo: true as const });
        });
      }

      if (socioTomadorIds.length > 0) {
        const { data: socioTomData } = await supabase
          .from("socios")
          .select("id, nome, cpf, cliente_id")
          .in("id", socioTomadorIds);
        (socioTomData || []).forEach((s: any) => {
          // avoid duplicates by socio nome
          if (!newTomadores.find((t) => norm(t.nome) === norm(s.nome))) {
            newTomadores.push({ id: s.nome, nome: s.nome, cliente_id: s.cliente_id || s.id, documento: s.cpf, isEmprestimo: true as const });
          }
        });
      }

      setTomadores(newTomadores);
    };
    fetchData();
  }, [aircraftId]);

  const opcoesAtribuicao = useMemo(() => [...cotistas, ...tomadores], [cotistas, tomadores]);
  const clienteRateioItems = useMemo(
    () => opcoesAtribuicao.map((item) => ({ id: item.id, label: item.nome })),
    [opcoesAtribuicao]
  );

  const handleFileChange = (f: File | null) => {
    setFile(f);
    setResult(null);
    setLinhas([]);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  };

  const showToast = (type: "ok" | "err", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAnalyze = async () => {
    if (!file) { showToast("err", "Selecione uma imagem"); return; }
    if (!aircraftId) { showToast("err", "Selecione a aeronave antes de analisar"); return; }
    setIsAnalyzing(true);
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error("Sessão expirada. Faça login novamente.");

      const { data, error: fnError } = await supabase.functions.invoke("demonstrativo-ocr", {
        body: { imageBase64: base64, mimeType, tipo },
      });
      if (fnError) throw new Error((data as any)?.error || fnError.message || "Falha ao processar o demonstrativo");
      if ((data as any)?.error) throw new Error((data as any).error);
      const res = data as DemoResult;


      const datasIso = Array.from(new Set(res.itens.map((i) => toIso(i.data)).filter(Boolean) as string[]));
      let diarioRows: DiarioRow[] = [];
      if (datasIso.length > 0) {
        const { data: diarioData } = await supabase
          .from("lancamentos_diario_bordo")
          .select("data_registro, aerodromo_partida, aerodromo_chegada, socios_nome, socios_id, clientes_id, divisao_igual, emprestimo, cliente_tomador_emprestimo_id, socio_tomador_emprestimo_id")
          .eq("aeronave_id", aircraftId)
          .in("data_registro", datasIso);
        diarioRows = (diarioData || []) as DiarioRow[];
      }

      // Build a map of socio_tomador IDs → nome for fast lookup
      const socioTomadorIdSet = new Set(
        diarioRows
          .filter((r) => r.emprestimo && r.socio_tomador_emprestimo_id)
          .map((r) => r.socio_tomador_emprestimo_id!)
      );
      let socioTomadorNomeMap: Record<string, string> = {};
      if (socioTomadorIdSet.size > 0) {
        const { data: stData } = await supabase
          .from("socios")
          .select("id, nome")
          .in("id", Array.from(socioTomadorIdSet));
        (stData || []).forEach((s: any) => { socioTomadorNomeMap[s.id] = s.nome; });
      }

      const findSugestao = (item: DemoItem): { nome: string | null; isEmprestimo: boolean } => {
        const iso = toIso(item.data);
        if (!iso) return { nome: null, isEmprestimo: false };
        const op = (item.operacao || "").trim().toUpperCase();
        let match = diarioRows.find((r) => r.data_registro === iso && (r.aerodromo_partida || "").trim().toUpperCase() === op);
        if (!match) match = diarioRows.find((r) => r.data_registro === iso && (r.aerodromo_chegada || "").trim().toUpperCase() === op);
        if (!match) {
          const doDia = diarioRows.filter((r) => r.data_registro === iso);
          if (doDia.length === 1) match = doDia[0];
        }
        if (!match) return { nome: null, isEmprestimo: false };

        if (match.divisao_igual) {
          return { nome: "VOO TESTE", isEmprestimo: false };
        }

        // Empréstimo: priorizar sócio tomador, depois cliente tomador
        if (match.emprestimo) {
          if (match.socio_tomador_emprestimo_id) {
            const nome = socioTomadorNomeMap[match.socio_tomador_emprestimo_id] || null;
            return { nome, isEmprestimo: true };
          }
          if (match.cliente_tomador_emprestimo_id) {
            const tomador = tomadores.find((t) => t.cliente_id === match!.cliente_tomador_emprestimo_id);
            return { nome: tomador?.nome || null, isEmprestimo: true };
          }
          return { nome: null, isEmprestimo: true };
        }

        // Voo normal: tentar socios_nome, depois resolver via socios_id, depois via clientes_id
        if (match.socios_nome?.trim()) return { nome: match.socios_nome.trim(), isEmprestimo: false };
        if (match.socios_id) {
          const cot = cotistas.find((c) => c.socio_id === match!.socios_id);
          if (cot) return { nome: cot.nome, isEmprestimo: false };
        }
        if (match.clientes_id) {
          const cot = cotistas.find((c) => c.cliente_id === match!.clientes_id);
          if (cot) return { nome: cot.nome, isEmprestimo: false };
        }
        return { nome: null, isEmprestimo: false };
      };

      const novasLinhas: LinhaItem[] = res.itens.map((it) => {
        const sugestao = findSugestao(it);
        return { ...it, cotistaNome: sugestao.nome || "", sugeridoDoDiario: !!sugestao.nome, naoIdentificado: !sugestao.nome, isEmprestimo: sugestao.isEmprestimo };
      });

      const linhasExpandidas = novasLinhas.flatMap((linha) => expandSpecialRateioLine(linha, opcoesAtribuicao as any));

      setResult(res);
      setLinhas(linhasExpandidas);
      const naoIdent = linhasExpandidas.filter((l) => l.naoIdentificado).length;
      const emprestimos = novasLinhas.filter((l) => l.isEmprestimo).length;
      showToast("ok", `${res.itens.length} operações detectadas${naoIdent > 0 ? ` — ${naoIdent} sem correspondência no diário` : " — todos identificados"}${emprestimos > 0 ? ` — ${emprestimos} em empréstimo` : ""}`);
    } catch (err: any) {
      showToast("err", err?.message || "Falha ao processar a imagem");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const consolidado = useMemo(() => {
    const total = linhas.reduce((s, l) => s + (l.valor || 0), 0);
    const map = new Map<string, { nome: string; valor: number; itens: number; isEmprestimo: boolean }>();
    for (const l of linhas) {
      const nome = (l.cotistaNome || "").trim();
      if (!nome) continue;
      const cur = map.get(nome) || { nome, valor: 0, itens: 0, isEmprestimo: !!l.isEmprestimo };
      cur.valor += l.valor || 0;
      cur.itens += 1;
      cur.isEmprestimo = cur.isEmprestimo || !!l.isEmprestimo;
      map.set(nome, cur);
    }
    const rows = Array.from(map.values()).map((r) => ({ ...r, percentual: total > 0 ? (r.valor / total) * 100 : 0 }));
    return { total, rows, semAtribuicao: linhas.filter((l) => !l.cotistaNome.trim()).length };
  }, [linhas]);

  const updateLinhaCotista = (idx: number, nome: string, isEmprestimo: boolean) => {
    setLinhas((prev) => prev.map((it, i) => i === idx ? { ...it, cotistaNome: nome, sugeridoDoDiario: false, naoIdentificado: false, isEmprestimo } : it));
  };

  const uploadDemonstrativo = async (): Promise<string | null> => {
    if (!file) return null;
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `demonstrativo_${tipo.toLowerCase()}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("n.f-boletos-clients").upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("n.f-boletos-clients").getPublicUrl(path);
      return data?.publicUrl || null;
    } catch (err) {
      console.error("Erro no upload do demonstrativo:", err);
      return null;
    }
  };

  const criarRecibos = async (demoUrl: string | null): Promise<any[]> => {
    if (!result) return [];

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (userErr || !userId) throw new Error("Usuário não autenticado");

    const today = new Date().toISOString().split("T")[0];
    const tipoLabel = TIPO_LABEL[tipo];
    const descBase = `${tipoLabel} - Doc ${result.numero_documento || "?"}${result.competencia ? " - Comp " + result.competencia : ""}`;
    const createdReceipts: any[] = [];

    for (const row of consolidado.rows) {
      const cotistaMatch = opcoesAtribuicao.find((c) => norm(c.nome) === norm(row.nome));
      const clienteId = (cotistaMatch as any)?.cliente_id || null;
      const socioIdMatch = (cotistaMatch as any)?.socio_id || null;
      const seqNum = await generateSequentialReceiptNumber(row.nome, supabase, clienteId, {
        aeronaveId: aircraftId || null,
        socioId: socioIdMatch,
      });
      const payload = {
        numero_recibo: seqNum,
        usuario_id: userId,
        nome_pagador: row.nome,
        documento_pagador: (cotistaMatch as any)?.documento || "",
        valor: Number(row.valor.toFixed(2)),
        descricao_servico: `${descBase} - Rateio ${row.percentual.toFixed(2)}% (${row.itens} op.)${row.isEmprestimo ? " - Uso por empréstimo de aeronave" : ""}`,
        tipo_recibo: "reembolso",
        data_emissao: today,
        clientes_id: clienteId,
        aeronave_id: aircraftId || null,
        compartilhado: true,
        percentual: Number(row.percentual.toFixed(2)),
        numero_documento: result.numero_documento || null,
        competencia_infraero: tipo === "INFRAERO" ? result.competencia || null : null,
        competencia_decea: tipo === "DECEA" ? result.competencia || null : null,
        demonstrativo_url: demoUrl || null,
        nome_categoria: tipoLabel,
        subcategoria_1: TIPO_SUBCATEGORIA[tipo],
        status: "pendente",
      };

      const { data, error } = await supabase.from("recibos").insert(payload).select("*").single();
      if (error) throw error;

      const receiptData = data as any;
      if (receiptData?.id) {
        const pdfUrl = await generateAndUploadPdf({
          receiptData,
          userId,
        });
        if (pdfUrl) {
          receiptData.pdf_url = pdfUrl;
        }
      }

      createdReceipts.push(receiptData);
    }

    return createdReceipts;
  };

  const criarDespesasEmprestimo = async (demoUrl: string | null): Promise<number> => {
    if (!result) return 0;
    const today = new Date().toISOString().split("T")[0];
    const tipoLabel = TIPO_LABEL[tipo];
    let count = 0;

    for (const row of consolidado.rows.filter((r) => r.isEmprestimo)) {
      const tomador = tomadores.find((t) => norm(t.nome) === norm(row.nome));
      if (!tomador) continue;

      const desc = `${tipoLabel} - Doc ${result.numero_documento || "?"} - Cobrança direta (empréstimo) - ${tomador.nome}`;
      const { error } = await supabase.from("despesas_cliente_direto").insert({
        clientes_id: tomador.cliente_id,
        nome_cliente: tomador.nome,
        aeronave_id: aircraftId,
        aeronave_registro: aeronaves.find((a) => a.id === aircraftId)?.matricula || null,
        categoria_nome: tipoLabel,
        descricao: desc,
        valor: Number(row.valor.toFixed(2)),
        data_vencimento: today,
        fornecedor_nome: TIPO_FORNECEDOR[tipo],
        status: "pendente_envio",
        percentual: 100,
      });
      if (error) throw error;
      count++;
    }
    return count;
  };

  const handleAcao = async (modo: "recibo" | "pgto") => {
    if (!result || consolidado.rows.length === 0) { showToast("err", "Nenhum sócio atribuído"); return; }
    if (consolidado.semAtribuicao > 0) { showToast("err", `${consolidado.semAtribuicao} linha(s) sem atribuição`); return; }
    if (!file) { showToast("err", "Imagem do demonstrativo não encontrada"); return; }
    setGeneratingMode(modo);
    try {
      const demoUrl = await uploadDemonstrativo();

      if (modo === "recibo") {
        const createdReceipts = await criarRecibos(demoUrl);
        const empCount = await criarDespesasEmprestimo(demoUrl);
        setRecibosGerados(createdReceipts);
        showToast("ok", `${createdReceipts.length} recibo(s) criado(s)${empCount > 0 ? ` + ${empCount} cobrança(s) de empréstimo` : ""}`);
        setPerguntarEmail(createdReceipts.length > 0);
        return;
      }

      // modo pgto: criar rateio_despesas + movimentacoes e abrir solicitação de pagamento
      if (modo === "pgto") {
        const demoUrlFinal = demoUrl;
        const today = new Date().toISOString().split("T")[0];
        const tipoLabel = TIPO_LABEL[tipo];
        const subcategoria = TIPO_SUBCATEGORIA[tipo];

        const createdReceipts = await criarRecibos(demoUrlFinal);

        // Valor que entra no rateio dos cotistas (exclui empréstimos)
        const valorCotistas = consolidado.rows.filter((r) => !r.isEmprestimo).reduce((s, r) => s + r.valor, 0);

        if (valorCotistas > 0) {
          const despesaId = crypto.randomUUID();
          const linhasRateio = consolidado.rows
            .filter((r) => !r.isEmprestimo)
            .map((r) => {
              const cotistaMatch = opcoesAtribuicao.find((c) => norm(c.nome) === norm(r.nome));
              const socioId = cotistaMatch && "socio_id" in cotistaMatch ? cotistaMatch.socio_id : null;
              return {
                despesa_id: despesaId,
                fonte_despesa: "demonstrativo",
                fluxo: "saida",
                tipo_rateio: "variavel_por_voo",
                periodicidade: "MENSAL",
                descricao_despesa: `${tipoLabel} - Doc ${result.numero_documento || "?"}${result.competencia ? " - Comp " + result.competencia : ""}`,
                fornecedor_nome: TIPO_FORNECEDOR[tipo],
                categoria_custo: null,
                cliente_id: cotistaMatch?.cliente_id || null,
                socio_id: socioId,
                clientes_nome: r.nome,
                aeronave_id: aircraftId,
                aeronave_registro: aeronaves.find((a) => a.id === aircraftId)?.matricula || null,
                data_emissao: today,
                data_vencimento: today,
                valor_total: valorCotistas,
                valor_rateado: Number(r.valor.toFixed(2)),
                percentual_uso: Number(r.percentual.toFixed(2)),
                numero_doc: result.numero_documento || null,
                demonstrativo_url: demoUrlFinal,
                status: "pendente",
                subcategoria_1: subcategoria,
              };
            });
          const { error: rateioErr } = await supabase.from("rateio_despesas").insert(linhasRateio);
          if (rateioErr) throw rateioErr;

          // Criar movimentacao para o caixa share
          const { error: movimentacaoErr } = await supabase.from("movimentacoes").insert({
            id: despesaId,
            descricao: `${tipoLabel} - Doc ${result.numero_documento || "?"} - ${aeronaves.find((a) => a.id === aircraftId)?.matricula || ""}`,
            fluxo: "saida",
            valor_rateado: valorCotistas,
            percentual_uso: 100,
            data_emissao: today,
            data_vencimento: today,
            aeronave_id: aircraftId,
            reembolsavel: true,
            status: "pendente",
            tipo_caixa: "share",
            numero_doc: result.numero_documento || null,
            demonstrativo_url: demoUrlFinal,
            fornecedor_nome: TIPO_FORNECEDOR[tipo],
          });
          if (movimentacaoErr) throw movimentacaoErr;
        }

        const primeiraReceita = createdReceipts[0];
        const clienteSelecionado = clienteRateioSelecionado
          ? opcoesAtribuicao.find((item) => item.id === clienteRateioSelecionado)
          : null;
        const clientePrincipalId = (clienteSelecionado as any)?.cliente_id || null;
        const clientePrincipalNome = clienteSelecionado?.nome || consolidado.rows[0]?.nome || null;
        const valorPrincipal = consolidado.rows.find((row) => norm(row.nome) === norm(clientePrincipalNome || ""))?.valor || consolidado.total;
        const percentualPrincipal = consolidado.rows.find((row) => norm(row.nome) === norm(clientePrincipalNome || ""))?.percentual || 100;

        setSolicitacaoInitialData({
          data_emissao: today,
          data_vencimento: today,
          tipo_rateio: "variavel_por_voo",
          numero_doc: result.numero_documento || null,
          descricao_despesa: `${tipoLabel} - Doc ${result.numero_documento || "?"}${result.competencia ? " - Comp " + result.competencia : ""}`,
          cliente_id: clientePrincipalId,
          clientes_nome: clientePrincipalNome,
          aeronave_id: aircraftId,
          aeronave_registro: aeronaves.find((a) => a.id === aircraftId)?.matricula || null,
          numero_recibo: primeiraReceita?.numero_recibo || null,
          nome_categoria: tipoLabel,
          subcategoria_1: subcategoria,
          anexos: [
            ...(demoUrlFinal ? [{ tipo: "demonstrativo", url: demoUrlFinal }] : []),
            ...(primeiraReceita?.pdf_url ? [{ tipo: "recibo", url: primeiraReceita.pdf_url }] : []),
          ],
          valor_total: Number(consolidado.total.toFixed(2)),
          valor_rateado: Number(valorPrincipal.toFixed(2)),
          percentual_uso: Number(percentualPrincipal.toFixed(2)),
          competencia_infraero: tipo === "INFRAERO" ? result.competencia || null : null,
          competencia_decea: tipo === "DECEA" ? result.competencia || null : null,
          rateio_cliente: clientePrincipalId ? [{
            cliente_id: clientePrincipalId,
            cliente_nome: clientePrincipalNome,
            valor_total: Number(consolidado.total.toFixed(2)),
            valor_rateado: Number(valorPrincipal.toFixed(2)),
            percentual_uso: Number(percentualPrincipal.toFixed(2)),
            socio_id: null,
          }] : [],
        });
        setRecibosGerados(createdReceipts);
        setSolicitacaoModalOpen(true);

        // Criar despesas_cliente_direto para empréstimos
        const empCount = await criarDespesasEmprestimo(demoUrlFinal);
        showToast("ok", `${createdReceipts.length} recibo(s) criado(s)${empCount > 0 ? ` + ${empCount} cobrança(s) de empréstimo` : ""}`);
      }
    } catch (err: any) {
      showToast("err", err?.message || "Falha desconhecida");
    } finally {
      setGeneratingMode(null);
    }
  };

  const resetForm = () => {
    setFile(null);
    setResult(null);
    setLinhas([]);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isGenerating = generatingMode !== null;

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl ${toast.type === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-rose-500/30 bg-rose-500/10 text-rose-400"}`}>
          {toast.text}
          <button onClick={() => setToast(null)} className="ml-3 text-muted-foreground hover:text-muted-foreground"><Trash2 className="h-3.5 w-3.5 inline" /></button>
        </div>
      )}

      {recibosGerados.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> {recibosGerados.length} recibo(s) gerado(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEmailDialogOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              >
                Enviar por e-mail
              </button>
              <button
                type="button"
                onClick={() => { setRecibosGerados([]); setPerguntarEmail(false); resetForm(); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-card-secondary text-muted-foreground border border-border hover:text-foreground"
              >
                Novo demonstrativo
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            {recibosGerados.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 text-xs text-muted-foreground rounded-lg bg-card/60 border border-border px-3 py-2">
                <span className="font-semibold text-foreground">Nº {r.numero_recibo}</span>
                <span className="truncate flex-1">{r.nome_pagador}</span>
                <span className="text-cyan-400 font-semibold">{brl(Number(r.valor || 0))}</span>
                {r.pdf_url ? (
                  <a href={r.pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300">
                    <FileText className="h-3.5 w-3.5" /> Ver PDF
                  </a>
                ) : (
                  <span className="text-muted-foreground">PDF indisponível</span>
                )}
              </div>
            ))}
          </div>
          {perguntarEmail && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
              <span className="text-xs text-foreground">Deseja enviar o(s) recibo(s) por e-mail agora?</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setPerguntarEmail(false); setEmailDialogOpen(true); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 text-slate-950">Sim, enviar</button>
                <button type="button" onClick={() => setPerguntarEmail(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-card-secondary text-muted-foreground border border-border">Agora não</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
      
        <span className="text-sm font-bold text-foreground">Importar Demonstrativo — Reconhecimento Automático</span>
      </div>


      {/* Upload card */}
      <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Tipo de demonstrativo</label>
            <div className="flex gap-2">
              {(["INFRAERO", "DECEA", "POUSO"] as TipoDemo[]).map((t) => (
                <button key={t} onClick={() => setTipo(t)} className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${tipo === t ? "bg-cyan-500 text-slate-950" : "bg-card-secondary text-muted-foreground hover:text-foreground border border-border"}`}>
                  {TIPO_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Matrícula da aeronave</label>
            <select value={aircraftId} onChange={(e) => setAircraftId(e.target.value)} className="w-full rounded-lg border border-border bg-card/60 px-3 py-2.5 text-sm text-foreground outline-none focus:border-cyan-400">
              <option value="">Selecione a aeronave</option>
              {aeronaves.map((a) => <option key={a.id} value={a.id}>{a.matricula}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Imagem do demonstrativo</label>
          <div className="flex items-center gap-3">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} className="flex-1 text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-card-secondary file:text-foreground hover:file:bg-secondary file:cursor-pointer" />
            <button onClick={handleAnalyze} disabled={!file || isAnalyzing || !aircraftId} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {isAnalyzing ? <Hourglass className="h-4 w-4 animate-spin" /> : null}
              ANALISAR 
            </button>
          </div>
          {previewUrl && (
            <div className="mt-3 inline-block rounded-lg border border-border p-2 bg-card/40">
              <img src={previewUrl} alt="Prévia demonstrativo" className="max-h-40 rounded" />
            </div>
          )}
        </div>
      </div>

      {result && (
        <>
          {/* Dados extraídos */}
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-foreground"><FileImage className="h-4 w-4 text-cyan-400" /> Dados extraídos</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <DataField label="Nº Documento" value={result.numero_documento || "—"} />
              <DataField label="Competência" value={result.competencia || "—"} />
              <DataField label="Matrícula" value={result.aeronave_matricula || "—"} />
              <DataField label="Valor total" value={result.valor_total != null ? brl(result.valor_total) : brl(consolidado.total)} />
            </div>
          </div>

          {/* Operações — atribuição por linha */}
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <div className="text-sm font-semibold text-foreground mb-3">Operações — atribua o sócio/cliente por linha</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Data</th>
                    <th className="px-3 py-2.5 text-left">Hora</th>
                    <th className="px-3 py-2.5 text-left">Operação</th>
                    <th className="px-3 py-2.5 text-right">Valor</th>
                    <th className="px-3 py-2.5 text-left min-w-[220px]">Sócio / Cliente</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, idx) => (
                    <tr key={idx} className="border-t border-border/60">
                      <td className="px-3 py-3 text-muted-foreground">{l.data}</td>
                      <td className="px-3 py-3 text-muted-foreground">{l.hora || "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground text-xs">{l.operacao || "—"}</td>
                      <td className="px-3 py-3 text-right font-medium text-foreground">{brl(l.valor)}</td>
                      <td className="px-3 py-3">
                        <div className="space-y-1.5">
                          <SearchableCotista
                            opcoes={opcoesAtribuicao}
                            value={l.cotistaNome}
                            onChange={(nome, isEmp) => updateLinhaCotista(idx, nome, isEmp)}
                          />
                          {l.sugeridoDoDiario && l.cotistaNome && !l.isEmprestimo && (
                            <div className="flex items-center gap-1 text-[11px] text-emerald-400"><CheckCircle2 className="h-3 w-3" /> Sugerido pelo diário de bordo</div>
                          )}
                          {l.isEmprestimo && l.cotistaNome && (
                            <div className="flex items-center gap-1 text-[11px] text-sky-400"><Repeat className="h-3 w-3" /> Empréstimo — cobrança direta do tomador, fora do rateio</div>
                          )}
                          {l.naoIdentificado && !l.cotistaNome && (
                            <div className="flex items-center gap-1 text-[11px] text-amber-400"><AlertCircle className="h-3 w-3" /> Não identificado no diário — informe manualmente</div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <button onClick={() => setLinhas((prev) => prev.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rateio consolidado */}
          <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-4">
            <div className="text-sm font-semibold text-foreground">Rateio consolidado</div>
            {consolidado.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Atribua os sócios nas linhas acima para ver o rateio.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 text-left">Sócio / Cliente</th>
                      <th className="px-3 py-2.5 text-center">Operações</th>
                      <th className="px-3 py-2.5 text-right">Valor</th>
                      <th className="px-3 py-2.5 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidado.rows.map((r) => (
                      <tr key={r.nome} className="border-t border-border/60">
                        <td className="px-3 py-2.5 font-medium text-foreground">
                          {r.nome}
                          {r.isEmprestimo && <span className="ml-2 text-[10px] text-sky-400 border border-sky-400/30 rounded-full px-2 py-0.5">empréstimo</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center text-muted-foreground">{r.itens}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{brl(r.valor)}</td>
                        <td className="px-3 py-2.5 text-right"><span className="text-xs bg-card-secondary text-muted-foreground rounded-full px-2 py-0.5">{r.percentual.toFixed(2)}%</span></td>
                      </tr>
                    ))}
                    <tr className="border-t border-border">
                      <td className="px-3 py-2.5 font-bold text-foreground">Total</td>
                      <td className="px-3 py-2.5" />
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-foreground">{brl(consolidado.total)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-foreground">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <div className="max-w-md">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Cliente principal para a solicitação</label>
                <SearchableCombobox
                  items={clienteRateioItems}
                  value={clienteRateioSelecionado}
                  onChange={(id) => setClienteRateioSelecionado(id)}
                  placeholder="Selecione o cliente"
                  searchPlaceholder="Buscar cliente..."
                  emptyMessage="Nenhum cliente encontrado"
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2">
                <button onClick={() => handleAcao("recibo")} disabled={isGenerating || consolidado.rows.length === 0 || consolidado.semAtribuicao > 0} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/10 transition-colors disabled:opacity-50">
                  {generatingMode === "recibo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
                  Gerar Recibo
                </button>
                <button onClick={() => handleAcao("pgto")} disabled={isGenerating || consolidado.rows.length === 0 || consolidado.semAtribuicao > 0} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/10 transition-colors disabled:opacity-50">
                  {generatingMode === "pgto" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Enviar para Rateio
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <SolicitacaoPagamentoModal
        open={solicitacaoModalOpen}
        onOpenChange={(v) => {
          setSolicitacaoModalOpen(v);
          if (!v && recibosGerados.length > 0) setPerguntarEmail(true);
        }}
        initialData={solicitacaoInitialData || undefined}
      />

      <EnviarEmailClienteDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        clienteId={solicitacaoInitialData?.cliente_id || null}
        assuntoSugerido={`Recibo${recibosGerados.length > 1 ? "s" : ""} ${recibosGerados.map((r) => r.numero_recibo).join(", ")}`}
        mensagemSugerida={`Olá,\n\nSegue em anexo o(s) recibo(s) referente(s) a ${TIPO_LABEL[tipo]}${result?.numero_documento ? ` - Doc ${result.numero_documento}` : ""}.\n\nAtenciosamente,`}
        anexos={recibosGerados
          .filter((r) => r.pdf_url)
          .map((r) => ({ filename: `recibo-${r.numero_recibo}.pdf`, url: r.pdf_url, label: `Recibo ${r.numero_recibo} — ${r.nome_pagador}` }))}
        tipo="recibo"
        referenceType="recibos"
        referenceIds={recibosGerados.map((r) => r.id).filter(Boolean)}
      />

    </div>
  );
}

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-medium text-foreground">{value}</div>
    </div>
  );
}

function SearchableCotista({ opcoes, value, onChange }: { opcoes: (Cotista | Tomador)[]; value: string; onChange: (nome: string, isEmprestimo: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = opcoes.filter((o) => o.nome.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="w-full px-3 py-2 rounded-lg border border-border bg-card/60 text-xs text-left flex items-center justify-between outline-none focus:border-cyan-400 transition-colors">
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {(() => {
            const sel = opcoes.find((o) => o.nome === value);
            return sel ? (sel as any).isEmprestimo ? `${sel.nome} (empréstimo)` : sel.nome : "Selecione";
          })()}
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setQuery(""); }} />
          <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-border">
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cotista…" className="w-full px-2 py-1.5 bg-card-secondary border border-border rounded text-xs text-foreground outline-none focus:border-cyan-400" />
            </div>
            <div className="max-h-40 overflow-y-auto">
              {filtered.length === 0 ? <p className="px-3 py-3 text-xs text-muted-foreground text-center">Nenhum resultado</p> :
                filtered.map((o) => (
                  <button key={o.id} type="button" onClick={() => { onChange(o.nome, !!(o as any).isEmprestimo); setOpen(false); setQuery(""); }} className={`w-full px-3 py-2 text-xs text-left hover:bg-card-secondary transition-colors ${o.nome === value ? "text-cyan-400 bg-cyan-500/10" : "text-foreground"}`}>
                    {(o as any).isEmprestimo ? `${o.nome} (empréstimo)` : o.nome}
                  </button>
                ))
              }
            </div>
          </div>
        </>
      )}
    </div>
  );
}
