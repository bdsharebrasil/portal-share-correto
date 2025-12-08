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
import { Plus, Edit2, Trash2, Eye, FileUp, DollarSign, Search, X, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCategoriasFinanceiro } from "@/hooks/useCategoriasFinanceiro";
import { useAeronaves } from "@/hooks/useAeronaves";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCategoriasConta } from "@/hooks/useCategoriasFinanceiro";

interface NotaFiscalSaida {
  id: string;
  numero: string;
  cliente_nome: string;
  cliente_cnpj: string;
  data_criacao: string;
  data_vencimento: string;
  valor: number;
  categoria: string;
  descricao: string;
  status: string;
  arquivo_pdf_url?: string;
  criado_em?: string;
  aircraft_id?: string;
  aeronave_registration?: string;
}

interface Cliente {
  id: string;
  nome: string;
  documento: string;
}

export function NotasFiscaisSaida() {
  const { getCategoriasReceita } = useCategoriasFinanceiro();
  const categoriasReceita = getCategoriasReceita();
  const { aeronaves, isLoadingAeronaves } = useAeronaves();

  const [notas, setNotas] = useState<NotaFiscalSaida[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingNota, setEditingNota] = useState<NotaFiscalSaida | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [openClientePopover, setOpenClientePopover] = useState(false);
  const [aeronaveSearch, setAeronaveSearch] = useState("");
  const [openAeronavePopover, setOpenAeronavePopover] = useState(false);
  const [isUploadingPDF, setIsUploadingPDF] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [selectedBankForStatus, setSelectedBankForStatus] = useState<string>("");
  const [notaBeingStatusChanged, setNotaBeingStatusChanged] = useState<NotaFiscalSaida | null>(null);
  const { contas } = useCategoriasConta();
  const bancos = Array.from(new Set(contas.map(c => c.banco).filter(Boolean))) as string[];
  const { toast } = useToast();

  const defaultCategoria = categoriasReceita.length > 0 ? categoriasReceita[0].nome : "";

  const [formData, setFormData] = useState({
    numero: "",
    cliente_nome: "",
    cliente_cnpj: "",
    data_criacao: new Date().toISOString().split("T")[0],
    data_vencimento: "",
    valor: "",
    categoria: defaultCategoria,
    descricao: "",
    status: "pendente",
    aircraft_id: "",
    aeronave_registration: "",
  });

  useEffect(() => {
    loadNotas();
    loadClientes();
  }, []);

  const loadClientes = async () => {
    try {
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, company_name, cnpj")
        .order("company_name");

      const clientesList: Cliente[] = [];

      if (clientsData) {
        clientsData.forEach(client => {
          if (client.company_name) {
            clientesList.push({
              id: client.id,
              nome: client.company_name,
              documento: client.cnpj || ""
            });
          }
        });
      }

      setClientes(clientesList);
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
    }
  };

  const loadNotas = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("notas_fiscais_saida")
        .select("*")
        .order("data_criacao", { ascending: false });

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
    if (!formData.numero || !formData.cliente_nome || !formData.valor) {
      toast({
        title: "Validação",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const notaData: any = {
        numero: formData.numero,
        cliente_nome: formData.cliente_nome,
        cliente_cnpj: formData.cliente_cnpj || "",
        data_criacao: formData.data_criacao,
        data_vencimento: formData.data_vencimento || formData.data_criacao,
        valor: parseFloat(formData.valor),
        categoria: formData.categoria || "Serviços",
        descricao: formData.descricao || "",
        status: formData.status,
        arquivo_pdf_url: pdfUrl || null,
      };

      // Adicionar aircraft_id se selecionado
      if (formData.aircraft_id) {
        notaData.aircraft_id = formData.aircraft_id;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (editingNota) {
        let error = null;
        const { error: updateError } = await supabase
          .from("notas_fiscais_saida")
          .update(notaData)
          .eq("id", editingNota.id);

        error = updateError;

        // Se tiver erro e contiver "aircraft_id", tenta atualizar sem o campo
        if (error && error.message.includes("aircraft_id")) {
          const { aircraft_id, ...dataWithoutAircraft } = notaData;
          const { error: retryError } = await supabase
            .from("notas_fiscais_saida")
            .update(dataWithoutAircraft)
            .eq("id", editingNota.id);
          error = retryError;
        }

        if (error) throw error;

        // Se status mudou para "pago" ou "pendente" durante a edição
        if ((notaData.status === "pago" || notaData.status === "pendente") &&
            (editingNota.status !== "pago" && editingNota.status !== "pendente") && user) {
          const contaBancariaStatus = notaData.status === "pago" ? "confirmado" : "pendente";
          await supabase.from("controle_bancario").insert({
            descricao: `NF Saída ${notaData.numero} - ${notaData.cliente_nome}${formData.aeronave_registration ? ` (${formData.aeronave_registration})` : ""}`,
            valor: notaData.valor,
            data: new Date().toISOString().split("T")[0],
            tipo_movimento: "entrada",
            categoria: notaData.categoria || "Receita de Serviço",
            status: contaBancariaStatus,
            numero_documento: notaData.numero,
            referencia: `nf_saida_${editingNota.id}`,
            criado_por: user.id
          });
        }

        toast({
          title: "Sucesso",
          description: "Nota fiscal atualizada com sucesso",
        });
      } else {
        let insertedNota = null;
        let error = null;

        const { data: result, error: insertError } = await supabase
          .from("notas_fiscais_saida")
          .insert([notaData])
          .select()
          .single();

        insertedNota = result;
        error = insertError;

        // Se tiver erro e contiver "aircraft_id", tenta inserir sem o campo
        if (error && error.message.includes("aircraft_id")) {
          const { aircraft_id, ...dataWithoutAircraft } = notaData;
          const { data: retryResult, error: retryError } = await supabase
            .from("notas_fiscais_saida")
            .insert([dataWithoutAircraft])
            .select()
            .single();

          insertedNota = retryResult;
          error = retryError;
        }

        if (error) throw error;

        // Se criada com status "pago" ou "pendente"
        if ((notaData.status === "pago" || notaData.status === "pendente") && user && insertedNota) {
          const contaBancariaStatus = notaData.status === "pago" ? "confirmado" : "pendente";
          await supabase.from("controle_bancario").insert({
            descricao: `NF Saída ${notaData.numero} - ${notaData.cliente_nome}${formData.aeronave_registration ? ` (${formData.aeronave_registration})` : ""}`,
            valor: notaData.valor,
            data: new Date().toISOString().split("T")[0],
            tipo_movimento: "entrada",
            categoria: notaData.categoria || "Receita de Serviço",
            status: contaBancariaStatus,
            numero_documento: notaData.numero,
            referencia: `nf_saida_${insertedNota.id}`,
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
      const { error } = await supabase
        .from("notas_fiscais_saida")
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

  const handleEdit = (nota: NotaFiscalSaida) => {
    setEditingNota(nota);
    setFormData({
      numero: nota.numero,
      cliente_nome: nota.cliente_nome,
      cliente_cnpj: nota.cliente_cnpj,
      data_criacao: nota.data_criacao,
      data_vencimento: nota.data_vencimento,
      valor: nota.valor.toString(),
      categoria: nota.categoria,
      descricao: nota.descricao,
      status: nota.status,
      aircraft_id: nota.aircraft_id || "",
      aeronave_registration: nota.aeronave_registration || "",
    });
    setPdfUrl(nota.arquivo_pdf_url || "");
    setOpenDialog(true);
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({
        title: "Erro",
        description: "Por favor, selecione um arquivo PDF",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingPDF(true);
    try {
      const fileName = `nf_${Date.now()}_${formData.numero || 'sem_numero'}.pdf`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("nfs-share-saida")
        .upload(filePath, file);

      if (uploadError) {
        toast({
          title: "Erro",
          description: `Erro ao fazer upload: ${uploadError.message}`,
          variant: "destructive",
        });
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("nfs-share-saida")
        .getPublicUrl(filePath);

      setPdfUrl(publicUrlData.publicUrl);
      toast({
        title: "Sucesso",
        description: "Nota Fiscal enviada com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar arquivo",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPDF(false);
    }
  };

  const resetForm = () => {
    setFormData({
      numero: "",
      cliente_nome: "",
      cliente_cnpj: "",
      data_criacao: new Date().toISOString().split("T")[0],
      data_vencimento: "",
      valor: "",
      categoria: defaultCategoria,
      descricao: "",
      status: "pendente",
      aircraft_id: "",
      aeronave_registration: "",
    });
    setEditingNota(null);
    setArquivo(null);
    setClienteSearch("");
    setAeronaveSearch("");
    setPdfUrl("");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "recebido":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "pendente":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "cancelado":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleChangeStatus = async (notaId: string, newStatus: string) => {
    try {
      const nota = notas.find(n => n.id === notaId);
      if (!nota) return;

      // Se mudando para "recebido", mostrar diálogo de seleção de banco
      if (newStatus === "recebido") {
        setNotaBeingStatusChanged(nota);
        setSelectedBankForStatus("");
        setShowBankDialog(true);
        return;
      }

      // Para outros status, atualizar diretamente
      const { error } = await supabase
        .from("notas_fiscais_saida")
        .update({ status: newStatus })
        .eq("id", notaId);

      if (error) throw error;

      // Se o novo status é "pendente", apenas pendente
      if (newStatus === "pendente") {
        toast({
          title: "Sucesso",
          description: "Status atualizado para Pendente",
        });
      } else if (newStatus === "cancelado") {
        toast({
          title: "Sucesso",
          description: "Nota fiscal cancelada",
        });
      }

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

  const handleConfirmBankSelection = async () => {
    if (!selectedBankForStatus || !notaBeingStatusChanged) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um banco",
        variant: "destructive",
      });
      return;
    }

    try {
      const nota = notaBeingStatusChanged;

      // Atualizar status para "recebido"
      const { error: updateError } = await supabase
        .from("notas_fiscais_saida")
        .update({ status: "recebido" })
        .eq("id", nota.id);

      if (updateError) throw updateError;

      // Criar entrada no controle_bancario
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: fluxoError } = await supabase
          .from("controle_bancario")
          .insert({
            descricao: `NF Saída ${nota.numero} - ${nota.cliente_nome}${nota.aeronave_registration ? ` (${nota.aeronave_registration})` : ""}`,
            valor: nota.valor,
            data: new Date().toISOString().split("T")[0],
            tipo_movimento: "entrada",
            categoria: nota.categoria || "Receita de Serviço",
            status: "recebido",
            numero_documento: nota.numero,
            referencia: `nf_saida_${nota.id}`,
            criado_por: user.id,
            conta_banco: selectedBankForStatus,
          });

        if (fluxoError) {
          console.error("Erro ao criar entrada no controle:", fluxoError);
          toast({
            title: "Aviso",
            description: "Status atualizado, mas houve um erro ao registrar no fluxo de caixa",
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Sucesso",
        description: "Nota fiscal marcada como recebida e registrada no fluxo bancário",
      });

      setShowBankDialog(false);
      setNotaBeingStatusChanged(null);
      setSelectedBankForStatus("");
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

  const handleSelectCliente = (cliente: Cliente) => {
    setFormData({
      ...formData,
      cliente_nome: cliente.nome,
      cliente_cnpj: cliente.documento
    });
    setOpenClientePopover(false);
    setClienteSearch("");
  };

  const filteredClientes = clientes.filter(c =>
    c.nome.toLowerCase().includes(clienteSearch.toLowerCase()) ||
    c.documento.includes(clienteSearch)
  );

  const totalPendente = notas
    .filter((n) => n.status === "pendente")
    .reduce((acc, n) => acc + n.valor, 0);

  const totalPago = notas
    .filter((n) => n.status === "pago")
    .reduce((acc, n) => acc + n.valor, 0);

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 via-card to-card border-blue-500/20 shadow-lg shadow-blue-500/5 hover:shadow-lg hover:shadow-blue-500/10 transition-shadow duration-300">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm font-medium">Total de Notas</p>
                <div className="p-2.5 rounded-lg bg-blue-500/20 border border-blue-500/30">
                  <FileUp className="w-5 h-5 text-blue-500" />
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground">{notas.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 via-card to-card border-yellow-500/20 shadow-lg shadow-yellow-500/5 hover:shadow-lg hover:shadow-yellow-500/10 transition-shadow duration-300">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm font-medium">Total Pendente</p>
                <div className="p-2.5 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
                  <DollarSign className="w-5 h-5 text-yellow-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-yellow-500">
                R$ {totalPendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 via-card to-card border-green-500/20 shadow-lg shadow-green-500/5 hover:shadow-lg hover:shadow-green-500/10 transition-shadow duration-300">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm font-medium">Total Pago</p>
                <div className="p-2.5 rounded-lg bg-green-500/20 border border-green-500/30">
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
        <Card className="bg-gradient-to-br from-blue-600/10 to-card border-blue-500/30 shadow-lg mb-6">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground">
                {editingNota ? "Editar Nota Fiscal" : "Nova Nota Fiscal de Saída"}
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
                  <Label className="text-foreground">Data de Criação</Label>
                  <Input
                    type="date"
                    value={formData.data_criacao}
                    onChange={(e) => setFormData({ ...formData, data_criacao: e.target.value })}
                    className="bg-background border-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">Cliente/Empresa *</Label>
                  <Popover open={openClientePopover} onOpenChange={setOpenClientePopover}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Input
                          value={formData.cliente_nome}
                          onChange={(e) => {
                            setFormData({ ...formData, cliente_nome: e.target.value });
                            setClienteSearch(e.target.value);
                            setOpenClientePopover(true);
                          }}
                          onFocus={() => setOpenClientePopover(true)}
                          placeholder="Buscar cliente..."
                          className="bg-background border-border pr-10"
                        />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 bg-card border-border" align="start">
                      <Command className="bg-card">
                        <CommandInput
                          placeholder="Buscar..."
                          value={clienteSearch}
                          onValueChange={setClienteSearch}
                          className="bg-background"
                        />
                        <CommandList>
                          <CommandEmpty className="text-muted-foreground py-3 text-center text-sm">
                            Nenhum cliente encontrado
                          </CommandEmpty>
                          <CommandGroup heading="Clientes" className="text-muted-foreground">
                            {filteredClientes.slice(0, 10).map((c) => (
                              <CommandItem
                                key={c.id}
                                onSelect={() => handleSelectCliente(c)}
                                className="cursor-pointer hover:bg-muted"
                              >
                                <div>
                                  <p className="font-medium text-foreground">{c.nome}</p>
                                  {c.documento && <p className="text-xs text-muted-foreground">{c.documento}</p>}
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
                    value={formData.cliente_cnpj}
                    onChange={(e) => setFormData({ ...formData, cliente_cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                    className="bg-background border-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-foreground">Aeronave (Opcional)</Label>
                  <Popover open={openAeronavePopover} onOpenChange={setOpenAeronavePopover}>
                    <PopoverTrigger asChild>
                      <div className="relative">
                        <Input
                          value={formData.aeronave_registration}
                          onChange={(e) => {
                            setAeronaveSearch(e.target.value);
                            setOpenAeronavePopover(true);
                          }}
                          onFocus={() => setOpenAeronavePopover(true)}
                          placeholder="Buscar aeronave..."
                          className="bg-background border-border pr-10"
                        />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 bg-card border-border" align="start">
                      <Command className="bg-card">
                        <CommandInput
                          placeholder="Buscar por prefixo, modelo..."
                          value={aeronaveSearch}
                          onValueChange={setAeronaveSearch}
                          className="bg-background"
                        />
                        <CommandList>
                          {isLoadingAeronaves ? (
                            <div className="text-center py-3 text-muted-foreground text-sm">
                              Carregando aeronaves...
                            </div>
                          ) : (
                            <>
                              <CommandEmpty className="text-muted-foreground py-3 text-center text-sm">
                                Nenhuma aeronave encontrada
                              </CommandEmpty>
                              <CommandGroup heading="Aeronaves" className="text-muted-foreground">
                                {aeronaves.filter(a =>
                                  a.registration.toLowerCase().includes(aeronaveSearch.toLowerCase()) ||
                                  a.model.toLowerCase().includes(aeronaveSearch.toLowerCase()) ||
                                  a.manufacturer.toLowerCase().includes(aeronaveSearch.toLowerCase())
                                ).slice(0, 10).map((aero) => (
                                  <CommandItem
                                    key={aero.id}
                                    onSelect={() => {
                                      setFormData({
                                        ...formData,
                                        aircraft_id: aero.id,
                                        aeronave_registration: aero.registration
                                      });
                                      setOpenAeronavePopover(false);
                                      setAeronaveSearch("");
                                    }}
                                    className="cursor-pointer hover:bg-muted"
                                  >
                                    <div>
                                      <p className="font-medium text-foreground">{aero.registration}</p>
                                      <p className="text-xs text-muted-foreground">{aero.manufacturer} {aero.model}</p>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-end">
                  {formData.aircraft_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          aircraft_id: "",
                          aeronave_registration: ""
                        });
                      }}
                      className="w-full h-10"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Limpar Aeronave
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">Data de Vencimento</Label>
                <Input
                  type="date"
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
                <Label className="text-foreground">Categoria</Label>
                <Select value={formData.categoria} onValueChange={(value) => setFormData({ ...formData, categoria: value })}>
                  <SelectTrigger className="w-full bg-background border-border">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border" align="start">
                      {categoriasReceita.map((cat) => (
                        <SelectItem key={cat.id} value={cat.nome}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                      {categoriasReceita.length === 0 && (
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
                    <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="recebido">Recebido</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-foreground">Descrição</Label>
                <Input
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descrição da nota fiscal"
                  className="bg-background border-border"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Nota Fiscal (PDF)</Label>
                {pdfUrl ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileText className="h-5 w-5 text-primary" />
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex-1 truncate"
                    >
                      NF anexada
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPdfUrl("")}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".pdf"
                      onChange={handlePDFUpload}
                      disabled={isUploadingPDF}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('pdf-upload')?.click()}
                      disabled={isUploadingPDF}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {isUploadingPDF ? "Enviando..." : "Anexar Nota Fiscal (PDF)"}
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setOpenDialog(false); resetForm(); }} disabled={isUploadingPDF}>
                  Cancelar
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={isUploadingPDF}>
                  {editingNota ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botão para Nova Nota Fiscal */}
      {!openDialog && (
        <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30 flex items-center gap-2 font-medium mb-6" onClick={() => setOpenDialog(true)}>
          <Plus className="w-4 h-4" />
          Nova Nota Fiscal de Saída
        </Button>
      )}

      {/* Tabela de Notas */}
      <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/60 shadow-lg">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-lg font-semibold text-foreground">Notas Fiscais de Saída</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
              Carregando...
            </div>
          ) : notas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileUp className="w-12 h-12 opacity-20 mx-auto mb-3" />
              Nenhuma nota fiscal criada
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/40">
              <Table>
                <TableHeader className="bg-muted/30 border-b border-border/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Número</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Cliente</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Aeronave</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Criação</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Vencimento</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3 text-right">Valor</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Categoria</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3">Status</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3 text-center">PDF</TableHead>
                    <TableHead className="text-muted-foreground font-semibold px-4 py-3 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notas.map((nota, idx) => (
                    <TableRow key={nota.id} className={`border-b border-border/30 hover:bg-muted/40 transition-colors ${idx % 2 === 0 ? 'bg-muted/10' : ''}`}>
                      <TableCell className="font-semibold text-foreground px-4 py-3">{nota.numero}</TableCell>
                      <TableCell className="text-foreground px-4 py-3">{nota.cliente_nome}</TableCell>
                      <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                        {nota.aeronave_registration || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                        {format(new Date(nota.data_criacao + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                        {nota.data_vencimento && format(new Date(nota.data_vencimento + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-foreground font-semibold px-4 py-3 text-right text-emerald-500">
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
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="recebido">Recebido</SelectItem>
                            <SelectItem value="cancelado">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        {nota.arquivo_pdf_url ? (
                          <a
                            href={nota.arquivo_pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                            title="Ver PDF"
                          >
                            <FileText className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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

      {/* Dialog de Seleção de Banco para Recebido */}
      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Selecionar Banco</DialogTitle>
          </DialogHeader>
          {notaBeingStatusChanged && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Nota Fiscal</p>
                <p className="font-semibold text-foreground">{notaBeingStatusChanged.numero}</p>
                <p className="text-sm text-muted-foreground mt-2">{notaBeingStatusChanged.cliente_nome}</p>
                <p className="text-sm text-foreground font-semibold mt-2">
                  R$ {notaBeingStatusChanged.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div>
                <Label className="text-foreground font-semibold mb-2 block">
                  Selecione o Banco de Recebimento *
                </Label>
                <Select value={selectedBankForStatus} onValueChange={setSelectedBankForStatus}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Selecione um banco" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {bancos.length > 0 ? (
                      bancos.map((banco) => (
                        <SelectItem key={banco} value={banco}>
                          {banco}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Nenhum banco disponível
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowBankDialog(false);
                setNotaBeingStatusChanged(null);
                setSelectedBankForStatus("");
              }}
            >
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleConfirmBankSelection}
            >
              Confirmar Recebimento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
