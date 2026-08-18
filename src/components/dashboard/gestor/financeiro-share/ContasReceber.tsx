import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Search, Filter, Trash2, Edit2, TrendingUp, CheckCircle2,
  DollarSign, X, Upload, FileText, Lock, Clock, AlertTriangle, Bell
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useAeronaves } from "@/hooks/useAeronaves";
import { toast } from "sonner";
import { format, parseISO, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useColumnWidths } from "@/hooks/useColumnWidths";
import { ChevronDown } from "lucide-react";
import { baixarReceitaShare } from "@/lib/receitaShareSync";

const parseLocalDate = (dateString: string | null | undefined): Date | null => {
  if (!dateString) return null;
  // Aceita tanto "2026-01-08" quanto timestamps completos ("2026-01-08T10:12:27+00:00"
  // ou "2026-01-08 10:12:27") — pega só a parte da data antes de extrair ano/mês/dia.
  const datePart = dateString.split('T')[0].split(' ')[0];
  const parts = datePart.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDateSafe = (dateString: string | null | undefined): string => {
  const d = parseLocalDate(dateString);
  return d ? format(d, "dd/MM/yyyy") : "—";
};

// Skeleton Loading Component
function TableSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm p-5">
            <Skeleton className="h-4 w-28 mb-3" />
            <Skeleton className="h-8 w-36" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden">
        <div className="p-5 border-b border-border/40">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function ContasReceber() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { aeronaves, isLoadingAeronaves } = useAeronaves();
  const defaultColumnWidths = {
    doc: 80,
    categoria: 140,
    cliente: 140,
    descricao: 180,
    vencimento: 110,
    valor: 130,
    status: 110,
    acoes: 90
  };
  const { columnWidths, setColumnWidth } = useColumnWidths('contas-receber', defaultColumnWidths);

  const [contas, setContas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [isUploadingPDF, setIsUploadingPDF] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [aeronaveSearch, setAeronaveSearch] = useState("");
  const [openAeronavePopover, setOpenAeronavePopover] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [selectedBank, setSelectedBank] = useState("");
  const [contasReceberData, setContasReceberData] = useState<any>(null);
  const [contasBancarias, setContasBancarias] = useState<any[]>([]);
  const [editingConta, setEditingConta] = useState<any>(null);
  const [dataRecebimento, setDataRecebimento] = useState(new Date().toISOString().split("T")[0]);
  const [metodo_pagamento, setMetodo_pagamento] = useState("");
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);
  const [isUploadingComprovante, setIsUploadingComprovante] = useState(false);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [showPdfViewerDialog, setShowPdfViewerDialog] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string>("");
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const [formData, setFormData] = useState({
    numero: "",
    cliente_nome: "",
    cliente_cnpj: "",
    data_criacao: new Date().toISOString().split("T")[0],
    data_vencimento: "",
    valor: "",
    categoria: "Serviços",
    descricao: "",
    status: "pendente",
    aeronave: "",
    referencia: ""
  });

  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const getCurrentYear = () => {
    return new Date().getFullYear().toString();
  };

  // periodo agora aceita: "todos" | "mes" — simplificado para Jan-Dez como Despesas Particulares
  const [filters, setFilters] = useState({
    searchTerm: "",
    status: "nao_recebido",
    mes: null as number | null,
  });

  useEffect(() => {
    loadContas();
    loadClients();
    loadCategorias();
    loadContasBancarias();
  }, []);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase.from("clientes").select("id, razao_social, cnpj").order("razao_social");
      if (error) {
        console.error("Erro ao carregar clientes:", error);
        return;
      }
      setClients(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar clientes:", error.message);
    }
  };

  const loadCategorias = async () => {
    try {
      const { data, error } = await supabase.from("categorias_movimentacao").select("id, nome").eq("tipo", "receita").order("nome");
      if (error) {
        console.error("Erro ao carregar categorias:", error);
        return;
      }
      setCategorias(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar categorias:", error.message);
    }
  };

  const loadContasBancarias = async () => {
    try {
      const { data, error } = await supabase.from("contas_bancarias").select("id, banco, numero_conta, tipo_conta").eq("ativo", true).order("banco");
      if (error) {
        console.error("Erro ao carregar contas bancárias:", error);
        toast.error("Erro ao carregar contas bancárias");
        return;
      }
      const filteredData = (data || []).filter((conta) => conta.banco && conta.banco.trim() !== "");
      setContasBancarias(filteredData);
    } catch (error: any) {
      console.error("Erro ao carregar contas bancárias:", error.message);
      toast.error("Erro ao carregar contas bancárias");
    }
  };

  const loadContas = async () => {
    setIsLoading(true);
    try {
      const { data: contasData, error: contasError } = await (supabase.from("contas_areceber") as any)
        .select("*")
        .order("data_vencimento")
        .limit(5000);

      if (contasError) {
        toast.error(`Erro ao carregar: ${contasError.message}`);
        return;
      }

      const contasList = (contasData || []).map((conta: any) => {
        const referencia = conta.movimentacao_id
          ? (conta.descricao || "")
          : (conta.descricao || "");

        return {
          ...conta,
          referencia,
          data_vencimento: conta.data_vencimento || null,
          isFromBankReconciliation: false,
          bankReconciliationId: null,
        };
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const contasVencidas = contasList.filter((conta: any) => {
        if (conta.status !== "pendente") return false;
        const vencimento = parseLocalDate(conta.data_vencimento);
        return vencimento !== null && vencimento < today;
      });

      for (const conta of contasVencidas) {
        conta.status = "inadimplente";
      }

      setContas(contasList);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar contas a receber");
    }
    setIsLoading(false);
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Por favor, selecione um arquivo PDF");
      return;
    }

    setIsUploadingPDF(true);
    try {
      const fileName = `nf_areceber_${Date.now()}_${formData.numero || 'sem_numero'}.pdf`;
      const { error: uploadError } = await supabase.storage.from("nfs-share-saida").upload(fileName, file);

      if (uploadError) {
        toast.error(`Erro ao fazer upload: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("nfs-share-saida").getPublicUrl(fileName);
      setPdfUrl(publicUrlData.publicUrl);
      toast.success("Arquivo enviado com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar arquivo");
    } finally {
      setIsUploadingPDF(false);
    }
  };

  const handleSaveForm = async () => {
    if (!formData.numero || !formData.cliente_nome || !formData.valor || !formData.data_vencimento) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setIsSavingForm(true);
    try {

      if (editingConta) {
        // Nota: "referencia" não é uma coluna de contas_areceber — ela é derivada em
        // loadContas() a partir de movimentacao_id, então não é enviada no update.
        const { error } = await supabase.from("contas_areceber").update({
          numero: formData.numero,
          cliente_nome: formData.cliente_nome,
          cliente_cnpj: formData.cliente_cnpj || "",
          data_vencimento: formData.data_vencimento,
          valor: parseFloat(formData.valor),
          categoria: formData.categoria || "Serviços",
          descricao: formData.descricao || null,
          status: (formData as any).status || formData.status,
          arquivo_pdf_url: pdfUrl || null,
          aeronave: formData.aeronave || null,
          atualizado_em: new Date().toISOString()
        }).eq("id", editingConta.id);

        if (error) {
          toast.error(`Erro ao atualizar: ${error.message}`);
          return;
        }
        toast.success("Conta a receber atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("contas_areceber").insert([{
          numero: formData.numero,
          cliente_nome: formData.cliente_nome,
          cliente_cnpj: formData.cliente_cnpj || "",
          data_criacao: formData.data_criacao,
          data_vencimento: formData.data_vencimento,
          valor: parseFloat(formData.valor),
          categoria: formData.categoria || "Serviços",
          descricao: formData.descricao || null,
          status: editingConta ? ((formData as any).status || formData.status) : "pendente",
          arquivo_pdf_url: pdfUrl || null,
          criado_por: user?.id,
          aeronave: formData.aeronave || null
        }]);

        if (error) {
          toast.error(`Erro ao salvar: ${error.message}`);
          return;
        }
        toast.success("Conta a receber criada com sucesso!");
      }

      setShowFormDialog(false);
      resetForm();
      loadContas();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar conta a receber");
    } finally {
      setIsSavingForm(false);
    }
  };

  const handleEditConta = (conta: any) => {
    
    setEditingConta(conta);
    setFormData({
      numero: conta.numero || "",
      cliente_nome: conta.cliente_nome || "",
      cliente_cnpj: conta.cliente_cnpj || "",
      data_criacao: conta.data_criacao || new Date().toISOString().split("T")[0],
      data_vencimento: conta.data_vencimento || "",
      valor: conta.valor?.toString() || "",
      categoria: conta.categoria || "Serviços",
      descricao: conta.descricao || "",
      status: conta.status || "pendente",
      aeronave: conta.aeronave || "",
      referencia: conta.referencia || ""
    });
    setPdfUrl(conta.arquivo_pdf_url || "");
    setShowFormDialog(true);
  };

  const resetForm = () => {
    setFormData({
      numero: "",
      cliente_nome: "",
      cliente_cnpj: "",
      data_criacao: new Date().toISOString().split("T")[0],
      data_vencimento: "",
      valor: "",
      categoria: "Serviços",
      descricao: "",
      status: "pendente",
      aeronave: "",
      referencia: ""
    });
    setPdfUrl("");
    setAeronaveSearch("");
    setEditingConta(null);
  };

  const availableMonths = useMemo(() => {
    const months = new Set<number>();
    contas.forEach(c => {
      if (c.data_vencimento) {
        const idx = Number(String(c.data_vencimento).slice(5, 7)) - 1;
        if (idx >= 0 && idx < 12) months.add(idx);
      }
    });
    return Array.from(months).sort((a, b) => a - b);
  }, [contas]);

  const filteredContas = useMemo(() => {
    return contas.filter((conta) => {
      const searchMatch = filters.searchTerm === "" ||
        (conta.cliente_nome || "").toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        (conta.numero || "").toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        (conta.referencia && conta.referencia.toLowerCase().includes(filters.searchTerm.toLowerCase()));

      const filterStatus = (filters as any).status || filters.status;
      const contaStatus = (conta as any).status || conta.status;
      const statusMatch =
        filterStatus === "all"
          ? true
          : filterStatus === "nao_recebido"
          ? contaStatus !== "recebido"
          : contaStatus === filterStatus;

      const mesMatch = filters.mes === null || (conta.data_vencimento && Number(String(conta.data_vencimento).slice(5, 7)) - 1 === filters.mes);

      return searchMatch && statusMatch && mesMatch;
    });
  }, [contas, filters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredContas.length / rowsPerPage));
  const paginatedContas = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredContas.slice(start, start + rowsPerPage);
  }, [currentPage, filteredContas, rowsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const totals = useMemo(() => {
    return filteredContas.reduce((sum, conta) => sum + parseFloat(conta.valor), 0);
  }, [filteredContas]);

  const contasPendentes = useMemo(() => {
    return filteredContas.filter((c) => c.status !== "recebido").length;
  }, [filteredContas]);

  const proximoVencimento = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureContas = filteredContas
      .filter((conta) => {
        const d = parseLocalDate(conta.data_vencimento);
        return d !== null && d >= today && conta.status !== "recebido";
      })
      .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime());

    return futureContas.length > 0 ? futureContas[0].data_vencimento : null;
  }, [filteredContas]);

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    const contaToDelete = contas.find((c) => c.id === deleteConfirmId);

    try {
      const { error } = await supabase.from("contas_areceber").delete().eq("id", deleteConfirmId);

      if (error) {
        toast.error(`Erro ao deletar: ${error.message}`);
        return;
      }

      toast.success("Conta a receber deletada com sucesso!");
      setDeleteConfirmId(null);
      loadContas();
    } catch (error: any) {
      toast.error(error.message || "Erro ao deletar");
    }
  };

  const handleChangeStatus = async (contaId: string, newStatus: string) => {
    const conta = contas.find((c) => c.id === contaId);

    if (newStatus === "recebido") {
      setContasReceberData(conta);
      setSelectedBank("");
      setDataRecebimento(new Date().toISOString().split("T")[0]);
      setComprovanteFile(null);
      setShowBankDialog(true);
      return;
    }

    try {
      console.log("Atualizando status de conta_areceber", { contaId, newStatus });

      const { data: changed, error } = await supabase.from("contas_areceber").update({ status: newStatus, atualizado_em: new Date().toISOString() }).eq("id", contaId).select("id,status");
      console.log("contas_areceber.update status result:", { contaId, newStatus, changed, error });

      if (error) {
        toast.error(`Erro ao atualizar: ${error.message}`);
        return;
      }

      if (!changed || (Array.isArray(changed) && changed.length === 0)) {
        toast.warning("Status atualizado, mas nenhuma linha retornada. Verifique permissões/RLS ou o id.");
      }

      toast.success("Status atualizado com sucesso!");
      loadContas();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar status");
    }
  };


  const handleMarkAsReceived = async () => {
    if (!contasReceberData) return;

    if (!selectedBank) {
      toast.error("Selecione um banco para registrar o recebimento");
      return;
    }

    if (!dataRecebimento) {
      toast.error("Informe a data do recebimento");
      return;
    }

    const contaBancariaSelected = contasBancarias.find((c) => c.id === selectedBank);
    const nomeBanco = contaBancariaSelected?.banco || selectedBank;

    setIsUploadingComprovante(true);
    let comprovanteUrl = "";

    try {
      if (comprovanteFile) {
        const timestamp = Date.now();
        const sanitizedFileName = comprovanteFile.name
          .replace(/[^a-zA-Z0-9.\-_]/g, "_")
          .substring(0, 100);
        const fileExt = sanitizedFileName.split('.').pop();
        const fileName = `comprovante_recebimento_${timestamp}_${contasReceberData.numero || 'sem_numero'}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.from("nfs-share-saida").upload(fileName, comprovanteFile);

        if (uploadError) {
          console.error("Erro ao fazer upload do comprovante:", uploadError);
          toast.warning("Não foi possível enviar o comprovante, mas continuaremos com o registro.");
        } else {
          const { data: publicUrlData } = supabase.storage.from("nfs-share-saida").getPublicUrl(fileName);
          comprovanteUrl = publicUrlData.publicUrl;
        }
      }

      // `controle_bancario` foi removido; a baixa acontece em `contas_areceber`
      // e/ou diretamente em `movimentacoes` (linhas virtuais da conciliação).

      const updateData: any = {
        status: "recebido",
        data_recebimento: dataRecebimento,
        banco_recebimento: nomeBanco,
        metodo_pagamento: metodo_pagamento || null,
        atualizado_em: new Date().toISOString()
      };

      if (comprovanteUrl) {
        updateData.comprovante_recebimento_url = comprovanteUrl;
      }

      let baixouAlgo = false;

      const { data: updatedRows, error: updateError } = await supabase
        .from("contas_areceber")
        .update(updateData)
        .eq("id", contasReceberData.id)
        .select("id,status,data_recebimento");

      if (updateError) throw updateError;
      baixouAlgo = !!updatedRows?.length;

      // Propaga a baixa para todas as pernas (movimentação share, espelho no
      // caixa do cliente, rateio por cotista) com o banco de entrada.
      const sync = await baixarReceitaShare({
        movId: contasReceberData.movimentacao_id || null,
        contasAreceberId: contasReceberData.id,
        data: dataRecebimento,
        valorRecebido: Number(contasReceberData.valor) || null,
        banco: nomeBanco,
        bancoId: selectedBank || null,
        comprovante: comprovanteUrl || null,
        formaPagamento: metodo_pagamento || null,
        isReembolso: String(contasReceberData.reference_type || "").includes("reembolso"),
      });
      baixouAlgo = baixouAlgo || !!sync.movId || sync.movClienteIds.length > 0;

      if (!baixouAlgo) {
        throw new Error(
          "Nenhum registro foi atualizado. Verifique se o lançamento ainda existe ou se você tem permissão para alterá-lo."
        );
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contas-receber"] }),
        queryClient.invalidateQueries({ queryKey: ["movimentacoes"] }),
        queryClient.invalidateQueries({ queryKey: ["financeiro-cotista-detalhe"] }),
        queryClient.invalidateQueries({ queryKey: ["rateio-despesas"] }),
      ]);

      toast.success("Conta marcada como recebida!");
      resetBankDialog();
      await loadContas();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await loadContas();
    } catch (error: any) {
      console.error("Erro ao marcar como recebido:", error);
      toast.error(error.message || "Erro ao marcar como recebido");
    } finally {
      setIsUploadingComprovante(false);
    }
  };

  const resetBankDialog = () => {
    setShowBankDialog(false);
    setContasReceberData(null);
    setSelectedBank("");
    setDataRecebimento(new Date().toISOString().split("T")[0]);
    setMetodo_pagamento("");
    setComprovanteFile(null);
  };

  const toggleRowExpand = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "recebido":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      case "pendente":
        return "bg-primary/15 text-primary border-primary/30";
      case "inadimplente":
        return "bg-destructive/15 text-destructive border-destructive/30";
      case "cancelado":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "recebido":
        return <CheckCircle2 className="w-4 h-4" />;
      case "pendente":
        return <Clock className="w-4 h-4" />;
      case "inadimplente":
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return <TableSkeleton />;
  }

  if (!filteredContas.length && contas.length === 0) {
    return (
      <div className="space-y-5">
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <motion.div whileHover={{ y: -4 }}>
          <Card className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl shadow-lg shadow-emerald-500/10 hover:border-white/20 transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Total a Receber</p>
                <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-emerald-400">
                {brlFmt.format(totals)}
              </p>
              <div className="mt-1 text-[11px] text-foreground/50">
                {filteredContas.length} de {contas.length} lançamentos
                {filters.mes !== null && ` • ${MESES[filters.mes]}`}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} transition={{ delay: 0.1 }}>
          <Card className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl shadow-lg shadow-primary/10 hover:border-white/20 transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Contas Pendentes</p>
                <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold text-primary">{contasPendentes}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} transition={{ delay: 0.2 }}>
          <Card className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl shadow-lg shadow-purple-500/10 hover:border-white/20 transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Próximo Recebimento</p>
                <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
                  <Bell className="w-4 h-4 text-purple-400" />
                </div>
              </div>
              <p className="text-lg font-bold text-purple-400">
                {proximoVencimento ? formatDateSafe(proximoVencimento) : "—"}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Filters Card */}
      <Card className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm">
        <CardHeader className="pb-4 pt-5 px-5 border-b border-border/40">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            Filtros
          </h3>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por cliente ou documento..."
                value={filters.searchTerm}
                onChange={(e) => setFilters((prev) => ({ ...prev, searchTerm: e.target.value }))}
                className="pl-9 bg-background/50 border-border/40"
              />
            </div>
            <Select value={(filters as any).status || filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger className="w-full md:w-[180px] bg-background/50 border-border/40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="nao_recebido">Não recebidas</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="inadimplente">Vencida</SelectItem>
                <SelectItem value="aguardando_reembolso">Aguardando reembolso</SelectItem>
                <SelectItem value="recebido">Recebido</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Mês</label>
              <select
                value={filters.mes ?? ""}
                onChange={(e) => setFilters((prev) => ({ ...prev, mes: e.target.value === "" ? null : Number(e.target.value) }))}
                className="h-9 w-full md:w-[160px] rounded-md border border-input bg-background/50 px-3 text-sm outline-none transition-colors focus:border-primary"
              >
                <option value="">Todos os meses</option>
                {availableMonths.map((idx) => (
                  <option key={idx} value={idx}>{MESES[idx]}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-4 pt-5 px-5 border-b border-border/40">
          <h3 className="font-semibold text-foreground">
            Contas a Receber
            <span className="text-muted-foreground font-normal ml-2 text-sm">
              ({filteredContas.length} registro{filteredContas.length !== 1 ? "s" : ""})
            </span>
          </h3>
        </CardHeader>
        <CardContent className="p-0">
          {filteredContas.length === 0 ? (
            <div className="text-center py-16 px-5">
              <p className="text-muted-foreground font-medium">Nenhuma conta a receber encontrada</p>
              <p className="text-xs text-muted-foreground mt-2">Registre receitas no Fluxo de Caixa ou ajuste os filtros acima</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Data</TableHead>
                    <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Cliente</TableHead>
                    <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Descrição</TableHead>
                    <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-right">Valor</TableHead>
                    <TableHead className="text-muted-foreground text-xs uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-muted-foreground text-xs uppercase tracking-wider text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedContas.map((conta) => (
                    <TableRow key={conta.id} className="border-border/40 hover:bg-muted/20 transition-colors">
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateSafe(conta.data_vencimento)}
                      </TableCell>
                      <TableCell className="font-medium text-foreground text-sm">{conta.cliente_nome}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-xs truncate">{conta.descricao || "—"}</TableCell>
                      <TableCell className="text-emerald-400 font-semibold text-sm text-right">
                        R$ {parseFloat(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(conta.status)} border text-xs gap-1`}>
                          {getStatusIcon(conta.status)}
                          {conta.status === "recebido" ? "Recebido" : conta.status === "pendente" ? "Pendente" : conta.status === "inadimplente" ? "Vencida" : conta.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {conta.arquivo_pdf_url && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => {
                                      setPdfViewerUrl(conta.arquivo_pdf_url);
                                      setShowPdfViewerDialog(true);
                                    }}
                                    className="text-muted-foreground hover:text-primary p-1 transition-colors"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Ver PDF</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleEditConta(conta)}
                                    className="text-muted-foreground hover:text-primary p-1 transition-colors"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Editar</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => setDeleteConfirmId(conta.id)}
                                    className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Excluir</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </>
                          {conta.status !== "recebido" && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleChangeStatus(conta.id, "recebido")}
                                    className="text-muted-foreground hover:text-emerald-400 p-1 transition-colors"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Dar Baixa</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {filteredContas.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-border/40">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Page</span>
                <Input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => setCurrentPage(Math.min(totalPages, Math.max(1, Number(e.target.value) || 1)))}
                  className="h-8 w-14 text-center"
                />
                <span>of {totalPages}</span>
                <Select value={String(rowsPerPage)} onValueChange={(value) => setRowsPerPage(Number(value))}>
                  <SelectTrigger className="h-8 w-[108px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100, 200].map((rows) => <SelectItem key={rows} value={String(rows)}>{rows} rows</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground">
                {Math.min((currentPage - 1) * rowsPerPage + 1, filteredContas.length)}–{Math.min(currentPage * rowsPerPage, filteredContas.length)} de {filteredContas.length}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog (mantido apenas para edição de contas manuais) */}
      <Dialog open={showFormDialog} onOpenChange={(open) => { if (!open) { setShowFormDialog(false); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Conta a Receber</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Documento *</label>
                <Input
                  placeholder="Ex: NF-1024"
                  value={formData.numero}
                  onChange={(e) => setFormData((prev) => ({ ...prev, numero: e.target.value }))}
                  className="bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Cliente *</label>
                <AutocompleteInput
                  value={formData.cliente_nome}
                  onChange={(value) => setFormData((prev) => ({ ...prev, cliente_nome: value }))}
                  onSelect={(option) => {
                    const client = clients.find((c) => c.id === option.id);
                    if (client) {
                      setFormData((prev) => ({
                        ...prev,
                        cliente_nome: client.razao_social,
                        cliente_cnpj: client.cnpj || ""
                      }));
                    }
                  }}
                  options={clients.map((c) => ({
                    id: c.id,
                    label: c.razao_social
                  }))}
                  placeholder="Selecione ou digite o cliente"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Data Emissão</label>
                <Input
                  type="date"
                  value={formData.data_criacao}
                  onChange={(e) => setFormData((prev) => ({ ...prev, data_criacao: e.target.value }))}
                  className="bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Data Vencimento *</label>
                <Input
                  type="date"
                  value={formData.data_vencimento}
                  onChange={(e) => setFormData((prev) => ({ ...prev, data_vencimento: e.target.value }))}
                  className="bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Valor (R$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.valor}
                  onChange={(e) => setFormData((prev) => ({ ...prev, valor: e.target.value }))}
                  className="bg-background"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Descrição</label>
              <Input
                placeholder="Descrição da conta a receber"
                value={formData.descricao}
                onChange={(e) => setFormData((prev) => ({ ...prev, descricao: e.target.value }))}
                className="bg-background"
              />
            </div>

            <p className="text-xs text-muted-foreground">* Campos obrigatórios</p>
          </div>

          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => { setShowFormDialog(false); resetForm(); }}
              disabled={isSavingForm || isUploadingPDF}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveForm}
              disabled={isSavingForm || isUploadingPDF}
            >
              {isSavingForm ? "Salvando..." : "Atualizar Conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer Dialog */}
      <Dialog open={showPdfViewerDialog} onOpenChange={setShowPdfViewerDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Visualizar PDF</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-gray-900 rounded-lg">
            {pdfViewerUrl && (
              <iframe
                src={pdfViewerUrl}
                className="w-full h-full border-0 rounded-lg"
                title="PDF Viewer"
              />
            )}
          </div>
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowPdfViewerDialog(false)}>
              Fechar
            </Button>
            {pdfViewerUrl && (
              <a href={pdfViewerUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button className="w-full bg-primary hover:bg-primary/90">
                  Abrir em Nova Aba
                </Button>
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bank Dialog */}
      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar Recebimento</DialogTitle>
          </DialogHeader>

          {contasReceberData && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Cliente</p>
                <p className="font-semibold text-foreground">{contasReceberData.cliente_nome}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Valor: R$ {parseFloat(contasReceberData.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">Banco de Recebimento *</label>
                  <Select value={selectedBank} onValueChange={setSelectedBank}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecione um banco" />
                    </SelectTrigger>
                    <SelectContent>
                      {contasBancarias.map((conta) => (
                        <SelectItem key={conta.id} value={conta.id}>
                          {conta.banco}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">Data do Recebimento *</label>
                  <Input
                    type="date"
                    value={dataRecebimento}
                    onChange={(e) => setDataRecebimento(e.target.value)}
                    className="bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Comprovante (Opcional)</label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setComprovanteFile(file);
                        toast.success(`Arquivo selecionado: ${file.name}`);
                      }
                    }}
                    className="bg-background"
                    disabled={isUploadingComprovante}
                  />
                </div>
                {comprovanteFile && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Arquivo selecionado: {comprovanteFile.name}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={resetBankDialog} disabled={isUploadingComprovante}>
              Cancelar
            </Button>
            <Button
              onClick={handleMarkAsReceived}
              disabled={isUploadingComprovante}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isUploadingComprovante ? "Processando..." : "Confirmar Recebimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground py-4">Deseja realmente deletar esta conta a receber? Esta ação não pode ser desfeita.</p>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Deletar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}