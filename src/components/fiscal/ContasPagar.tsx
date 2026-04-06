// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select as RegularSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Trash2, Wallet, X, TrendingDown, AlertCircle, Repeat, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAeronaves } from "@/hooks/useAeronaves";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

// Sub-componentes
import { FormDespesasEmpresa } from "./contas-pagar/FormDespesasEmpresa";
import { FormDespesasParticulares } from "./contas-pagar/FormDespesasParticulares";
import { FormDespesasReembolsaveis } from "./contas-pagar/FormDespesasReembolsaveis";
import { FormImpostos } from "./contas-pagar/FormImpostos";
import { ContaPagarExpandedDetails } from "./contas-pagar/ContaPagarExpandedDetails";
import { PaymentDialog } from "./contas-pagar/PaymentDialog";
import { ContaRecorrenteForm } from "./ContaRecorrenteForm";

const CATEGORIAS_FIXAS = [
  { value: "DESPESAS EMPRESA", label: "EMPRESA" },
  { value: "DESPESAS PARTICULARES", label: "PARTICULAR" },
  { value: "DESPESAS REEMBOLSAVEIS", label: "CLIENTE - Reembolsáveis" },
  { value: "IMPOSTOS", label: "IMPOSTOS" },
];

const parseLocalDate = (dateString: string): Date => {
  if (!dateString) return new Date();
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const initialFormState = {
  data_vencimento: format(new Date(), "yyyy-MM-dd"),
  numero_doc: "",
  valor: "",
  categoria: "",
  descricao: "",
  status: "agendada",
  data_agendamento: format(new Date(), "yyyy-MM-dd"),
  observacoes: "",
  client_id: null as string | null,
  client_partner_id: null as string | null,
  fornecedor_favorito_id: null as string | null,
  aeronave_registro: "",
  empresa: "",
  conta_pagamento_fornecedor: "",
  possui_boleto: false,
  boleto_url: "",
  vencimento_boleto: "",
  codigo_barras: "",
  possui_nf: false,
  nf_numero: "",
  nf_url: "",
  numero_documento_decea: "",
  competencia_decea: "",
  decea_url: "",
  competencia_infraero: "",
  numero_documento_infraero: "",
  infraero_url: "",
};

export function ContasPagar() {
  const { user } = useAuth();
  const { aeronaves } = useAeronaves();

  const [contas, setContas] = useState<any[]>([]);
  const [contasRecorrentes, setContasRecorrentes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [showRecorrenteForm, setShowRecorrenteForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCategoriaPai, setSelectedCategoriaPai] = useState("");
  const [formData, setFormData] = useState({ ...initialFormState });
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [minhasContas, setMinhasContas] = useState<any[]>([]);
  const [paymentConta, setPaymentConta] = useState<any>(null);

  const getCurrentMonth = () => format(new Date(), "yyyy-MM");

  const [filters, setFilters] = useState({
    searchTerm: "",
    status: "all",
    mes: getCurrentMonth(),
  });

  useEffect(() => {
    loadContas();
    loadFornecedores();
    loadMinhasContasBancarias();
    loadContasRecorrentes();
  }, []);

  useEffect(() => {
    if (!formData.fornecedor_favorito_id) {
      setFormData(prev => ({ ...prev, conta_pagamento_fornecedor: "" }));
      return;
    }
    const fornecedor = fornecedores.find(f => f.id === formData.fornecedor_favorito_id);
    if (!fornecedor) return;
    setFormData(prev => ({ ...prev, conta_pagamento_fornecedor: fornecedor.conta_pagamento || "" }));
  }, [formData.fornecedor_favorito_id, fornecedores]);

  const loadFornecedores = async () => {
    const { data } = await supabase
      .from("fornecedores_favoritos")
      .select("*")
      .order("nome_completo, conta_pagamento");
    setFornecedores(data || []);
  };

  const loadMinhasContasBancarias = async () => {
    const { data } = await supabase
      .from("contas_bancarias")
      .select("id, banco")
      .order("banco");
    setMinhasContas(data || []);
  };

  const loadContas = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("contas_apagar")
        .select(`
          *,
          fornecedores_favoritos:fornecedor_favorito_id(id, nome_completo, conta_pagamento),
          clientes:cliente_id(id, razao_social, proprietario)
        `)
        .neq("status", "paga")
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      setContas(data || []);
    } catch (err: any) {
      toast.error("Erro ao carregar lista: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadContasRecorrentes = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("contas_recorrentes")
        .select("*")
        .eq("status", "agendado")
        .order("dia_recorrencia", { ascending: true });

      if (error) {
        console.error("Erro ao carregar recorrentes:", error);
        return;
      }
      setContasRecorrentes(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar recorrentes:", err);
    }
  };

  // Gerar entradas virtuais de contas recorrentes ativas que vencem em até 5 dias
  const contasRecorrentesVirtuais = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = addDays(hoje, 5);
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    const mesSeguinte = mesAtual === 11 ? 0 : mesAtual + 1;
    const anoSeguinte = mesAtual === 11 ? anoAtual + 1 : anoAtual;

    const virtuais: any[] = [];

    contasRecorrentes.forEach(conta => {
      const dia = conta.dia_recorrencia || 1;

      // Checar vencimento no mês atual e próximo
      const datas = [
        new Date(anoAtual, mesAtual, dia),
        new Date(anoSeguinte, mesSeguinte, dia),
      ];

      datas.forEach(dataVencimento => {
        dataVencimento.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((dataVencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

        // Mostrar se vence em até 5 dias (inclusive hoje e passado do mês)
        if (diffDays <= 5 && diffDays >= -30) {
          const dataVencStr = format(dataVencimento, "yyyy-MM-dd");

          // Verificar se já existe uma conta real para isso
          const jaExiste = contas.some(c =>
            c.fornecedor_nome === conta.fornecedor &&
            c.descricao === conta.descricao &&
            c.data_vencimento === dataVencStr
          );

          if (!jaExiste) {
            virtuais.push({
              id: `recorrente-${conta.id}-${dataVencStr}`,
              fornecedor_nome: conta.fornecedor,
              fornecedores_favoritos: conta.fornecedor_favorito_id
                ? { nome_completo: conta.fornecedor, conta_pagamento: conta.conta_pagamento }
                : null,
              numero_doc: `REC-${conta.id.slice(0, 6)}`,
              data_vencimento: dataVencStr,
              valor: conta.valor || 0,
              categoria: conta.categoria || "Recorrente",
              descricao: conta.descricao,
              status: "agendada",
              conta_pagamento_fornecedor: conta.conta_pagamento || "",
              _isRecorrente: true,
              _recorrenteId: conta.id,
            });
          }
        }
      });
    });

    return virtuais;
  }, [contasRecorrentes, contas]);

  const handleSave = async () => {
    if (!formData.valor || !formData.data_vencimento) {
      toast.error("Valor e Vencimento são obrigatórios.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        valor: parseFloat(formData.valor.toString().replace(',', '.')),
        criado_por: user?.id,
        numero_doc: formData.numero_doc || null,
        categoria: formData.categoria || null,
        conta_pagamento_fornecedor: formData.conta_pagamento_fornecedor || null,
      };

      const { error } = await supabase.from("contas_apagar").insert([payload]);
      if (error) throw error;

      toast.success("Conta agendada com sucesso!");
      setShowForm(false);
      setFormData({ ...initialFormState });
      setSelectedCategoriaPai("");
      loadContas();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    const { error } = await supabase.from("contas_apagar").delete().eq("id", deleteConfirmId);
    if (error) toast.error(error.message);
    else {
      toast.success("Conta removida.");
      setDeleteConfirmId(null);
      loadContas();
    }
  };

  const toggleExpand = (id: string) => {
    const s = new Set(expandedRows);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpandedRows(s);
  };

  const isVencida = (dv: string, status: string) => {
    if (status === "paga" || status === "cancelada") return false;
    return parseLocalDate(dv) < new Date(new Date().setHours(0, 0, 0, 0));
  };

  // Merge contas reais + virtuais recorrentes
  const allContas = useMemo(() => {
    return [...contas, ...contasRecorrentesVirtuais];
  }, [contas, contasRecorrentesVirtuais]);

  const filteredContas = useMemo(() => {
    return allContas.filter(c => {
      const search = filters.searchTerm.toLowerCase();
      const fornecedor = c.fornecedores_favoritos?.nome_completo?.toLowerCase() || c.fornecedor_nome?.toLowerCase() || "";
      const searchOk = !search || fornecedor.includes(search) || c.numero_doc?.toLowerCase().includes(search);
      const filterStatus = (filters as any).status || filters.status;
      const contaStatus = (c as any).status || c.status;
      const statusOk = filterStatus === "all" || (filterStatus === "vencido" ? isVencida(c.data_vencimento, contaStatus) : contaStatus === filterStatus);
      const mesOk = !filters.mes || c.data_vencimento?.startsWith(filters.mes);
      return searchOk && statusOk && mesOk;
    });
  }, [allContas, filters]);

  const totalGeral = useMemo(
    () => filteredContas.reduce((acc, curr) => acc + Number(curr.valor), 0),
    [filteredContas]
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Resumo de Topo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-background border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase">Total Pendente</span>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar de Filtros */}
      <div className="flex flex-col lg:flex-row gap-4 p-4 bg-card rounded-xl border border-border/50 shadow-sm items-end">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Busca rápida</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-9"
                placeholder="Fornecedor, doc..."
                value={filters.searchTerm}
                onChange={e => setFilters({ ...filters, searchTerm: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Mês Ref.</label>
            <Input
              type="month"
              className="h-9"
              value={filters.mes}
              onChange={e => setFilters({ ...filters, mes: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Status</label>
            <RegularSelect value={(filters as any).status || filters.status} onValueChange={v => setFilters({ ...filters, status: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os abertos</SelectItem>
                <SelectItem value="agendada">Agendadas</SelectItem>
                <SelectItem value="vencido">Vencidas</SelectItem>
              </SelectContent>
            </RegularSelect>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowRecorrenteForm(true)} className="border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10">
            <Repeat className="w-4 h-4 mr-2" />
            Conta Recorrente
          </Button>
          <Button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90 shadow-md">
            <Plus className="w-4 h-4 mr-2" /> Novo Lançamento
          </Button>
        </div>
      </div>

      {/* Formulário de Conta Recorrente */}
      {showRecorrenteForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <ContaRecorrenteForm
            onSuccess={() => {
              setShowRecorrenteForm(false);
              loadContasRecorrentes();
            }}
            onCancel={() => setShowRecorrenteForm(false)}
          />
        </motion.div>
      )}

      {/* Formulário de Cadastro */}
      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/30 shadow-xl bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row justify-between items-center border-b pb-4">
              <CardTitle className="text-lg">Cadastrar Conta a Pagar</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Seleção de Categoria */}
              <div className="flex flex-wrap gap-2">
                {CATEGORIAS_FIXAS.map(cat => (
                  <Button
                    key={cat.value}
                    variant={selectedCategoriaPai === cat.value ? "default" : "outline"}
                    onClick={() => {
                      setSelectedCategoriaPai(cat.value);
                      setFormData({ ...formData, categoria: "" });
                    }}
                    size="sm"
                    className="rounded-full"
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>

              {selectedCategoriaPai === "DESPESAS EMPRESA" && (
                <FormDespesasEmpresa
                  form={formData}
                  setForm={setFormData}
                  fornecedores={fornecedores}
                  onReloadFornecedores={loadFornecedores}
                />
              )}
              {selectedCategoriaPai === "DESPESAS PARTICULARES" && (
                <FormDespesasParticulares
                  form={formData}
                  setForm={setFormData}
                  fornecedores={fornecedores}
                  onReloadFornecedores={loadFornecedores}
                />
              )}
              {selectedCategoriaPai === "DESPESAS REEMBOLSAVEIS" && (
                <FormDespesasReembolsaveis
                  form={formData}
                  setForm={setFormData}
                  fornecedores={fornecedores}
                  aeronaves={aeronaves}
                  onReloadFornecedores={loadFornecedores}
                />
              )}
              {selectedCategoriaPai === "IMPOSTOS" && (
                <FormImpostos form={formData} setForm={setFormData} />
              )}

              {selectedCategoriaPai && formData.fornecedor_favorito_id && (
                <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Dados do Fornecedor (preenchidos automaticamente)
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase">
                      Conta de Pagamento
                    </label>
                    <Input
                      value={formData.conta_pagamento_fornecedor}
                      readOnly
                      placeholder="Nenhuma conta cadastrada para este fornecedor"
                      className="bg-muted/50 cursor-not-allowed text-muted-foreground"
                    />
                  </div>
                </div>
              )}

              {selectedCategoriaPai && (
                <div className="flex gap-3 justify-end pt-6 border-t">
                  <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                  <Button onClick={handleSave} disabled={isSaving} className="min-w-[120px]">
                    {isSaving ? "Salvando..." : "Agendar Conta"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tabela de Resultados */}
      <Card className="border-none shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border/50 text-muted-foreground">
                <th className="px-6 py-4 text-left font-bold uppercase text-[10px]">Fornecedor / Documento</th>
                <th className="px-6 py-4 text-left font-bold uppercase text-[10px]">Vencimento</th>
                <th className="px-6 py-4 text-right font-bold uppercase text-[10px]">Valor</th>
                <th className="px-6 py-4 text-center font-bold uppercase text-[10px]">Status</th>
                <th className="px-6 py-4 text-right font-bold uppercase text-[10px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-muted-foreground animate-pulse">
                    Carregando movimentações...
                  </td>
                </tr>
              ) : filteredContas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-muted-foreground">
                    Nenhuma conta encontrada para este período.
                  </td>
                </tr>
              ) : (
                filteredContas.map(conta => {
                  const vencida = isVencida(conta.data_vencimento, conta.status);
                  const isRecorrente = conta._isRecorrente;
                  return (
                    <React.Fragment key={conta.id}>
                      <tr
                        className={`hover:bg-muted/20 cursor-pointer transition-colors ${vencida ? 'bg-red-500/[0.03]' : ''} ${isRecorrente ? 'bg-emerald-500/[0.04]' : ''}`}
                        onClick={() => !isRecorrente && toggleExpand(conta.id)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {isRecorrente && <Repeat className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                            <div>
                              <div className="font-semibold text-foreground">
                                {conta.fornecedores_favoritos?.nome_completo || conta.fornecedor_nome || "Lançamento Avulso"}
                              </div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                {conta.numero_doc || "Sem documento"} • <span className="italic">{conta.categoria}</span>
                              </div>
                              {conta.conta_pagamento_fornecedor && (
                                <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                                  Pagar em: {conta.conta_pagamento_fornecedor}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`font-medium ${vencida ? 'text-red-500' : ''}`}>
                            {format(parseLocalDate(conta.data_vencimento), "dd/MM/yy")}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-foreground">
                          R$ {parseFloat(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {isRecorrente ? (
                            <Badge variant="outline" className="capitalize font-medium text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                              Recorrente
                            </Badge>
                          ) : (
                            <Badge
                              variant={vencida ? "destructive" : "outline"}
                              className="capitalize font-medium"
                            >
                              {vencida ? "Vencida" : conta.status}
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {!isRecorrente && (
                            <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setPaymentConta(conta)}
                                className="h-8 w-8 text-green-600 hover:bg-green-50"
                              >
                                <Wallet className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeleteConfirmId(conta.id)}
                                className="h-8 w-8 text-muted-foreground hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {!isRecorrente && expandedRows.has(conta.id) && (
                        <tr>
                          <td colSpan={5} className="p-0 border-b border-border/20">
                            <ContaPagarExpandedDetails conta={conta} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dialogs */}
      <PaymentDialog
        open={!!paymentConta}
        onOpenChange={(open) => !open && setPaymentConta(null)}
        conta={paymentConta}
        onPaid={() => { setPaymentConta(null); loadContas(); }}
      />

      <Dialog open={!!deleteConfirmId} onOpenChange={open => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="text-red-500 h-5 w-5" /> Confirmar Exclusão
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            Essa ação não pode ser desfeita. A conta será removida permanentemente do sistema.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Manter Conta</Button>
            <Button variant="destructive" onClick={handleDelete}>Confirmar Exclusão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
