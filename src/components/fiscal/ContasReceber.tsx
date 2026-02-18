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

const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
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

export function ContasReceber() {
  const { user } = useAuth();
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

  const [filters, setFilters] = useState({
    searchTerm: "",
    status: "all",
    periodo: "mes",
    mes: getCurrentMonth(),
    ano: getCurrentYear()
  });

  useEffect(() => {
    loadContas();
    loadClients();
    loadCategorias();
    loadContasBancarias();
  }, []);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase.from("clients").select("id, company_name, cnpj").order("company_name");
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
      const { data: despesasReembolso, error: fluxoError } = await supabase.from("controle_bancario").select(`
        id, data, data_vencimento, descricao, valor, status, client_id, client_name,
        aeronave_registro, numero_documento, grupo_categoria, comprovante_url, nf_url, boleto_url,
        fornecedores_favoritos_id, colaborador_id
      `).eq("status", "aguardando_reembolso").not("data_vencimento", "is", null).order("data_vencimento");

      if (fluxoError) {
        console.error("Erro ao carregar despesas:", fluxoError);
      }

      const { data: bankRecData, error: bankRecError } = await supabase.from("bank_reconciliations").select(`
        id, date, description, amount, saldo_pendente, status, client_id, aircraft_id, category,
        prazo_pagamento, boleto_url, nf_url, comprovante_url, controle_bancario_id,
        clients:client_id (company_name), aircraft:aircraft_id (registration)
      `).eq("type", "cliente").is("controle_bancario_id", null).in("status", ["pendente", "enviado", "aberto"]).neq("status", "recebido").order("date", { ascending: false });

      if (bankRecError) {
        console.error("Erro ao carregar bank_reconciliations:", bankRecError);
      }

      const fornecedorIds = (despesasReembolso || []).filter((d) => d.fornecedores_favoritos_id).map((d) => d.fornecedores_favoritos_id);
      const colaboradorIds = (despesasReembolso || []).filter((d) => d.colaborador_id).map((d) => d.colaborador_id);

      let fornecedoresMap: Record<string, string> = {};
      let colaboradoresMap: Record<string, string> = {};

      if (fornecedorIds.length > 0) {
        const { data: fornecedores } = await supabase.from("fornecedores_favoritos").select("id, nome_completo").in("id", fornecedorIds);
        fornecedores?.forEach((f) => {
          fornecedoresMap[f.id] = f.nome_completo;
        });
      }

      if (colaboradorIds.length > 0) {
        const { data: colaboradores } = await supabase.from("user_profiles").select("id, full_name").in("id", colaboradorIds);
        colaboradores?.forEach((c) => {
          colaboradoresMap[c.id] = c.full_name || "";
        });
      }

      const contasFromFluxo = (despesasReembolso || []).map((despesa) => {
        let referencia = "";
        if (despesa.fornecedores_favoritos_id && fornecedoresMap[despesa.fornecedores_favoritos_id]) {
          referencia = fornecedoresMap[despesa.fornecedores_favoritos_id];
        } else if (despesa.colaborador_id && colaboradoresMap[despesa.colaborador_id]) {
          referencia = colaboradoresMap[despesa.colaborador_id];
        } else if (despesa.client_name) {
          referencia = despesa.client_name;
        }

        return {
          id: despesa.id,
          numero: despesa.numero_documento || `FC-${despesa.id.slice(0, 8)}`,
          cliente_nome: despesa.client_name || "Cliente não especificado",
          cliente_cnpj: "",
          data_criacao: despesa.data,
          data_vencimento: despesa.data_vencimento,
          valor: despesa.valor,
          categoria: despesa.grupo_categoria || "Reembolso",
          descricao: despesa.descricao,
          status: "pendente",
          arquivo_pdf_url: despesa.nf_url || despesa.comprovante_url,
          aeronave: despesa.aeronave_registro,
          referencia: referencia,
          isFromFluxoCaixa: true,
          fluxoCaixaId: despesa.id
        };
      });

      const contasFromBankRec = (bankRecData || []).map((rec: any) => {
        const clientName = rec.clients?.company_name || "Cliente não especificado";
        const aircraftReg = rec.aircraft?.registration || "";
        const valor = Math.abs(rec.saldo_pendente ?? rec.amount ?? 0);

        return {
          id: rec.id,
          numero: `BR-${rec.id.slice(0, 8)}`,
          cliente_nome: clientName,
          cliente_cnpj: "",
          data_criacao: rec.date,
          data_vencimento: rec.prazo_pagamento || rec.date,
          valor: valor,
          categoria: rec.category || "Despesa Cliente",
          descricao: rec.description,
          status: rec.status || "pendente",
          arquivo_pdf_url: rec.nf_url || rec.comprovante_url || rec.boleto_url,
          aeronave: aircraftReg,
          referencia: rec.description,
          isFromBankReconciliation: true,
          bankReconciliationId: rec.id
        };
      });

      const { data: contasData, error: contasError } = await (supabase.from("contas_areceber") as any).select("*").neq("status", "recebido").order("data_vencimento");

      if (contasError) {
        toast.error(`Erro ao carregar: ${contasError.message}`);
        return;
      }

      const fluxoIds = new Set(contasFromFluxo.map((c) => c.id));
      const bankRecIds = new Set(contasFromBankRec.map((c) => c.id));

      const contasManuals = await Promise.all(
        (contasData || []).map(async (conta) => {
          const isAlreadyImported = fluxoIds.has(conta.id) || bankRecIds.has(conta.id);

          let referencia = conta.referencia || "";
          let dataVencimentoFromBanco = conta.data_vencimento;
          let isFromBankRec = false;

          if (conta.banco_conciliacao_id) {
            const { data: bancarioData } = await supabase.from("bank_reconciliations").select("description, date").eq("id", conta.banco_conciliacao_id).single();

            if (bancarioData) {
              referencia = bancarioData.description || referencia;
              isFromBankRec = true;
            }
          }

          return {
            ...conta,
            referencia,
            data_vencimento: dataVencimentoFromBanco,
            isAlreadyImported,
            isFromBankReconciliation: isFromBankRec
          };
        })
      );

      const contasManuaisFiltradas = contasManuals.filter((c) => !c.isAlreadyImported);

      const allIds = new Set<string>();
      const duplicateIds = new Set<string>();

      const checkDuplicates = (id: string) => {
        if (allIds.has(id)) {
          duplicateIds.add(id);
        }
        allIds.add(id);
      };

      contasFromFluxo.forEach((c) => checkDuplicates(c.id));
      contasFromBankRec.forEach((c) => checkDuplicates(c.id));
      contasManuaisFiltradas.forEach((c) => checkDuplicates(c.id));

      if (duplicateIds.size > 0) {
        toast.warning(`Aviso: ${duplicateIds.size} registro(s) duplicado(s) detectado(s).`);
      }

      const todasContas = [...contasFromFluxo, ...contasFromBankRec, ...contasManuaisFiltradas];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const contasVencidas = todasContas.filter((conta) => {
        if (conta.status !== "pendente") return false;
        const vencimento = parseLocalDate(conta.data_vencimento);
        return vencimento < today;
      });

      for (const conta of contasVencidas) {
        if ((conta as any).isFromFluxoCaixa) {
          await supabase.from("controle_bancario").update({ status: "inadimplente" }).eq("id", (conta as any).fluxoCaixaId || conta.id);
        } else {
          await supabase.from("contas_areceber").update({ status: "inadimplente" }).eq("id", conta.id);
        }
        conta.status = "inadimplente";
      }

      setContas(todasContas);
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
        const { error } = await supabase.from("contas_areceber").update({
          numero: formData.numero,
          cliente_nome: formData.cliente_nome,
          cliente_cnpj: formData.cliente_cnpj || "",
          data_vencimento: formData.data_vencimento,
          valor: parseFloat(formData.valor),
          categoria: formData.categoria || "Serviços",
          descricao: formData.descricao || null,
          status: formData.status,
          arquivo_pdf_url: pdfUrl || null,
          aeronave: formData.aeronave || null,
          referencia: formData.referencia || null,
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
          status: formData.status,
          arquivo_pdf_url: pdfUrl || null,
          criado_por: user?.id,
          aeronave: formData.aeronave || null,
          referencia: formData.referencia || null
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
    if (conta.isFromFluxoCaixa) {
      toast.info("Esta conta foi criada no Fluxo de Caixa. Edite-a lá para atualizar.");
      return;
    }

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

  const filteredContas = useMemo(() => {
    return contas.filter((conta) => {
      if (conta.status === "recebido") return false;

      const searchMatch = filters.searchTerm === "" ||
        conta.cliente_nome.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        conta.numero.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        (conta.referencia && conta.referencia.toLowerCase().includes(filters.searchTerm.toLowerCase()));

      const statusMatch = filters.status === "all" || conta.status === filters.status;

      let periodoMatch = true;
      if (filters.periodo === "mes") {
        periodoMatch = conta.data_vencimento.startsWith(filters.mes);
      } else if (filters.periodo === "ano") {
        periodoMatch = conta.data_vencimento.startsWith(filters.ano);
      }

      return searchMatch && statusMatch && periodoMatch;
    });
  }, [contas, filters]);

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
      .filter((conta) => parseLocalDate(conta.data_vencimento) >= today && conta.status !== "recebido")
      .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime());

    return futureContas.length > 0 ? futureContas[0].data_vencimento : null;
  }, [filteredContas]);

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    const contaToDelete = contas.find((c) => c.id === deleteConfirmId);
    if (contaToDelete?.isFromFluxoCaixa) {
      toast.error("Esta conta foi criada no Fluxo de Caixa. Exclua-a lá.");
      setDeleteConfirmId(null);
      return;
    }

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
      if (conta?.isFromFluxoCaixa && conta?.fluxoCaixaId) {
        const { error } = await supabase.from("controle_bancario").update({ status: newStatus, data_atualizacao: new Date().toISOString() }).eq("id", conta.fluxoCaixaId);

        if (error) {
          toast.error(`Erro ao atualizar: ${error.message}`);
          return;
        }
      } else {
        const { error } = await supabase.from("contas_areceber").update({ status: newStatus, atualizado_em: new Date().toISOString() }).eq("id", contaId);

        if (error) {
          toast.error(`Erro ao atualizar: ${error.message}`);
          return;
        }
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
        const fileExt = comprovanteFile.name.split('.').pop();
        const fileName = `comprovante_recebimento_${Date.now()}_${contasReceberData.numero || 'sem_numero'}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.from("nfs-share-saida").upload(fileName, comprovanteFile);

        if (uploadError) {
          console.error("Erro ao fazer upload do comprovante:", uploadError);
          toast.warning("Não foi possível enviar o comprovante, mas continuaremos com o registro.");
        } else {
          const { data: publicUrlData } = supabase.storage.from("nfs-share-saida").getPublicUrl(fileName);
          comprovanteUrl = publicUrlData.publicUrl;
        }
      }

      if (contasReceberData.isFromFluxoCaixa && contasReceberData.fluxoCaixaId) {
        const { error: updateError } = await supabase.from("controle_bancario").update({
          status: "recebido",
          conta_banco: nomeBanco,
          metodo_pagamento: metodo_pagamento || null,
          data_reembolso: dataRecebimento,
          comprovante_url: comprovanteUrl || undefined,
          data_atualizacao: new Date().toISOString()
        }).eq("id", contasReceberData.fluxoCaixaId);

        if (updateError) {
          toast.error(`Erro ao atualizar: ${updateError.message}`);
          return;
        }

        toast.success("Receita marcada como recebida!");
        resetBankDialog();
        loadContas();
        return;
      }

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

      const { error: updateError } = await supabase.from("contas_areceber").update(updateData).eq("id", contasReceberData.id);

      if (updateError) {
        toast.error(`Erro ao atualizar: ${updateError.message}`);
        return;
      }

      toast.success("Conta marcada como recebida!");
      resetBankDialog();
      loadContas();
    } catch (error: any) {
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
                R$ {totals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
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
                {proximoVencimento ? format(parseLocalDate(proximoVencimento), "dd/MM/yyyy") : "—"}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Filters Card */}
      <Card className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm">
        <CardHeader className="pb-4 pt-5 px-5 border-b border-border/40">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Filter className="w-5 h-5 text-primary" />
              Filtros
            </h3>
            <Button
              onClick={() => { resetForm(); setShowFormDialog(true); }}
              size="sm"
              className="gap-2 bg-primary/80 hover:bg-primary w-full md:w-auto"
            >
              <Plus className="w-4 h-4" />
              Nova Conta
            </Button>
          </div>
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
            <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger className="w-full md:w-[180px] bg-background/50 border-border/40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="recebido">Recebido</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
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
              <p className="text-xs text-muted-foreground mt-2">Registre receitas no Fluxo de Caixa ou crie manualmente</p>
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
                  {filteredContas.map((conta) => (
                    <TableRow key={conta.id} className="border-border/40 hover:bg-muted/20 transition-colors">
                      <TableCell className="text-muted-foreground text-sm">
                        {format(parseLocalDate(conta.data_vencimento), "dd/MM/yyyy")}
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
                          {!conta.isFromFluxoCaixa && (
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
                          )}
                          {conta.status !== "recebido" && (
                            <Select value={conta.status} onValueChange={(value) => handleChangeStatus(conta.id, value)}>
                              <SelectTrigger className="h-7 w-24 text-xs border-0 bg-transparent p-0 hover:bg-muted/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pendente">Pendente</SelectItem>
                                <SelectItem value="recebido">Recebido</SelectItem>
                                <SelectItem value="cancelado">Cancelado</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={showFormDialog} onOpenChange={(open) => { if (!open) { setShowFormDialog(false); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingConta ? "Editar Conta a Receber" : "Nova Conta a Receber"}</DialogTitle>
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
                        cliente_nome: client.company_name,
                        cliente_cnpj: client.cnpj || ""
                      }));
                    }
                  }}
                  options={clients.map((c) => ({
                    id: c.id,
                    label: c.company_name
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
              {isSavingForm ? "Salvando..." : editingConta ? "Atualizar Conta" : "Salvar Conta"}
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
