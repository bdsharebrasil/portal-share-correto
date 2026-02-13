import React, { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AutocompleteInput, type AutocompleteOption } from "@/components/ui/autocomplete-input";
import { Plus, Search, Filter, Trash2, Edit2, TrendingUp, Wallet, ChevronDown, Bell, CheckCircle2, DollarSign, X, Upload, FileText, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAeronaves } from "@/hooks/useAeronaves";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useColumnWidths } from "@/hooks/useColumnWidths";

const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

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
      const { data, error } = await supabase.
      from("clients").
      select("id, company_name, cnpj").
      order("company_name", { ascending: true });

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
      const { data, error } = await supabase.
      from("categorias_movimentacao").
      select("id, nome").
      eq("tipo", "receita").
      order("nome", { ascending: true });

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
      const { data, error } = await supabase.
      from("contas_bancarias").
      select("id, banco, numero_conta, tipo_conta").
      eq("ativo", true).
      order("banco", { ascending: true });

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
      // 1. Carregar despesas aguardando reembolso do controle_bancario (com data_vencimento)
      const { data: despesasReembolso, error: fluxoError } = await supabase.
      from("controle_bancario").
      select(`
          id,
          data,
          data_vencimento,
          descricao,
          valor,
          status,
          client_id,
          client_name,
          aeronave_registro,
          numero_documento,
          grupo_categoria,
          comprovante_url,
          nf_url,
          boleto_url,
          fornecedores_favoritos_id,
          colaborador_id
        `).
      eq("status", "aguardando_reembolso").
      not("data_vencimento", "is", null).
      order("data_vencimento", { ascending: true });

      if (fluxoError) {
        console.error("Erro ao carregar despesas aguardando reembolso:", fluxoError);
      }

      // 2. Carregar despesas lançadas ao cliente de bank_reconciliations
      // IMPORTANTE: Excluir registros que já têm controle_bancario_id (já estão no fluxo de caixa)
      // Também excluir registros com status "recebido" pois não devem aparecer em Contas a Receber
      const { data: bankRecData, error: bankRecError } = await supabase.
      from("bank_reconciliations").
      select(`
          id,
          date,
          description,
          amount,
          saldo_pendente,
          status,
          client_id,
          aircraft_id,
          category,
          prazo_pagamento,
          boleto_url,
          nf_url,
          comprovante_url,
          controle_bancario_id,
          clients:client_id (company_name),
          aircraft:aircraft_id (registration)
        `).
      eq("type", "cliente").
      is("controle_bancario_id", null) // Só pegar os que NÃO têm vínculo com controle_bancario
      .in("status", ["pendente", "enviado", "aberto"]).
      neq("status", "recebido").
      order("date", { ascending: false });

      if (bankRecError) {
        console.error("Erro ao carregar bank_reconciliations:", bankRecError);
      }

      // Carregar nomes dos fornecedores e colaboradores para referência
      const fornecedorIds = (despesasReembolso || []).filter((d) => d.fornecedores_favoritos_id).map((d) => d.fornecedores_favoritos_id);
      const colaboradorIds = (despesasReembolso || []).filter((d) => d.colaborador_id).map((d) => d.colaborador_id);

      let fornecedoresMap: Record<string, string> = {};
      let colaboradoresMap: Record<string, string> = {};

      if (fornecedorIds.length > 0) {
        const { data: fornecedores } = await supabase.
        from("fornecedores_favoritos").
        select("id, nome_completo").
        in("id", fornecedorIds);
        fornecedores?.forEach((f) => {fornecedoresMap[f.id] = f.nome_completo;});
      }

      if (colaboradorIds.length > 0) {
        const { data: colaboradores } = await supabase.
        from("user_profiles").
        select("id, full_name").
        in("id", colaboradorIds);
        colaboradores?.forEach((c) => {colaboradoresMap[c.id] = c.full_name || "";});
      }

      // Transformar despesas aguardando reembolso em formato compatível com contas a receber
      const contasFromFluxo = (despesasReembolso || []).map((despesa) => {
        // Determinar a referência com base nos IDs
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

      // Transformar bank_reconciliations em formato compatível
      // Já filtrado para não incluir registros com controle_bancario_id
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

      // 3. Carregar contas a receber manuais (que não vieram do fluxo ou bank_reconciliations)
      // Excluir contas com status "recebido" pois não devem aparecer em Contas a Receber
      const { data: contasData, error: contasError } = await (supabase.
      from("contas_areceber") as any).
      select("*").
      neq("status", "recebido").
      order("data_vencimento", { ascending: true });

      if (contasError) {
        toast.error(`Erro ao carregar: ${contasError.message}`);
        return;
      }

      // Coletar todos os IDs já presentes para evitar duplicatas
      const fluxoIds = new Set(contasFromFluxo.map((c) => c.id));
      const bankRecIds = new Set(contasFromBankRec.map((c) => c.id));

      // Processar contas manuais - APENAS contas que foram criadas manualmente
      // Não devemos incluir aqui contas que vieram de outras fontes
      const contasManuals = await Promise.all(
        (contasData || []).map(async (conta) => {
          // Verificar se esta conta JÁ foi importada de outras fontes
          const isAlreadyImported = fluxoIds.has(conta.id) || bankRecIds.has(conta.id);

          let referencia = conta.referencia || "";
          let dataVencimentoFromBanco = conta.data_vencimento;
          let isFromBankRec = false;

          // Se tem banco_conciliacao_id, pode estar vinculada a bank_reconciliations
          if (conta.banco_conciliacao_id) {
            const { data: bancarioData } = await supabase.
            from("bank_reconciliations").
            select("description, date").
            eq("id", conta.banco_conciliacao_id).
            single();

            if (bancarioData) {
              referencia = bancarioData.description || referencia;
              isFromBankRec = true;
            }
          }

          return {
            ...conta,
            referencia,
            data_vencimento: dataVencimentoFromBanco,
            isAlreadyImported, // Marcar se já foi importada de outra fonte
            isFromBankReconciliation: isFromBankRec // Marcar se é da conciliação bancária
          };
        })
      );

      // Filtrar manuais: APENAS incluir contas que NÃO foram importadas de fluxo ou bank_reconciliations
      const contasManuaisFiltradas = contasManuals.filter((c) => !c.isAlreadyImported);

      // Log para debug - verificar se há duplicatas
      const allIds = new Set<string>();
      const duplicateIds = new Set<string>();

      const checkDuplicates = (id: string, source: string) => {
        if (allIds.has(id)) {
          console.warn(`⚠️ DUPLICATA DETECTADA: ID "${id}" aparece em múltiplas fontes`);
          duplicateIds.add(id);
        }
        allIds.add(id);
      };

      contasFromFluxo.forEach((c) => checkDuplicates(c.id, 'Fluxo de Caixa'));
      contasFromBankRec.forEach((c) => checkDuplicates(c.id, 'Bank Reconciliations'));
      contasManuaisFiltradas.forEach((c) => checkDuplicates(c.id, 'Contas Manuais'));

      if (duplicateIds.size > 0) {
        console.error(`❌ ERRO: ${duplicateIds.size} duplicata(s) encontrada(s)!`, Array.from(duplicateIds));
        toast.warning(`Aviso: ${duplicateIds.size} registro(s) duplicado(s) detectado(s). Verifique o console.`);
      }

      // Combinar: primeiro fluxo de caixa, depois bank_reconciliations, depois manuais
      const todasContas = [...contasFromFluxo, ...contasFromBankRec, ...contasManuaisFiltradas];

      // 5. Verificar contas vencidas e atualizar status para inadimplente
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const contasVencidas = todasContas.filter((conta) => {
        if (conta.status !== "pendente") return false;
        const vencimento = parseLocalDate(conta.data_vencimento);
        return vencimento < today;
      });

      // Atualizar status das contas vencidas para inadimplente
      for (const conta of contasVencidas) {
        if ((conta as any).isFromFluxoCaixa) {
          // Atualizar no controle_bancario
          await supabase.
          from("controle_bancario").
          update({ status: "inadimplente" }).
          eq("id", (conta as any).fluxoCaixaId || conta.id);
        } else if ((conta as any).isFromBankReconciliation) {

          // Não atualizar status de bank_reconciliations aqui
        } else {// Atualizar na tabela contas_areceber
          await supabase.
          from("contas_areceber").
          update({ status: "inadimplente" }).
          eq("id", conta.id);
        }
        // Atualizar localmente
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
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.
      from("nfs-share-saida").
      upload(filePath, file);

      if (uploadError) {
        toast.error(`Erro ao fazer upload: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage.
      from("nfs-share-saida").
      getPublicUrl(filePath);

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
      toast.error("Preencha os campos obrigatórios: Número, Cliente, Valor e Data de Vencimento");
      return;
    }

    setIsSavingForm(true);
    try {
      if (editingConta) {
        // Update existing
        const { error } = await supabase.
        from("contas_areceber").
        update({
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
        }).
        eq("id", editingConta.id);

        if (error) {
          toast.error(`Erro ao atualizar: ${error.message}`);
          return;
        }

        toast.success("Conta a receber atualizada com sucesso!");
      } else {
        // Insert new
        const { error } = await supabase.
        from("contas_areceber").
        insert([
        {
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
        }]
        );

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
      // Sempre excluir contas com status "recebido" - elas não aparecem em Contas a Receber
      if (conta.status === "recebido") {
        return false;
      }

      const searchMatch = filters.searchTerm === "" ||
      conta.cliente_nome.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      conta.numero.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      conta.referencia && conta.referencia.toLowerCase().includes(filters.searchTerm.toLowerCase());

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

  const proximoVencimento = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureContas = filteredContas.
    filter((conta) => parseLocalDate(conta.data_vencimento) >= today && conta.status !== "recebido").
    sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime());

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
      const { error } = await supabase.
      from("contas_areceber").
      delete().
      eq("id", deleteConfirmId);

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

    // Se vai mudar para "recebido", abrir dialog para selecionar banco
    if (newStatus === "recebido") {
      setContasReceberData(conta);
      setSelectedBank("");
      setDataRecebimento(new Date().toISOString().split("T")[0]);
      setComprovanteFile(null);
      setShowBankDialog(true);
      return;
    }

    try {
      // Se veio do fluxo de caixa, atualizar no controle_bancario
      if (conta?.isFromFluxoCaixa && conta?.fluxoCaixaId) {
        const { error } = await supabase.
        from("controle_bancario").
        update({ status: newStatus, data_atualizacao: new Date().toISOString() }).
        eq("id", conta.fluxoCaixaId);

        if (error) {
          toast.error(`Erro ao atualizar: ${error.message}`);
          return;
        }
      } else {
        // Atualizar na tabela contas_areceber
        const { error } = await supabase.
        from("contas_areceber").
        update({ status: newStatus, atualizado_em: new Date().toISOString() }).
        eq("id", contaId);

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

    // Encontrar o nome do banco baseado no ID selecionado
    const contaBancariaSelected = contasBancarias.find((c) => c.id === selectedBank);
    const nomeBanco = contaBancariaSelected?.banco || selectedBank;

    setIsUploadingComprovante(true);
    let comprovanteUrl = "";

    try {
      // Upload do comprovante se existir
      if (comprovanteFile) {
        const fileExt = comprovanteFile.name.split('.').pop();
        const fileName = `comprovante_recebimento_${Date.now()}_${contasReceberData.numero || 'sem_numero'}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.
        from("nfs-share-saida").
        upload(fileName, comprovanteFile);

        if (uploadError) {
          console.error("Erro ao fazer upload do comprovante:", uploadError);
          toast.warning("Não foi possível enviar o comprovante, mas continuaremos com o registro.");
        } else {
          const { data: publicUrlData } = supabase.storage.
          from("nfs-share-saida").
          getPublicUrl(fileName);
          comprovanteUrl = publicUrlData.publicUrl;
        }
      }

      // Se veio do fluxo de caixa, atualizar diretamente no controle_bancario
      if (contasReceberData.isFromFluxoCaixa && contasReceberData.fluxoCaixaId) {
        const { error: updateError } = await supabase.
        from("controle_bancario").
        update({
          status: "recebido",
          conta_banco: nomeBanco,
          data_reembolso: dataRecebimento,
          comprovante_url: comprovanteUrl || undefined,
          data_atualizacao: new Date().toISOString()
        }).
        eq("id", contasReceberData.fluxoCaixaId);

        if (updateError) {
          toast.error(`Erro ao atualizar: ${updateError.message}`);
          return;
        }

        toast.success("Receita marcada como recebida!");
        resetBankDialog();
        loadContas();
        return;
      }

      // Para contas manuais (tabela contas_areceber)
      // 1. Atualizar status da conta para "recebido" com data e comprovante
      const updateData: any = {
        status: "recebido",
        data_recebimento: dataRecebimento,
        banco_recebimento: nomeBanco,
        atualizado_em: new Date().toISOString()
      };

      if (comprovanteUrl) {
        updateData.comprovante_recebimento_url = comprovanteUrl;
      }

      const { error: updateError } = await supabase.
      from("contas_areceber").
      update(updateData).
      eq("id", contasReceberData.id);

      if (updateError) {
        toast.error(`Erro ao atualizar: ${updateError.message}`);
        return;
      }

      // 2. Atualizar status na conciliação bancária para "recebido" se houver referência
      if (contasReceberData.banco_conciliacao_id) {
        const { error: updateConciliacao } = await supabase.
        from("bank_reconciliations").
        update({
          status: "recebido",
          comprovante_url: comprovanteUrl || undefined
        }).
        eq("id", contasReceberData.banco_conciliacao_id);

        if (updateConciliacao) {
          console.error("Erro ao atualizar conciliação:", updateConciliacao);
        }
      }

      // 3. Chamar função RPC para criar entrada no controle_bancario
      const { error: rpcError } = await (supabase.rpc as any)('create_entrada_bancaria_from_conta_receber', {
        p_conta_receber_id: contasReceberData.id,
        p_conta_banco: nomeBanco
      });

      if (rpcError) {
        console.error("Erro ao criar entrada bancária:", rpcError);
        toast.warning("Conta marcada como recebida, mas houve um pequeno erro ao registrar no fluxo bancário. Por favor, revise.");
        return;
      }

      toast.success("Conta marcada como recebida e registrada no fluxo bancário!");
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
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "pendente":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "inadimplente":
        return "bg-red-600/30 text-red-300 border-red-500/50";
      case "cancelado":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "recebido":
        return "Recebido";
      case "pendente":
        return "Pendente";
      case "inadimplente":
        return "Inadimplente";
      case "cancelado":
        return "Cancelado";
      default:
        return status;
        return status;
    }
  };

  const handleColumnResizeStart = (e: React.MouseEvent, columnId: string) => {
    e.preventDefault();
    setResizingColumn(columnId);
    startXRef.current = e.clientX;
    startWidthRef.current = columnWidths[columnId as keyof typeof columnWidths] || defaultColumnWidths[columnId as keyof typeof defaultColumnWidths];

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(60, startWidthRef.current + diff);
      setColumnWidth(columnId, newWidth);
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const getGridTemplate = () => {
    return `${columnWidths.doc}px ${columnWidths.categoria}px minmax(${columnWidths.cliente}px, 1fr) minmax(${columnWidths.descricao}px, 1.5fr) ${columnWidths.vencimento}px ${columnWidths.valor}px ${columnWidths.status}px ${columnWidths.acoes}px`;
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-8">
      {/* Cards de Totais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 auto-rows-max">
        <Card className="bg-card border-border/50 hover:border-border transition-colors h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5 px-6">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Total a Receber</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-500 flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-2xl md:text-3xl font-bold text-green-500 mb-3">
              R$ {totals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Período selecionado</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 hover:border-border transition-colors h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-5 px-6">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Próximo Recebimento</CardTitle>
            <Bell className="h-5 w-5 text-primary flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-2xl md:text-3xl font-bold text-primary mb-3">
              {proximoVencimento ? format(parseLocalDate(proximoVencimento), "dd/MM/yyyy") : "-"}
            </div>
            <p className="text-xs text-muted-foreground">Próxima data de recebimento</p>
          </CardContent>
        </Card>
      </div>

      {/* Info sobre fonte automática */}
      <Card className="bg-blue-500/10 border-blue-500/30">
        <CardContent className="py-4 px-6">
          








        </CardContent>
      </Card>

      {/* Filtros e Ações */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-4 pt-6 px-6 border-b border-border/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Filter className="w-5 h-5" /> Filtros e Período
            </CardTitle>
            <Button
              onClick={() => {resetForm();setShowFormDialog(true);}}
              variant="outline"
              className="w-full md:w-auto">

              <Plus className="w-4 h-4 mr-2" />
              Adicionar Manual
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6 px-6">
          {/* Período - Destaque */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-center lg:justify-start gap-4 p-5 bg-muted/40 rounded-lg border border-border/50">
            <span className="text-sm font-semibold text-foreground whitespace-nowrap">Período:</span>
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
              <Button
                variant={filters.periodo === "mes" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilters((prev) => ({ ...prev, periodo: "mes" }))}>

                Mensal
              </Button>
                <Button
                variant={filters.periodo === "ano" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilters((prev) => ({ ...prev, periodo: "ano" }))}
                className="min-w-[90px]">

                 Ano
                  </Button>
                 </div>
             
                   {filters.periodo === "mes" ?
            <Input
              type="month"
              value={filters.mes}
              onChange={(e) => setFilters((prev) => ({ ...prev, mes: e.target.value }))}
              className="bg-background w-full lg:w-auto lg:min-w-[200px] h-10" /> :


            <Select value={filters.ano} onValueChange={(value) => setFilters((prev) => ({ ...prev, ano: value }))}>
                             <SelectTrigger className="bg-background w-full lg:w-[160px] h-10">
                               <SelectValue placeholder="Ano" />
                             </SelectTrigger>
                             <SelectContent>
                {Array.from({ length: 5 }, (_, i) => {
                  const year = new Date().getFullYear() - i;
                  return (
                    <SelectItem key={year} value={year.toString()}>
                                        {year}
                                      </SelectItem>);

                })}
                                </SelectContent>
                              </Select>
            }
          </div>

          {/* Filtros adicionais */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por cliente, documento ou referência..."
                value={filters.searchTerm}
                onChange={(e) => setFilters((prev) => ({ ...prev, searchTerm: e.target.value }))}
                className="pl-10 bg-background" />

            </div>
            <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger className="w-full md:w-[180px] bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="recebido">Recebido</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Formulário Dialog */}
      <Dialog open={showFormDialog} onOpenChange={(open) => {if (!open) {setShowFormDialog(false);resetForm();} else {setShowFormDialog(true);}}}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingConta ? "Editar Conta a Receber" : "Nova Conta a Receber"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Linha 1 - Número e Cliente */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Documento *
                </label>
                <Input
                  placeholder="Ex: NF-1024"
                  value={formData.numero}
                  onChange={(e) => setFormData((prev) => ({ ...prev, numero: e.target.value }))}
                  className="bg-background" />

              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Cliente *
                </label>
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
                  placeholder="Selecione ou digite o cliente" />

              </div>
            </div>

            {/* Linha 2 - Referência */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                Referência
              </label>
              <Input
                placeholder="Ex: REF-2023/10"
                value={formData.referencia}
                onChange={(e) => setFormData((prev) => ({ ...prev, referencia: e.target.value }))}
                className="bg-background" />

            </div>

            {/* Linha 3 - Datas e Valor */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Data Emissão
                </label>
                <Input
                  type="date"
                  value={formData.data_criacao}
                  onChange={(e) => setFormData((prev) => ({ ...prev, data_criacao: e.target.value }))}
                  className="bg-background" />

              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Data Vencimento *
                </label>
                <Input
                  type="date"
                  value={formData.data_vencimento}
                  onChange={(e) => setFormData((prev) => ({ ...prev, data_vencimento: e.target.value }))}
                  className="bg-background" />

              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Valor (R$) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.valor}
                  onChange={(e) => setFormData((prev) => ({ ...prev, valor: e.target.value }))}
                  className="bg-background" />

              </div>
            </div>

            {/* Linha 4 - Aeronave */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                Aeronave
              </label>
              <Popover open={openAeronavePopover} onOpenChange={setOpenAeronavePopover}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between bg-background">
                    {formData.aeronave || "Selecione uma aeronave (opcional)"}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 bg-card border-border" align="start">
                  <Command className="bg-card">
                    <CommandInput
                      placeholder="Buscar por prefixo, modelo..."
                      value={aeronaveSearch}
                      onValueChange={setAeronaveSearch}
                      className="bg-background" />

                    <CommandList>
                      {isLoadingAeronaves ?
                      <div className="text-center py-3 text-muted-foreground text-sm">
                          Carregando aeronaves...
                        </div> :

                      <>
                          <CommandEmpty className="text-muted-foreground py-3 text-center text-sm">
                            Nenhuma aeronave encontrada
                          </CommandEmpty>
                          <CommandGroup heading="Aeronaves" className="text-muted-foreground">
                            {(Array.isArray(aeronaves) ? aeronaves : []).filter((a) =>
                          a.registration.toLowerCase().includes(aeronaveSearch.toLowerCase()) ||
                          a.model.toLowerCase().includes(aeronaveSearch.toLowerCase())
                          ).slice(0, 10).map((aero) =>
                          <CommandItem
                            key={aero.id}
                            onSelect={() => {
                              setFormData({
                                ...formData,
                                aeronave: aero.registration
                              });
                              setOpenAeronavePopover(false);
                              setAeronaveSearch("");
                            }}
                            className="cursor-pointer hover:bg-muted">

                                <div>
                                  <p className="font-medium text-foreground">{aero.registration}</p>
                                  <p className="text-xs text-muted-foreground">{aero.manufacturer} {aero.model}</p>
                                </div>
                              </CommandItem>
                          )}
                          </CommandGroup>
                        </>
                      }
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Linha 5 - Categoria e Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Categoria
                </label>
                <AutocompleteInput
                  value={formData.categoria}
                  onChange={(value) => {
                    setFormData((prev) => ({ ...prev, categoria: value }));
                  }}
                  onSelect={(option) => {
                    const categoria = categorias.find((c) => c.id === option.id);
                    if (categoria) {
                      setFormData((prev) => ({ ...prev, categoria: categoria.nome }));
                    }
                  }}
                  options={categorias.map((c) => ({
                    id: c.id,
                    label: c.nome
                  }))}
                  placeholder="Selecione ou digite uma categoria" />

              </div>
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Status
                </label>
                <Select value={formData.status} onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="recebido">Recebido</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 6 - Descrição */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">
                Descrição
              </label>
              <Input
                placeholder="Descrição da conta a receber"
                value={formData.descricao}
                onChange={(e) => setFormData((prev) => ({ ...prev, descricao: e.target.value }))}
                className="bg-background" />

            </div>

            {/* Linha 7 - Anexar PDF */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground block">
                Nota Fiscal (PDF)
              </label>
              {pdfUrl ?
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex-1 truncate">

                    NF anexada
                  </a>
                  <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPdfUrl("")}
                  className="h-8 w-8 p-0">

                    <X className="h-4 w-4" />
                  </Button>
                </div> :

              <div className="flex items-center gap-2">
                  <Input
                  type="file"
                  accept=".pdf"
                  onChange={handlePDFUpload}
                  disabled={isUploadingPDF}
                  className="hidden"
                  id="pdf-upload" />

                  <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('pdf-upload')?.click()}
                  disabled={isUploadingPDF}
                  className="w-full">

                    <Upload className="h-4 w-4 mr-2" />
                    {isUploadingPDF ? "Enviando..." : "Anexar Nota Fiscal (PDF)"}
                  </Button>
                </div>
              }
            </div>

            <p className="text-xs text-muted-foreground">* Campos obrigatórios</p>
          </div>

          <DialogFooter className="gap-3 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {setShowFormDialog(false);resetForm();}}
              disabled={isSavingForm || isUploadingPDF}>

              Cancelar
            </Button>
            <Button
              onClick={handleSaveForm}
              disabled={isSavingForm || isUploadingPDF}
              className="bg-primary hover:bg-primary/90">

              {isSavingForm ? "Salvando..." : editingConta ? "Atualizar Conta" : "Salvar Conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Visualizador de PDF */}
      <Dialog open={showPdfViewerDialog} onOpenChange={setShowPdfViewerDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Visualizar PDF</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-gray-900 rounded-lg">
            {pdfViewerUrl &&
            <iframe
              src={pdfViewerUrl}
              className="w-full h-full border-0 rounded-lg"
              title="PDF Viewer" />

            }
          </div>
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowPdfViewerDialog(false)}>

              Fechar
            </Button>
            {pdfViewerUrl &&
            <a
              href={pdfViewerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1">

                <Button className="w-full bg-primary hover:bg-primary/90">
                  Abrir em Nova Aba
                </Button>
              </a>
            }
          </div>
        </DialogContent>
      </Dialog>

      {/* Tabela de Contas a Receber */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-4 pt-6 px-6 border-b border-border/50">
          <CardTitle className="text-lg font-semibold text-foreground">
            Contas a Receber - {(() => {
              if (filters.periodo === "ano") {
                return `Ano ${filters.ano}`;
              }
              const [year, month] = filters.mes.split("-");
              return format(new Date(parseInt(year), parseInt(month) - 1, 15), "MMMM 'de' yyyy", { locale: ptBR });
            })()}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ?
          <div className="flex justify-center items-center h-40">
              <p className="text-muted-foreground">Carregando...</p>
            </div> :

          <div className="space-y-0 overflow-x-auto">
              {/* Cabeçalho Fixo - Desktop */}
              <div className="hidden lg:grid items-center px-6 py-4 bg-muted/40 border-b border-border/50 font-semibold text-sm text-muted-foreground sticky top-0 z-10 select-none" style={{ gridTemplateColumns: getGridTemplate() }}>
                <div className="flex items-center justify-between pr-0 group">
                  <span>DOC</span>
                  <div
                  onMouseDown={(e) => handleColumnResizeStart(e, "doc")}
                  className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${
                  resizingColumn === "doc" ? "bg-primary" : ""}`
                  }
                  title="Arraste para redimensionar" />

                </div>
                <div className="flex items-center justify-between pr-0 group">
                  <span>Categoria</span>
                  <div
                  onMouseDown={(e) => handleColumnResizeStart(e, "categoria")}
                  className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${
                  resizingColumn === "categoria" ? "bg-primary" : ""}`
                  }
                  title="Arraste para redimensionar" />

                </div>
                <div className="flex items-center justify-between pr-0 group">
                  <span>Cliente</span>
                  <div
                  onMouseDown={(e) => handleColumnResizeStart(e, "cliente")}
                  className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${
                  resizingColumn === "cliente" ? "bg-primary" : ""}`
                  }
                  title="Arraste para redimensionar" />

                </div>
                <div className="flex items-center justify-between pr-0 group">
                  <span>Descrição</span>
                  <div
                  onMouseDown={(e) => handleColumnResizeStart(e, "descricao")}
                  className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${
                  resizingColumn === "descricao" ? "bg-primary" : ""}`
                  }
                  title="Arraste para redimensionar" />

                </div>
                <div className="flex items-center justify-between pr-0 group">
                  <span>Vencimento</span>
                  <div
                  onMouseDown={(e) => handleColumnResizeStart(e, "vencimento")}
                  className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${
                  resizingColumn === "vencimento" ? "bg-primary" : ""}`
                  }
                  title="Arraste para redimensionar" />

                </div>
                <div className="flex items-center justify-between pr-0 group">
                  <span className="text-right flex-1">Valor</span>
                  <div
                  onMouseDown={(e) => handleColumnResizeStart(e, "valor")}
                  className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${
                  resizingColumn === "valor" ? "bg-primary" : ""}`
                  }
                  title="Arraste para redimensionar" />

                </div>
                <div className="flex items-center justify-between pr-0 group">
                  <span className="text-center flex-1">Status</span>
                  <div
                  onMouseDown={(e) => handleColumnResizeStart(e, "status")}
                  className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${
                  resizingColumn === "status" ? "bg-primary" : ""}`
                  }
                  title="Arraste para redimensionar" />

                </div>
                <div className="flex items-center justify-between pr-0 group">
                  <span className="text-right flex-1">Ações</span>
                  <div
                  onMouseDown={(e) => handleColumnResizeStart(e, "acoes")}
                  className={`w-1 h-6 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 ${
                  resizingColumn === "acoes" ? "bg-primary" : ""}`
                  }
                  title="Arraste para redimensionar" />

                </div>
              </div>

              {filteredContas.length === 0 ?
            <div className="text-center py-20 px-6">
                  <Wallet className="w-20 h-20 text-muted-foreground/20 mx-auto mb-6" />
                  <p className="text-muted-foreground text-lg font-medium">Nenhuma conta a receber encontrada</p>
                  <p className="text-muted-foreground text-sm mt-3">Registre receitas no Fluxo de Caixa para vê-las aqui automaticamente</p>
                </div> :

            filteredContas.map((conta) => {
              const isExpanded = expandedRows.has(conta.id);
              const isFromFluxoCaixa = conta.isFromFluxoCaixa;
              return (
                <div key={conta.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors last:border-b-0">
                      {/* Desktop Layout - Grid */}
                      <div className="hidden lg:grid py-4 items-center px-6 text-sm" style={{ gridTemplateColumns: getGridTemplate() }}>
                        <div className={`font-medium truncate ${isFromFluxoCaixa ? 'text-blue-400' : 'text-orange-500'}`} title={conta.numero}>
                          {conta.numero}
                        </div>
                        <div className="text-muted-foreground truncate" title={conta.categoria || "-"}>
                          {conta.categoria || "-"}
                        </div>
                        <div className="font-semibold text-foreground truncate" title={conta.cliente_nome}>
                          {conta.cliente_nome}
                        </div>
                        <div className="text-muted-foreground truncate" title={conta.descricao || "-"}>
                          {conta.descricao || "-"}
                        </div>
                        <div className="text-foreground font-medium">
                          {format(parseLocalDate(conta.data_vencimento), "dd/MM/yyyy")}
                        </div>
                        <div className="text-right font-semibold text-green-500 whitespace-nowrap pr-4">
                          R$ {parseFloat(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="flex justify-center">
                          <Select value={conta.status} onValueChange={(value) => handleChangeStatus(conta.id, value)}>
                            <SelectTrigger className={`h-8 text-xs font-medium border rounded-lg w-[100px] ${getStatusColor(conta.status)}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              <SelectItem value="pendente">Pendente</SelectItem>
                              <SelectItem value="inadimplente">Inadimplente</SelectItem>
                              <SelectItem value="recebido">Recebido</SelectItem>
                              <SelectItem value="cancelado">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-1 justify-end items-center">
                          {conta.arquivo_pdf_url &&
                      <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                              onClick={() => {
                                setPdfViewerUrl(conta.arquivo_pdf_url);
                                setShowPdfViewerDialog(true);
                              }}
                              className="text-muted-foreground hover:text-primary transition-colors p-1">

                                    <FileText className="w-4 h-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Ver PDF</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                      }
                          {isFromFluxoCaixa ?
                      <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-muted-foreground/50 p-1 cursor-not-allowed">
                                    <Lock className="w-4 h-4" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Editar no Fluxo de Caixa</TooltipContent>
                              </Tooltip>
                            </TooltipProvider> :

                      <>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                className="text-muted-foreground hover:text-primary transition-colors p-1"
                                onClick={() => handleEditConta(conta)}>

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
                                className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                                onClick={() => setDeleteConfirmId(conta.id)}>

                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Excluir</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </>
                      }
                        </div>
                      </div>

                      {/* Mobile/Tablet Layout - Card */}
                      <div className="lg:hidden px-5 py-5">
                        <button
                      onClick={() => toggleRowExpand(conta.id)}
                      className="w-full text-left">

                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-foreground text-sm">
                                  {conta.cliente_nome}
                                </p>
                              </div>
                              <p className={`text-xs mb-1 font-medium ${isFromFluxoCaixa ? 'text-blue-400' : 'text-orange-500'}`}>DOC: {conta.numero}</p>
                              {conta.referencia &&
                          <p className="text-xs text-muted-foreground mb-1">Ref: {conta.referencia}</p>
                          }
                              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                <span>Venc: {format(parseLocalDate(conta.data_vencimento), "dd/MM/yyyy")}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                              <span className="font-semibold text-sm whitespace-nowrap text-green-500">
                                R$ {parseFloat(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              <Badge className={`${getStatusColor(conta.status)} text-xs`}>
                                {getStatusLabel(conta.status)}
                              </Badge>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                        </button>

                        {/* Expanded Details - Mobile */}
                        {isExpanded &&
                    <div className="mt-4 pt-4 border-t border-border space-y-3">
                            {conta.descricao &&
                      <div>
                                <p className="text-muted-foreground text-xs font-semibold mb-1">Descrição</p>
                                <p className="text-foreground text-sm">{conta.descricao}</p>
                              </div>
                      }
                            
                            {conta.cliente_cnpj &&
                      <div>
                                <p className="text-muted-foreground text-xs font-semibold mb-1">CNPJ</p>
                                <p className="text-foreground text-sm">{conta.cliente_cnpj}</p>
                              </div>
                      }

                            {conta.aeronave &&
                      <div>
                                <p className="text-muted-foreground text-xs font-semibold mb-1">Aeronave</p>
                                <p className="text-foreground text-sm">{conta.aeronave}</p>
                              </div>
                      }

                            <div className="flex gap-2 pt-3 border-t border-border flex-wrap">
                              {conta.arquivo_pdf_url &&
                        <a
                          href={conta.arquivo_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-3 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1">

                                  <FileText className="w-3 h-3" />
                                  Ver PDF
                                </a>
                        }
                              {isFromFluxoCaixa ?
                        <span className="text-xs px-3 py-1.5 rounded bg-muted text-muted-foreground flex items-center gap-1">
                                  <Lock className="w-3 h-3" />
                                  Via Fluxo de Caixa
                                </span> :

                        <>
                                  <button
                            className="text-xs px-3 py-1.5 rounded bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 flex items-center gap-1"
                            onClick={() => handleEditConta(conta)}>

                                    <Edit2 className="w-3 h-3" />
                                    Editar
                                  </button>
                                  <button
                            className="text-xs px-3 py-1.5 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20"
                            onClick={() => setDeleteConfirmId(conta.id)}>

                                    Deletar
                                  </button>
                                </>
                        }
                            </div>
                          </div>
                    }
                      </div>
                    </div>);

            })
            }
            </div>
          }
        </CardContent>
      </Card>

      {/* Dialog de seleção de banco para recebimento */}
      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar Banco para Recebimento</DialogTitle>
          </DialogHeader>

          {contasReceberData &&
          <div className="space-y-4 py-4">
              <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Cliente</p>
                <p className="font-semibold text-foreground">{contasReceberData.cliente_nome}</p>
                <p className="text-sm text-muted-foreground mt-2">DOC: {contasReceberData.numero}</p>
                <p className="text-sm text-muted-foreground">Valor: R$ {parseFloat(contasReceberData.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">
                    Banco de Recebimento *
                  </label>
                  <Select value={selectedBank} onValueChange={setSelectedBank}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecione um banco" />
                    </SelectTrigger>
                    <SelectContent>
                      {contasBancarias.length > 0 ?
                    contasBancarias.map((conta) =>
                    <SelectItem key={conta.id} value={conta.id}>
                            {conta.banco} - {conta.numero_conta || 'Conta'} {conta.tipo_conta ? `(${conta.tipo_conta})` : ''}
                          </SelectItem>
                    ) :

                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          Nenhuma conta disponível
                        </div>
                    }
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">
                    Data do Recebimento *
                  </label>
                  <Input
                  type="date"
                  value={dataRecebimento}
                  onChange={(e) => setDataRecebimento(e.target.value)}
                  className="bg-background" />

                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">
                  Comprovante de Recebimento
                </label>
                {comprovanteFile ?
              <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/30 rounded-lg">
                    <FileText className="h-5 w-5 text-success" />
                    <span className="text-sm text-success flex-1 truncate">
                      {comprovanteFile.name}
                    </span>
                    <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setComprovanteFile(null)}
                  className="h-8 w-8 p-0 hover:bg-destructive/10">

                      <X className="h-4 w-4" />
                    </Button>
                  </div> :

              <div className="flex items-center gap-2">
                    <Input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setComprovanteFile(file);
                  }}
                  className="hidden"
                  id="comprovante-upload" />

                    <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('comprovante-upload')?.click()}
                  className="w-full">

                      <Upload className="h-4 w-4 mr-2" />
                      Anexar Comprovante (PDF, PNG, JPG)
                    </Button>
                  </div>
              }
              </div>
            </div>
          }

          <DialogFooter className="gap-3 sm:gap-2">
            <Button
              variant="outline"
              onClick={resetBankDialog}
              disabled={isUploadingComprovante}>

              Cancelar
            </Button>
            <Button
              onClick={handleMarkAsReceived}
              disabled={isUploadingComprovante}
              className="bg-green-600 hover:bg-green-700">

              {isUploadingComprovante ? "Processando..." : "Confirmar Recebimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground py-4">Deseja realmente deletar esta conta a receber? Esta ação não pode ser desfeita.</p>
          <DialogFooter className="gap-3 sm:gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Deletar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

}
