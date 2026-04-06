import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, Calendar, DollarSign, FileDown, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fromUntyped } from "@/lib/supabase-helpers";
import { useToast } from "@/hooks/use-toast";
import { useCategoriasFinanceiro } from "@/hooks/useCategoriasFinanceiro";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface NotaFiscalEntrada {
  id: string;
  numero: string;
  fornecedor_nome: string;
  fornecedor_cnpj: string;
  data_recebimento: string;
  data_vencimento: string;
  valor: number;
  categoria: string;
  descricao: string;
  status: string;
  data_pagamento_agendado?: string;
  metodo_pagamento?: string;
  arquivo_pdf_url?: string;
  observacoes?: string;
  criado_em?: string;
}

interface Fornecedor {
  id: string;
  nome: string;
  documento: string;
  tipo: 'client' | 'user';
}

const METODOS_PAGAMENTO = ["Boleto", "PIX", "Transferência", "Cheque", "Débito Automático"];

export function NotasFiscaisEntrada() {
  const { getCategoriasDespesa } = useCategoriasFinanceiro();
  const categoriasDespesa = getCategoriasDespesa();

  const [notas, setNotas] = useState<NotaFiscalEntrada[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingNota, setEditingNota] = useState<NotaFiscalEntrada | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [fornecedorSearch, setFornecedorSearch] = useState("");
  const [openFornecedorPopover, setOpenFornecedorPopover] = useState(false);
  const { toast } = useToast();

  const defaultCategoria = categoriasDespesa.length > 0 ? categoriasDespesa[0].nome : "";

  const [formData, setFormData] = useState({
    numero: "",
    fornecedor_nome: "",
    fornecedor_cnpj: "",
    data_recebimento: new Date().toISOString().split("T")[0],
    data_vencimento: new Date().toISOString().split("T")[0],
    valor: "",
    categoria: defaultCategoria,
    descricao: "",
    status: "recebida",
    data_pagamento_agendado: "",
    metodo_pagamento: "",
    observacoes: "",
  });

  useEffect(() => {
    loadNotas();
    loadFornecedores();
  }, []);

  const loadFornecedores = async () => {
    try {
      // Carregar clientes
      const { data: clientsData } = await supabase
        .from("clientes")
        .select("id, razao_social, cnpj")
        .order("razao_social");

      // Carregar funcionários
      const { data: usersData } = await supabase
        .from("user_profiles")
        .select("id, full_name, cpf")
        .order("full_name");

      const fornecedoresList: Fornecedor[] = [];

      if (clientsData) {
        clientsData.forEach(client => {
          if (client.razao_social) {
            fornecedoresList.push({
              id: client.id,
              nome: client.razao_social,
              documento: client.cnpj || "",
              tipo: 'client'
            });
          }
        });
      }

      if (usersData) {
        usersData.forEach(user => {
          if (user.full_name) {
            fornecedoresList.push({
              id: user.id,
              nome: user.full_name,
              documento: user.cpf || "",
              tipo: 'user'
            });
          }
        });
      }

      setFornecedores(fornecedoresList);
    } catch (error) {
      console.error("Erro ao carregar fornecedores:", error);
    }
  };

  const loadNotas = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await fromUntyped("notas_fiscais_entrada")
        .select("*")
        .order("data_recebimento", { ascending: false });

      if (error) throw error;
      setNotas(data || []);
    } catch (error) {
      console.error("Erro ao carregar notas:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar notas fiscais",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.numero || !formData.fornecedor_nome || !formData.valor) {
      toast({
        title: "Validação",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (!formData.categoria) {
      toast({
        title: "Validação",
        description: "Selecione uma categoria",
        variant: "destructive",
      });
      return;
    }

    if (!formData.data_vencimento) {
      toast({
        title: "Validação",
        description: "Preencha a data de vencimento",
        variant: "destructive",
      });
      return;
    }

    // Se está agendando pagamento, verifica se data está preenchida
    if (formData.status === "agendada" && !formData.data_pagamento_agendado) {
      toast({
        title: "Validação",
        description: "Data de pagamento é obrigatória para notas agendadas",
        variant: "destructive",
      });
      return;
    }

    try {
      const notaData = {
        numero: formData.numero,
        fornecedor_nome: formData.fornecedor_nome,
        fornecedor_cnpj: formData.fornecedor_cnpj || "",
        data_recebimento: formData.data_recebimento,
        data_vencimento: formData.data_vencimento,
        valor: parseFloat(formData.valor),
        categoria: formData.categoria,
        descricao: formData.descricao || "",
        status: formData.status,
        data_pagamento_agendado: formData.data_pagamento_agendado || null,
        metodo_pagamento: formData.metodo_pagamento || null,
        observacoes: formData.observacoes || null,
      };

      const { data: { user } } = await supabase.auth.getUser();

      if (editingNota) {
        const { error } = await fromUntyped("notas_fiscais_entrada")
          .update(notaData)
          .eq("id", editingNota.id);

        if (error) throw error;

        // Se status mudou para "paga" durante a edição
        if (notaData.status === "paga" && editingNota.status !== "paga" && user) {
          await fromUntyped("controle_bancario").insert({
            descricao: `NF Entrada ${notaData.numero} - ${notaData.fornecedor_nome}`,
            valor: notaData.valor,
            data: new Date().toISOString().split("T")[0],
            tipo_movimento: "saída",
            categoria: notaData.categoria || "Despesa de Serviços",
            status: "confirmado",
            numero_documento: notaData.numero,
            referencia: `nf_entrada_${editingNota.id}`,
            criado_por: user.id
          });
        }

        toast({
          title: "Sucesso",
          description: "Nota fiscal atualizada com sucesso",
        });
      } else {
        const { data: insertedNota, error } = await fromUntyped("notas_fiscais_entrada")
          .insert([notaData])
          .select()
          .single();

        if (error) throw error;

        // Se criada já com status "paga"
        if (notaData.status === "paga" && user && insertedNota) {
          await fromUntyped("controle_bancario").insert({
            descricao: `NF Entrada ${notaData.numero} - ${notaData.fornecedor_nome}`,
            valor: notaData.valor,
            data: new Date().toISOString().split("T")[0],
            tipo_movimento: "saída",
            categoria: notaData.categoria || "Despesa de Serviços",
            status: "confirmado",
            numero_documento: notaData.numero,
            referencia: `nf_entrada_${insertedNota.id}`,
            criado_por: user.id
          });
        }

        toast({
          title: "Sucesso",
          description: "Nota fiscal criada com sucesso",
        });
      }

      setOpenDialog(false);
      resetForm();
      loadNotas();
    } catch (error) {
      console.error("Erro ao salvar nota:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar nota fiscal",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await fromUntyped("notas_fiscais_entrada")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;
      toast({
        title: "Sucesso",
        description: "Nota fiscal deletada com sucesso",
      });
      setDeleteId(null);
      loadNotas();
    } catch (error) {
      console.error("Erro ao deletar nota:", error);
      toast({
        title: "Erro",
        description: "Erro ao deletar nota fiscal",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (nota: NotaFiscalEntrada) => {
    setEditingNota(nota);
    setFormData({
      numero: nota.numero,
      fornecedor_nome: nota.fornecedor_nome,
      fornecedor_cnpj: nota.fornecedor_cnpj,
      data_recebimento: nota.data_recebimento,
      data_vencimento: nota.data_vencimento,
      valor: nota.valor.toString(),
      categoria: nota.categoria,
      descricao: nota.descricao,
      status: nota.status,
      data_pagamento_agendado: nota.data_pagamento_agendado || "",
      metodo_pagamento: nota.metodo_pagamento || "",
      observacoes: nota.observacoes || "",
    });
    setOpenDialog(true);
  };

  const resetForm = () => {
    setFormData({
      numero: "",
      fornecedor_nome: "",
      fornecedor_cnpj: "",
      data_recebimento: new Date().toISOString().split("T")[0],
      data_vencimento: new Date().toISOString().split("T")[0],
      valor: "",
      categoria: defaultCategoria,
      descricao: "",
      status: "recebida",
      data_pagamento_agendado: "",
      metodo_pagamento: "",
      observacoes: "",
    });
    setEditingNota(null);
    setArquivo(null);
    setFornecedorSearch("");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paga":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "agendada":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "recebida":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "cancelada":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleChangeStatus = async (notaId: string, newStatus: string) => {
    try {
      const nota = notas.find(n => n.id === notaId);
      if (!nota) return;

      const { error } = await fromUntyped("notas_fiscais_entrada")
        .update({ status: newStatus })
        .eq("id", notaId);

      if (error) throw error;

      // Se o novo status é "paga", criar saída no fluxo de caixa
      if (newStatus === "paga") {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error: fluxoError } = await fromUntyped("controle_bancario")
            .insert({
              descricao: `NF Entrada ${nota.numero} - ${nota.fornecedor_nome}`,
              valor: nota.valor,
              data: new Date().toISOString().split("T")[0],
              tipo_movimento: "saída",
              categoria: nota.categoria || "Despesa de Serviços",
              status: "confirmado",
              numero_documento: nota.numero,
              referencia: `nf_entrada_${notaId}`,
              criado_por: user.id
            });

          if (fluxoError) {
            console.error("Erro ao criar saída no fluxo:", fluxoError);
          }
        }
      }

      toast({
        title: "Sucesso",
        description: newStatus === "paga"
          ? "Status atualizado e saída criada no fluxo de caixa"
          : "Status atualizado com sucesso",
      });
      loadNotas();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status",
        variant: "destructive",
      });
    }
  };

  const handleSelectFornecedor = (fornecedor: Fornecedor) => {
    setFormData({
      ...formData,
      fornecedor_nome: fornecedor.nome,
      fornecedor_cnpj: fornecedor.documento
    });
    setOpenFornecedorPopover(false);
    setFornecedorSearch("");
  };

  const filteredFornecedores = fornecedores.filter(f =>
    f.nome.toLowerCase().includes(fornecedorSearch.toLowerCase()) ||
    f.documento.includes(fornecedorSearch)
  );

  const totalReceber = notas
    .filter((n) => n.status === "recebida")
    .reduce((acc, n) => acc + n.valor, 0);

  const totalAgendado = notas
    .filter((n) => n.status === "agendada")
    .reduce((acc, n) => acc + n.valor, 0);

  const totalPago = notas
    .filter((n) => n.status === "paga")
    .reduce((acc, n) => acc + n.valor, 0);

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 via-card to-card border-blue-500/20 shadow-lg shadow-blue-500/5 hover:shadow-lg hover:shadow-blue-500/10 transition-shadow duration-300">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm font-medium">Total de Notas</p>
                <div className="p-2.5 rounded-lg bg-blue-500/20 border border-blue-500/30">
                  <FileDown className="w-5 h-5 text-blue-500" />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground">{notas.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 via-card to-card border-orange-500/20 shadow-lg shadow-orange-500/5 hover:shadow-lg hover:shadow-orange-500/10 transition-shadow duration-300">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-muted-foreground text-sm font-medium">Aguardando Pagamento</p>
                <div className="flex-shrink-0 p-2.5 rounded-lg bg-orange-500/20 border border-orange-500/30">
                  <DollarSign className="w-5 h-5 text-orange-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-orange-500">
                R$ {totalReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 via-card to-card border-cyan-500/20 shadow-lg shadow-cyan-500/5 hover:shadow-lg hover:shadow-cyan-500/10 transition-shadow duration-300">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-muted-foreground text-sm font-medium">Agendado para Pagar</p>
                <div className="flex-shrink-0 p-2.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
                  <Calendar className="w-5 h-5 text-cyan-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-cyan-500">
                R$ {totalAgendado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 via-card to-card border-green-500/20 shadow-lg shadow-green-500/5 hover:shadow-lg hover:shadow-green-500/10 transition-shadow duration-300">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-muted-foreground text-sm font-medium">Já Pago</p>
                <div className="flex-shrink-0 p-2.5 rounded-lg bg-green-500/20 border border-green-500/30">
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-green-500">
                R$ {totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulário para Nova/Editar Nota - Renderizado Inline */}
      {openDialog && (
        <Card className="bg-gradient-to-br from-green-600/10 to-card border-green-500/30 shadow-lg mb-6">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground">
                {editingNota ? "Editar Nota Fiscal" : "Nova Nota Fiscal de Entrada"}
              </CardTitle>
              <Button
                variant="ghost"
                onClick={() => { setOpenDialog(false); resetForm(); }}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">Número da NF *</Label>
                <Input
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  placeholder="NF-001/2025"
                  className="bg-background border-border"
                />
              </div>
              <div>
                <Label className="text-foreground">Data de Recebimento *</Label>
                <Input
                  type="data"
                  value={formData.data_recebimento}
                  onChange={(e) => setFormData({ ...formData, data_recebimento: e.target.value })}
                  className="bg-background border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">Fornecedor/Empresa *</Label>
                <Popover open={openFornecedorPopover} onOpenChange={setOpenFornecedorPopover}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <Input
                        value={formData.fornecedor_nome}
                        onChange={(e) => {
                          setFormData({ ...formData, fornecedor_nome: e.target.value });
                          setFornecedorSearch(e.target.value);
                          setOpenFornecedorPopover(true);
                        }}
                        onFocus={() => setOpenFornecedorPopover(true)}
                        placeholder="Buscar cliente ou funcionário..."
                        className="bg-background border-border pr-10"
                      />
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0 bg-card border-border" align="start">
                    <Command className="bg-card">
                      <CommandInput
                        placeholder="Buscar..."
                        value={fornecedorSearch}
                        onValueChange={setFornecedorSearch}
                        className="bg-background"
                      />
                      <CommandList>
                        <CommandEmpty className="text-muted-foreground py-3 text-center text-sm">
                          Nenhum resultado encontrado
                        </CommandEmpty>
                        <CommandGroup heading="Clientes" className="text-muted-foreground">
                          {filteredFornecedores.filter(f => f.tipo === 'client').slice(0, 5).map((f) => (
                            <CommandItem
                              key={f.id}
                              onSelect={() => handleSelectFornecedor(f)}
                              className="cursor-pointer hover:bg-muted"
                            >
                              <div>
                                <p className="font-medium text-foreground">{f.nome}</p>
                                {f.documento && <p className="text-xs text-muted-foreground">{f.documento}</p>}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <CommandGroup heading="Funcionários" className="text-muted-foreground">
                          {filteredFornecedores.filter(f => f.tipo === 'user').slice(0, 5).map((f) => (
                            <CommandItem
                              key={f.id}
                              onSelect={() => handleSelectFornecedor(f)}
                              className="cursor-pointer hover:bg-muted"
                            >
                              <div>
                                <p className="font-medium text-foreground">{f.nome}</p>
                                {f.documento && <p className="text-xs text-muted-foreground">{f.documento}</p>}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-foreground">CNPJ/CPF</Label>
                <Input
                  value={formData.fornecedor_cnpj}
                  onChange={(e) => setFormData({ ...formData, fornecedor_cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                  className="bg-background border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">Data de Vencimento *</Label>
                <Input
                  type="data"
                  value={formData.data_vencimento}
                  onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                  className="bg-background border-border"
                />
              </div>
              <div>
                <Label className="text-foreground">Valor (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                  placeholder="0.00"
                  className="bg-background border-border"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">Categoria *</Label>
                <Select value={formData.categoria} onValueChange={(value) => setFormData({ ...formData, categoria: value })}>
                  <SelectTrigger className="w-full bg-background border-border">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border" align="start">
                    {categoriasDespesa.map((cat) => (
                      <SelectItem key={cat.id} value={cat.nome}>
                        {cat.nome}
                      </SelectItem>
                    ))}
                    {categoriasDespesa.length === 0 && (
                      <div className="text-center py-3 text-muted-foreground text-sm">
                        Nenhuma categoria disponível
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-foreground">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as any })}>
                  <SelectTrigger className="w-full bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border" align="start">
                    <SelectItem value="recebida">Recebida</SelectItem>
                    <SelectItem value="agendada">Agendada para Pagar</SelectItem>
                    <SelectItem value="paga">Paga</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.status === "agendada" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-foreground">Data do Pagamento Agendado *</Label>
                  <Input
                    type="data"
                    value={formData.data_pagamento_agendado}
                    onChange={(e) => setFormData({ ...formData, data_pagamento_agendado: e.target.value })}
                    className="bg-background border-border"
                  />
                </div>
                <div>
                  <Label className="text-foreground">Método de Pagamento</Label>
                  <Select value={formData.metodo_pagamento} onValueChange={(value) => setFormData({ ...formData, metodo_pagamento: value })}>
                    <SelectTrigger className="w-full bg-background border-border">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border" align="start">
                      {METODOS_PAGAMENTO.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div>
              <Label className="text-foreground">Descrição do Serviço/Produto</Label>
              <Input
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição detalhada"
                className="bg-background border-border"
              />
            </div>

            <div>
              <Label className="text-foreground">Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações adicionais"
                className="bg-background border-border"
              />
            </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setOpenDialog(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={handleSave}>
                  {editingNota ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botão para Nova Nota Fiscal */}
      {!openDialog && (
        <Button className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg shadow-green-500/30 flex items-center gap-2 font-medium mb-6"  onClick={() => setOpenDialog(true)}>
          <Plus className="w-4 h-4" />
          Nova Nota Fiscal de Entrada
        </Button>
      )}

      {/* Tabela de Notas */}
      <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/60 shadow-lg">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Notas Fiscais de Entrada</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
              Carregando...
            </div>
          ) : notas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileDown className="w-12 h-12 opacity-20 mx-auto mb-3" />
              Nenhuma nota fiscal de entrada
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/40">
              <Table>
                <TableHeader className="bg-muted/30 border-b border-border/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Número</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Fornecedor</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Recebimento</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Vencimento</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3 text-right">Valor</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Categoria</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Status</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notas.map((nota, idx) => (
                    <TableRow key={nota.id} className={`border-b border-border/30 hover:bg-muted/40 transition-colors ${idx % 2 === 0 ? 'bg-muted/10' : ''}`}>
                      <TableCell className="font-semibold text-foreground px-4 py-3">{nota.numero}</TableCell>
                      <TableCell className="text-foreground px-4 py-3">{nota.fornecedor_nome}</TableCell>
                      <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                        {format(new Date(nota.data_recebimento + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                        {format(new Date(nota.data_vencimento + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-foreground font-semibold px-4 py-3 text-right text-red-500">
                        R$ {nota.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-muted-foreground px-4 py-3 text-sm">{nota.categoria}</TableCell>
                      <TableCell className="px-4 py-3">
                        <Select
                          value={nota.status}
                          onValueChange={(value) => handleChangeStatus(nota.id, value)}
                        >
                          <SelectTrigger className={`w-[130px] h-8 text-xs font-medium border rounded-lg ${getStatusColor(nota.status)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="recebida">Recebida</SelectItem>
                            <SelectItem value="agendada">Agendada</SelectItem>
                            <SelectItem value="paga">Paga</SelectItem>
                            <SelectItem value="cancelada">Cancelada</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(nota)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
                            onClick={() => setDeleteId(nota.id)}
                            title="Deletar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">Tem certeza que deseja excluir esta nota fiscal?</p>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
