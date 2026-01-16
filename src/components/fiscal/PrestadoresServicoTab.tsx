import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, Save, Upload, Eye, FileText, Trash2, Loader2, 
  Building2, User, Phone, Mail, MapPin, CreditCard, 
  Receipt, Calendar, DollarSign, CheckCircle2, Clock, X,
  Edit, Search
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategoriasConta } from "@/hooks/useCategoriasFinanceiro";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Prestador {
  id: string;
  nome: string;
  cpf_cnpj: string;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  pix: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
}

interface NotaFiscal {
  id: string;
  prestador_id: string;
  numero_nota: string;
  valor: number;
  descricao: string | null;
  mes_referencia: number;
  ano_referencia: number;
  data_emissao: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string;
  arquivo_nota_url: string | null;
  comprovante_pagamento_url: string | null;
  controle_bancario_id: string | null;
  observacoes: string | null;
}

const MONTHS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", 
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", 
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export function PrestadoresServicoTab() {
  const { user } = useAuth();
  const { contas } = useCategoriasConta();
  
  const [activeTab, setActiveTab] = useState<"prestadores" | "notas">("prestadores");
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialog states
  const [showPrestadorDialog, setShowPrestadorDialog] = useState(false);
  const [showNotaDialog, setShowNotaDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Form states
  const [editingPrestador, setEditingPrestador] = useState<Prestador | null>(null);
  const [editingNota, setEditingNota] = useState<NotaFiscal | null>(null);
  const [selectedPrestadorId, setSelectedPrestadorId] = useState<string | null>(null);
  
  // Filter states for notas
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterPrestador, setFilterPrestador] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const bancosFromContas = Array.from(new Set(contas.map(c => c.banco).filter(Boolean))) as string[];

  const fetchPrestadores = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("prestadores_servico")
        .select("*")
        .order("nome");
      
      if (error) throw error;
      setPrestadores(data || []);
    } catch (error) {
      console.error("Erro ao carregar prestadores:", error);
      toast.error("Erro ao carregar prestadores");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchNotas = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("prestador_notas_fiscais")
        .select("*")
        .eq("mes_referencia", filterMonth)
        .eq("ano_referencia", filterYear)
        .order("data_emissao", { ascending: false });
      
      if (filterPrestador !== "all") {
        query = query.eq("prestador_id", filterPrestador);
      }
      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setNotas(data || []);
    } catch (error) {
      console.error("Erro ao carregar notas fiscais:", error);
      toast.error("Erro ao carregar notas fiscais");
    } finally {
      setIsLoading(false);
    }
  }, [filterMonth, filterYear, filterPrestador, filterStatus]);

  useEffect(() => {
    fetchPrestadores();
  }, [fetchPrestadores]);

  useEffect(() => {
    if (activeTab === "notas") {
      fetchNotas();
    }
  }, [activeTab, fetchNotas]);

  const handleSavePrestador = async (formData: Partial<Prestador>) => {
    try {
      if (editingPrestador?.id) {
        const { error } = await supabase
          .from("prestadores_servico")
          .update(formData)
          .eq("id", editingPrestador.id);
        if (error) throw error;
        toast.success("Prestador atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("prestadores_servico")
          .insert(formData);
        if (error) throw error;
        toast.success("Prestador cadastrado com sucesso!");
      }
      setShowPrestadorDialog(false);
      setEditingPrestador(null);
      fetchPrestadores();
    } catch (error) {
      console.error("Erro ao salvar prestador:", error);
      toast.error("Erro ao salvar prestador");
    }
  };

  const handleDeletePrestador = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este prestador?")) return;
    try {
      const { error } = await supabase
        .from("prestadores_servico")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Prestador excluído com sucesso!");
      fetchPrestadores();
    } catch (error) {
      console.error("Erro ao excluir prestador:", error);
      toast.error("Erro ao excluir prestador");
    }
  };

  const handleSaveNota = async (formData: Partial<NotaFiscal>) => {
    try {
      if (editingNota?.id) {
        const { error } = await supabase
          .from("prestador_notas_fiscais")
          .update(formData)
          .eq("id", editingNota.id);
        if (error) throw error;
        toast.success("Nota fiscal atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("prestador_notas_fiscais")
          .insert(formData);
        if (error) throw error;
        toast.success("Nota fiscal cadastrada com sucesso!");
      }
      setShowNotaDialog(false);
      setEditingNota(null);
      fetchNotas();
    } catch (error) {
      console.error("Erro ao salvar nota fiscal:", error);
      toast.error("Erro ao salvar nota fiscal");
    }
  };

  const handlePayNota = async (nota: NotaFiscal, banco: string, dataPagamento: string) => {
    try {
      // Register payment in controle_bancario
      const { data: lancamento, error: lancamentoError } = await supabase
        .from("controle_bancario")
        .insert({
          descricao: `Pagamento NF ${nota.numero_nota} - Prestador PJ`,
          tipo_movimento: "saida",
          valor: nota.valor,
          data: dataPagamento,
          categoria_id: null,
          categoria: "Pagamento Salário Colaborador P.J",
          grupo_categoria: "FOLHA DE PAGAMENTO",
          metodo_pagamento: "Transferência",
          banco: banco,
          status: "confirmado",
          criado_por: user?.id,
        })
        .select()
        .single();
      
      if (lancamentoError) throw lancamentoError;

      // Update nota fiscal status
      const { error: notaError } = await supabase
        .from("prestador_notas_fiscais")
        .update({
          status: "pago",
          data_pagamento: dataPagamento,
          controle_bancario_id: lancamento.id,
        })
        .eq("id", nota.id);
      
      if (notaError) throw notaError;

      toast.success("Pagamento registrado com sucesso!");
      fetchNotas();
    } catch (error) {
      console.error("Erro ao registrar pagamento:", error);
      toast.error("Erro ao registrar pagamento");
    }
  };

  const handleDeleteNota = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta nota fiscal?")) return;
    try {
      const { error } = await supabase
        .from("prestador_notas_fiscais")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Nota fiscal excluída com sucesso!");
      fetchNotas();
    } catch (error) {
      console.error("Erro ao excluir nota fiscal:", error);
      toast.error("Erro ao excluir nota fiscal");
    }
  };

  const handleUploadFile = async (file: File, type: "nota" | "comprovante", notaId: string) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${notaId}_${type}_${Date.now()}.${fileExt}`;
      const filePath = `prestadores/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      const updateField = type === "nota" ? "arquivo_nota_url" : "comprovante_pagamento_url";
      const { error: updateError } = await supabase
        .from("prestador_notas_fiscais")
        .update({ [updateField]: urlData.publicUrl })
        .eq("id", notaId);

      if (updateError) throw updateError;

      toast.success("Arquivo enviado com sucesso!");
      fetchNotas();
    } catch (error) {
      console.error("Erro ao enviar arquivo:", error);
      toast.error("Erro ao enviar arquivo");
    }
  };

  const filteredPrestadores = prestadores.filter(p =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cpf_cnpj.includes(searchTerm)
  );

  const getPrestadorNome = (prestadorId: string) => {
    const prestador = prestadores.find(p => p.id === prestadorId);
    return prestador?.nome || "Desconhecido";
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Prestadores de Serviço PJ
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie prestadores de serviço e suas notas fiscais
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "prestadores" | "notas")} className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="prestadores" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow">
            <User className="h-4 w-4 mr-2" />
            Cadastro de Prestadores
          </TabsTrigger>
          <TabsTrigger value="notas" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow">
            <Receipt className="h-4 w-4 mr-2" />
            Notas Fiscais
          </TabsTrigger>
        </TabsList>

        {/* Prestadores Tab */}
        <TabsContent value="prestadores" className="mt-6">
          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Prestadores Cadastrados</CardTitle>
                  <CardDescription>Lista de prestadores de serviço PJ</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Button onClick={() => { setEditingPrestador(null); setShowPrestadorDialog(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Prestador
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredPrestadores.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Nenhum prestador cadastrado</p>
                  <Button variant="link" onClick={() => setShowPrestadorDialog(true)}>
                    Cadastrar primeiro prestador
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredPrestadores.map((prestador) => (
                    <Card key={prestador.id} className={`relative overflow-hidden transition-all hover:shadow-md ${!prestador.ativo ? 'opacity-60' : ''}`}>
                      {!prestador.ativo && (
                        <div className="absolute top-2 right-2">
                          <Badge variant="secondary">Inativo</Badge>
                        </div>
                      )}
                      <CardContent className="pt-5">
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-foreground truncate">{prestador.nome}</h3>
                              <p className="text-sm text-muted-foreground">{prestador.cpf_cnpj}</p>
                            </div>
                          </div>
                          
                          {prestador.email && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              <span className="truncate">{prestador.email}</span>
                            </div>
                          )}
                          
                          {prestador.telefone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              <span>{prestador.telefone}</span>
                            </div>
                          )}
                          
                          {(prestador.cidade || prestador.uf) && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>{[prestador.cidade, prestador.uf].filter(Boolean).join(" - ")}</span>
                            </div>
                          )}

                          {prestador.banco && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CreditCard className="h-3.5 w-3.5" />
                              <span>{prestador.banco}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => { setEditingPrestador(prestador); setShowPrestadorDialog(true); }}
                          >
                            <Edit className="h-3.5 w-3.5 mr-1.5" />
                            Editar
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex-1"
                            onClick={() => { 
                              setSelectedPrestadorId(prestador.id); 
                              setEditingNota(null);
                              setShowNotaDialog(true); 
                            }}
                          >
                            <Receipt className="h-3.5 w-3.5 mr-1.5" />
                            Nova NF
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeletePrestador(prestador.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notas Fiscais Tab */}
        <TabsContent value="notas" className="mt-6">
          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Notas Fiscais de Prestadores</CardTitle>
                  <CardDescription>Controle de notas fiscais e pagamentos</CardDescription>
                </div>
                <Button onClick={() => { setEditingNota(null); setSelectedPrestadorId(null); setShowNotaDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Nota Fiscal
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-6 p-4 bg-muted/30 rounded-xl">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Mês</Label>
                  <Select value={String(filterMonth)} onValueChange={(v) => setFilterMonth(Number(v))}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ano</Label>
                  <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(Number(v))}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Prestador</Label>
                  <Select value={filterPrestador} onValueChange={setFilterPrestador}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {prestadores.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notas Table */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : notas.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Nenhuma nota fiscal encontrada para o período</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Prestador</TableHead>
                        <TableHead>Nº Nota</TableHead>
                        <TableHead>Emissão</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Arquivos</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notas.map((nota) => (
                        <NotaFiscalRow
                          key={nota.id}
                          nota={nota}
                          prestadorNome={getPrestadorNome(nota.prestador_id)}
                          bancos={bancosFromContas}
                          onPay={handlePayNota}
                          onEdit={(n) => { setEditingNota(n); setSelectedPrestadorId(n.prestador_id); setShowNotaDialog(true); }}
                          onDelete={handleDeleteNota}
                          onUpload={handleUploadFile}
                          onPreview={(url) => { setPreviewUrl(url); setShowPreviewDialog(true); }}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Summary */}
              {notas.length > 0 && (
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-muted/30 border-0">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Receipt className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total Notas</p>
                          <p className="text-lg font-bold">{notas.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30 border-0">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                          <Clock className="h-4 w-4 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Pendentes</p>
                          <p className="text-lg font-bold text-amber-500">
                            R$ {notas.filter(n => n.status === 'pendente').reduce((s, n) => s + Number(n.valor), 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30 border-0">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Pagos</p>
                          <p className="text-lg font-bold text-green-500">
                            R$ {notas.filter(n => n.status === 'pago').reduce((s, n) => s + Number(n.valor), 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30 border-0">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                          <DollarSign className="h-4 w-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total Período</p>
                          <p className="text-lg font-bold text-blue-500">
                            R$ {notas.reduce((s, n) => s + Number(n.valor), 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Prestador Dialog */}
      <PrestadorFormDialog
        open={showPrestadorDialog}
        onOpenChange={setShowPrestadorDialog}
        prestador={editingPrestador}
        bancos={bancosFromContas}
        onSave={handleSavePrestador}
      />

      {/* Nota Fiscal Dialog */}
      <NotaFiscalFormDialog
        open={showNotaDialog}
        onOpenChange={setShowNotaDialog}
        nota={editingNota}
        prestadores={prestadores}
        selectedPrestadorId={selectedPrestadorId}
        onSave={handleSaveNota}
      />

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Visualizar Documento</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe src={previewUrl} className="w-full h-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Nota Fiscal Row Component
interface NotaFiscalRowProps {
  nota: NotaFiscal;
  prestadorNome: string;
  bancos: string[];
  onPay: (nota: NotaFiscal, banco: string, data: string) => void;
  onEdit: (nota: NotaFiscal) => void;
  onDelete: (id: string) => void;
  onUpload: (file: File, type: "nota" | "comprovante", notaId: string) => void;
  onPreview: (url: string) => void;
}

function NotaFiscalRow({ nota, prestadorNome, bancos, onPay, onEdit, onDelete, onUpload, onPreview }: NotaFiscalRowProps) {
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [payBanco, setPayBanco] = useState("");
  const [payData, setPayData] = useState(format(new Date(), "yyyy-MM-dd"));

  const statusColors: Record<string, string> = {
    pendente: "bg-amber-100 text-amber-700 border-amber-200",
    pago: "bg-green-100 text-green-700 border-green-200",
    cancelado: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">{prestadorNome}</TableCell>
        <TableCell>{nota.numero_nota}</TableCell>
        <TableCell>{format(new Date(nota.data_emissao), "dd/MM/yyyy")}</TableCell>
        <TableCell className="text-right font-semibold">
          R$ {Number(nota.valor).toFixed(2)}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={statusColors[nota.status]}>
            {nota.status === "pendente" && <Clock className="h-3 w-3 mr-1" />}
            {nota.status === "pago" && <CheckCircle2 className="h-3 w-3 mr-1" />}
            {nota.status === "cancelado" && <X className="h-3 w-3 mr-1" />}
            {nota.status.charAt(0).toUpperCase() + nota.status.slice(1)}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            {nota.arquivo_nota_url ? (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPreview(nota.arquivo_nota_url!)}>
                <FileText className="h-3.5 w-3.5 text-primary" />
              </Button>
            ) : (
              <label className="cursor-pointer">
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0], "nota", nota.id)} />
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                  <span><Upload className="h-3.5 w-3.5 text-muted-foreground" /></span>
                </Button>
              </label>
            )}
            {nota.status === "pago" && (
              nota.comprovante_pagamento_url ? (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPreview(nota.comprovante_pagamento_url!)}>
                  <Receipt className="h-3.5 w-3.5 text-green-600" />
                </Button>
              ) : (
                <label className="cursor-pointer">
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0], "comprovante", nota.id)} />
                  <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                    <span><Upload className="h-3.5 w-3.5 text-muted-foreground" /></span>
                  </Button>
                </label>
              )
            )}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            {nota.status === "pendente" && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowPayDialog(true)}>
                <DollarSign className="h-3 w-3 mr-1" />
                Pagar
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(nota)}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(nota.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* Pay Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Confirmar pagamento da NF {nota.numero_nota} no valor de R$ {Number(nota.valor).toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Banco</Label>
              <Select value={payBanco} onValueChange={setPayBanco}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent>
                  {bancos.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data do Pagamento</Label>
              <Input type="date" value={payData} onChange={(e) => setPayData(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>Cancelar</Button>
            <Button 
              onClick={() => { onPay(nota, payBanco, payData); setShowPayDialog(false); }}
              disabled={!payBanco || !payData}
            >
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Prestador Form Dialog
interface PrestadorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prestador: Prestador | null;
  bancos: string[];
  onSave: (data: Partial<Prestador>) => void;
}

function PrestadorFormDialog({ open, onOpenChange, prestador, bancos, onSave }: PrestadorFormDialogProps) {
  const [formData, setFormData] = useState<Partial<Prestador>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (prestador) {
      setFormData(prestador);
    } else {
      setFormData({ ativo: true });
    }
  }, [prestador, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.cpf_cnpj) {
      toast.error("Nome e CPF/CNPJ são obrigatórios");
      return;
    }
    setIsSaving(true);
    await onSave(formData);
    setIsSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{prestador ? "Editar Prestador" : "Novo Prestador"}</DialogTitle>
          <DialogDescription>
            Preencha os dados do prestador de serviço
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados Pessoais
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Nome Completo *</Label>
                <Input
                  value={formData.nome || ""}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome do prestador"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>CPF/CNPJ *</Label>
                <Input
                  value={formData.cpf_cnpj || ""}
                  onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                  placeholder="000.000.000-00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={formData.telefone || ""}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Endereço
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Endereço</Label>
                <Input
                  value={formData.endereco || ""}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  placeholder="Rua, número, bairro"
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={formData.cidade || ""}
                  onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                  placeholder="Cidade"
                />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Select value={formData.uf || ""} onValueChange={(v) => setFormData({ ...formData, uf: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Bank Info */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Dados Bancários
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Banco</Label>
                <Input
                  value={formData.banco || ""}
                  onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                  placeholder="Nome do banco"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de Conta</Label>
                <Select value={formData.tipo_conta || ""} onValueChange={(v) => setFormData({ ...formData, tipo_conta: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Agência</Label>
                <Input
                  value={formData.agencia || ""}
                  onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
                  placeholder="0000"
                />
              </div>
              <div className="space-y-2">
                <Label>Conta</Label>
                <Input
                  value={formData.conta || ""}
                  onChange={(e) => setFormData({ ...formData, conta: e.target.value })}
                  placeholder="00000-0"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Chave PIX</Label>
                <Input
                  value={formData.pix || ""}
                  onChange={(e) => setFormData({ ...formData, pix: e.target.value })}
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                />
              </div>
            </div>
          </div>

          {/* Observations */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.observacoes || ""}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {prestador ? "Salvar Alterações" : "Cadastrar Prestador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Nota Fiscal Form Dialog
interface NotaFiscalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nota: NotaFiscal | null;
  prestadores: Prestador[];
  selectedPrestadorId: string | null;
  onSave: (data: Partial<NotaFiscal>) => void;
}

function NotaFiscalFormDialog({ open, onOpenChange, nota, prestadores, selectedPrestadorId, onSave }: NotaFiscalFormDialogProps) {
  const [formData, setFormData] = useState<Partial<NotaFiscal>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (nota) {
      setFormData(nota);
    } else {
      const today = new Date();
      setFormData({
        prestador_id: selectedPrestadorId || "",
        mes_referencia: today.getMonth() + 1,
        ano_referencia: today.getFullYear(),
        data_emissao: format(today, "yyyy-MM-dd"),
        status: "pendente",
      });
    }
  }, [nota, selectedPrestadorId, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.prestador_id || !formData.numero_nota || !formData.valor || !formData.data_emissao) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setIsSaving(true);
    await onSave(formData);
    setIsSaving(false);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{nota ? "Editar Nota Fiscal" : "Nova Nota Fiscal"}</DialogTitle>
          <DialogDescription>
            Registre a nota fiscal do prestador de serviço
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Prestador *</Label>
            <Select 
              value={formData.prestador_id || ""} 
              onValueChange={(v) => setFormData({ ...formData, prestador_id: v })}
              disabled={!!selectedPrestadorId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o prestador" />
              </SelectTrigger>
              <SelectContent>
                {prestadores.filter(p => p.ativo).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Número da Nota *</Label>
              <Input
                value={formData.numero_nota || ""}
                onChange={(e) => setFormData({ ...formData, numero_nota: e.target.value })}
                placeholder="NF-000"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.valor || ""}
                onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) })}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mês Referência</Label>
              <Select value={String(formData.mes_referencia || "")} onValueChange={(v) => setFormData({ ...formData, mes_referencia: Number(v) })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano Referência</Label>
              <Select value={String(formData.ano_referencia || "")} onValueChange={(v) => setFormData({ ...formData, ano_referencia: Number(v) })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Emissão *</Label>
              <Input
                type="date"
                value={formData.data_emissao || ""}
                onChange={(e) => setFormData({ ...formData, data_emissao: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Vencimento</Label>
              <Input
                type="date"
                value={formData.data_vencimento || ""}
                onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={formData.descricao || ""}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descrição do serviço prestado..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.observacoes || ""}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Observações adicionais..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {nota ? "Salvar Alterações" : "Cadastrar Nota Fiscal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
