import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Send, Receipt, X, FileText, Calendar, DollarSign, Trash2, Check, Upload, Tag, Building2, Eye, AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { NovaFormularioDespesaDialog } from "./NovaFormularioDespesaDialog";

interface EnvioDespesaTabProps {
  clientId: string;
  clientName: string;
  aircraftId: string;
  aircraftRegistration: string;
}

interface DespesaClienteDireto {
  id: string;
  client_id: string;
  client_name: string;
  aeronave_id: string | null;
  aeronave_registro: string | null;
  categoria_id: string | null;
  categoria_nome: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  fornecedor_nome: string;
  fornecedor_cnpj: string | null;
  status: string;
  data_envio: string | null;
  data_pagamento_cliente: string | null;
  comprovante_pagamento_url: string | null;
  boleto_url: string | null;
  nota_fiscal_url: string | null;
  criado_em: string;
}

interface CategoriaMovimentacao {
  id: string;
  nome: string;
  tipo: string;
  grupo_categoria: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendente_envio: { label: "Pendente Envio", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  enviado: { label: "Enviado", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  visualizado_cliente: { label: "Visualizado", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  aguardando_pagamento: { label: "Aguardando Pagamento", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  comprovante_recebido: { label: "Comprovante Recebido", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  pagamento_validado: { label: "Validado", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  concluido: { label: "Concluído", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  atrasado: { label: "Atrasado", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  cancelado: { label: "Cancelado", color: "bg-red-800/20 text-red-600 border-red-800/30" }
};

export function EnvioDespesaTab({ clientId, clientName, aircraftId, aircraftRegistration }: EnvioDespesaTabProps) {
  const { user } = useAuth();
  const [despesas, setDespesas] = useState<DespesaClienteDireto[]>([]);
  const [categories, setCategories] = useState<CategoriaMovimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaFormularioOpen, setNovaFormularioOpen] = useState(false);

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedDespesa, setSelectedDespesa] = useState<DespesaClienteDireto | null>(null);
  const [dataPagamento, setDataPagamento] = useState("");
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  
  // View document modal
  const [viewDocumentOpen, setViewDocumentOpen] = useState(false);
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");

  useEffect(() => {
    loadDespesas();
    loadCategories();
  }, [clientId, aircraftId]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categorias_movimentacao')
        .select('id, nome, tipo, grupo_categoria')
        .eq('ativo', true)
        .or('grupo_categoria.eq.Despesas Aeronave,reembolsavel.eq.true')
        .order('grupo_categoria', { ascending: true })
        .order('nome', { ascending: true });

      if (error) throw error;
      setCategories((data || []) as CategoriaMovimentacao[]);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadDespesas = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('despesas_cliente_direto')
        .select('*')
        .eq('client_id', clientId)
        .order('criado_em', { ascending: false });

      if (error) throw error;
      setDespesas((data || []) as DespesaClienteDireto[]);
    } catch (error) {
      console.error('Error loading despesas:', error);
      toast.error('Erro ao carregar despesas');
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${clientId}/${Date.now()}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('client-documents')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('client-documents')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!valor || parseFloat(valor.replace(',', '.')) <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    if (!categoriaId) {
      toast.error('Selecione uma categoria');
      return;
    }

    if (!descricao.trim()) {
      toast.error('Informe uma descrição');
      return;
    }

    if (!dataVencimento) {
      toast.error('Informe a data de vencimento');
      return;
    }

    if (!fornecedorNome.trim()) {
      toast.error('Informe o nome do fornecedor');
      return;
    }

    try {
      setSubmitting(true);

      let boletoUrl = null;
      let notaFiscalUrl = null;

      // Upload files if provided
      if (boletoFile) {
        boletoUrl = await uploadFile(boletoFile, 'boletos');
      }
      if (notaFiscalFile) {
        notaFiscalUrl = await uploadFile(notaFiscalFile, 'notas-fiscais');
      }

      const valorNum = parseFloat(valor.replace(',', '.'));
      const categoria = categories.find(c => c.id === categoriaId);

      const { error } = await (supabase as any)
        .from('despesas_cliente_direto')
        .insert({
          client_id: clientId,
          client_name: clientName,
          aeronave_id: aircraftId || null,
          aeronave_registro: aircraftRegistration || null,
          categoria_id: categoriaId,
          categoria_nome: categoria?.nome || 'Despesa',
          descricao: descricao,
          valor: valorNum,
          data_vencimento: dataVencimento,
          fornecedor_nome: fornecedorNome,
          fornecedor_cnpj: fornecedorCnpj || null,
          status: 'pendente_envio',
          boleto_url: boletoUrl,
          nota_fiscal_url: notaFiscalUrl,
          criado_por: user?.id || null
        } as any);

      if (error) throw error;

      toast.success('Despesa cadastrada com sucesso!');
      
      // Reset form
      setCategoriaId("");
      setDescricao("");
      setValor("");
      setDataVencimento("");
      setFornecedorNome("");
      setFornecedorCnpj("");
      setBoletoFile(null);
      setNotaFiscalFile(null);
      
      // Reload list
      loadDespesas();
    } catch (error) {
      console.error('Error submitting despesa:', error);
      toast.error('Erro ao cadastrar despesa');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendToClient = async (despesa: DespesaClienteDireto) => {
    try {
      const { error } = await (supabase as any)
        .from('despesas_cliente_direto')
        .update({
          status: 'enviado',
          data_envio: format(new Date(), 'yyyy-MM-dd'),
          enviado_por: user?.id || null,
          meio_envio: 'portal'
        })
        .eq('id', despesa.id);

      if (error) throw error;
      
      toast.success('Despesa enviada para o cliente!');
      loadDespesas();
    } catch (error) {
      console.error('Error sending to client:', error);
      toast.error('Erro ao enviar despesa');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta despesa?')) return;

    try {
      const { error } = await (supabase as any)
        .from('despesas_cliente_direto')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Despesa excluída');
      loadDespesas();
    } catch (error) {
      console.error('Error deleting despesa:', error);
      toast.error('Erro ao excluir despesa');
    }
  };

  const openPaymentModal = (despesa: DespesaClienteDireto) => {
    setSelectedDespesa(despesa);
    setDataPagamento(format(new Date(), 'yyyy-MM-dd'));
    setComprovanteFile(null);
    setPaymentModalOpen(true);
  };

  const handleMarkAsPaid = async () => {
    if (!selectedDespesa) return;
    
    if (!dataPagamento) {
      toast.error('Informe a data de pagamento');
      return;
    }

    try {
      setUpdatingPayment(true);

      let comprovanteUrl = null;
      if (comprovanteFile) {
        comprovanteUrl = await uploadFile(comprovanteFile, 'comprovantes');
      }

      const { error } = await (supabase as any)
        .from('despesas_cliente_direto')
        .update({
          status: 'comprovante_recebido',
          data_pagamento_cliente: dataPagamento,
          comprovante_pagamento_url: comprovanteUrl,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', selectedDespesa.id);

      if (error) throw error;

      toast.success('Pagamento registrado!');
      setPaymentModalOpen(false);
      setSelectedDespesa(null);
      loadDespesas();
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('Erro ao registrar pagamento');
    } finally {
      setUpdatingPayment(false);
    }
  };

  const handleValidatePayment = async (despesa: DespesaClienteDireto) => {
    try {
      const { error } = await (supabase as any)
        .from('despesas_cliente_direto')
        .update({
          status: 'pagamento_validado',
          validado_por: user?.id || null,
          data_validacao: new Date().toISOString()
        })
        .eq('id', despesa.id);

      if (error) throw error;
      
      toast.success('Pagamento validado!');
      loadDespesas();
    } catch (error) {
      console.error('Error validating payment:', error);
      toast.error('Erro ao validar pagamento');
    }
  };

  const openDocument = (url: string, title: string) => {
    setDocumentUrl(url);
    setDocumentTitle(title);
    setViewDocumentOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = STATUS_LABELS[status] || { label: status, color: "bg-gray-500/20 text-gray-400" };
    return <Badge className={statusInfo.color}>{statusInfo.label}</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return format(date, "dd/MM/yyyy", { locale: ptBR });
      }
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  // Group categories by grupo_categoria
  const groupedCategories = categories.reduce((acc, cat) => {
    const group = cat.grupo_categoria || 'Outras';
    if (!acc[group]) acc[group] = [];
    acc[group].push(cat);
    return acc;
  }, {} as Record<string, CategoriaMovimentacao[]>);

  return (
    <div className="space-y-6">
      {/* Form Card */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Send className="h-5 w-5 text-primary" />
            Cadastrar Nova Despesa
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Cadastre despesas para enviar ao cliente - {clientName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria *</Label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {Object.entries(groupedCategories).map(([group, cats]) => (
                      <div key={group}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                          {group}
                        </div>
                        {cats.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <span className="flex items-center gap-2">
                              <Tag className="h-3 w-3" />
                              {cat.nome}
                            </span>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$) *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="valor"
                    type="text"
                    placeholder="0,00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataVencimento">Data Vencimento *</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="dataVencimento"
                    type="date"
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fornecedorNome">Fornecedor *</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fornecedorNome"
                    placeholder="Nome do fornecedor"
                    value={fornecedorNome}
                    onChange={(e) => setFornecedorNome(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fornecedorCnpj">CNPJ do Fornecedor</Label>
                <Input
                  id="fornecedorCnpj"
                  placeholder="00.000.000/0000-00"
                  value={fornecedorCnpj}
                  onChange={(e) => setFornecedorCnpj(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Textarea
                id="descricao"
                placeholder="Descrição detalhada da despesa..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Boleto (opcional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setBoletoFile(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                  {boletoFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setBoletoFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {boletoFile && (
                  <p className="text-xs text-muted-foreground">{boletoFile.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Nota Fiscal (opcional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setNotaFiscalFile(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                  {notaFiscalFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setNotaFiscalFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {notaFiscalFile && (
                  <p className="text-xs text-muted-foreground">{notaFiscalFile.name}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>Salvando...</>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Cadastrar Despesa
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Histórico de Despesas */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Receipt className="h-5 w-5 text-primary" />
            Despesas Cadastradas
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Despesas do cliente {clientName} - {aircraftRegistration}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : despesas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma despesa cadastrada ainda
            </div>
          ) : (
            <div className="space-y-3">
              {despesas.map((despesa) => (
                <div
                  key={despesa.id}
                  className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Vencimento</p>
                        <p className="font-medium text-foreground text-sm flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(despesa.data_vencimento)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Categoria</p>
                        <p className="font-medium text-foreground text-sm">
                          {despesa.categoria_nome}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Fornecedor</p>
                        <p className="font-medium text-foreground text-sm flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {despesa.fornecedor_nome}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Valor</p>
                        <p className="font-bold text-primary text-sm flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(despesa.valor)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Status</p>
                        {getStatusBadge(despesa.status)}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {despesa.boleto_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDocument(despesa.boleto_url!, 'Boleto')}
                            className="h-7 px-2"
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Boleto
                          </Button>
                        )}
                        {despesa.nota_fiscal_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDocument(despesa.nota_fiscal_url!, 'Nota Fiscal')}
                            className="h-7 px-2"
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            NF
                          </Button>
                        )}
                        {despesa.comprovante_pagamento_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDocument(despesa.comprovante_pagamento_url!, 'Comprovante')}
                            className="h-7 px-2"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Compr.
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap">
                      {despesa.status === 'pendente_envio' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleSendToClient(despesa)}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Enviar
                        </Button>
                      )}
                      {['enviado', 'aguardando_pagamento'].includes(despesa.status) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPaymentModal(despesa)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Registrar Pgto
                        </Button>
                      )}
                      {despesa.status === 'comprovante_recebido' && (
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleValidatePayment(despesa)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Validar
                        </Button>
                      )}
                      {['pendente_envio', 'cancelado'].includes(despesa.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(despesa.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {despesa.descricao && (
                    <p className="text-sm text-muted-foreground mt-2 pt-2 border-t border-border">
                      {despesa.descricao}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Registre o pagamento desta despesa
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data do Pagamento *</Label>
              <Input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Comprovante de Pagamento</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setComprovanteFile(e.target.files?.[0] || null)}
              />
              {comprovanteFile && (
                <p className="text-xs text-muted-foreground">{comprovanteFile.name}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleMarkAsPaid} disabled={updatingPayment}>
              {updatingPayment ? 'Salvando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Document Modal */}
      <Dialog open={viewDocumentOpen} onOpenChange={setViewDocumentOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{documentTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {documentUrl.toLowerCase().endsWith('.pdf') ? (
              <iframe
                src={documentUrl}
                className="w-full h-[70vh] border rounded-lg"
                title={documentTitle}
              />
            ) : (
              <img
                src={documentUrl}
                alt={documentTitle}
                className="max-w-full h-auto rounded-lg"
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => window.open(documentUrl, '_blank')}
            >
              Abrir em Nova Aba
            </Button>
            <Button onClick={() => setViewDocumentOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
