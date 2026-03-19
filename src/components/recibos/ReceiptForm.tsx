import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePickerCalendar } from "@/components/ui/date-picker-calendar";
import { FileText, Star, Upload, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";

interface ReceiptFormProps {
  clientesAtivos: any[];
  favoritePayers: any[];
  isGenerating: boolean;
  onSubmit: (data: any) => void;
}

interface Categoria {
  id: string;
  nome: string;
  grupo_categoria: string;
}

interface FavoriteDescription {
  id: string;
  description: string;
}

interface ClientPartner {
  id: string;
  name: string;
  cpf: string;
  share_percentage: number;
}

export function ReceiptForm({
  clientesAtivos,
  favoritePayers,
  isGenerating,
  onSubmit,
}: ReceiptFormProps) {
  const [formData, setFormData] = useState({
    receiptType: "pagamento",

    pagadorNome: "",
    pagadorDocumento: "",
    pagadorEndereco: "",
    pagadorCidade: "",
    pagadorUF: "",

    valor: "",
    servicoDescricao: "",
    dataEmissao: new Date().toISOString().split("T")[0],
    prazoMaximoQuitacao: "",
    formaPagamento: "",

    clienteId: "",
    aircraftId: "",
    addAsFavorite: false,

    // REEMBOLSO
    reembolsoValorTotal: "",
    reembolsoPorcentagem: "",
    reembolsoCategoriaId: "",
    reembolsoCategoriaNome: "",
    reembolsoNumeroDocumento: "",
    reembolsoRateado: false,
    reembolsoBoletoFile: null as File | null,
    reembolsoNotaFiscalFile: null as File | null,

    // DECEA / INFRAERO specific
    numeroDocumentoDecea: "",
    competenciaDecea: "",
    decealFile: null as File | null,
    numeroDocumentoInfraero: "",
    competenciaInfraero: "",
    infraeroFile: null as File | null,
    dataVencimentoBoleto: "",
    valorTotalBoleto: "",
  });

  const [aircrafts, setAircrafts] = useState<any[]>([]);
  const [clientPartners, setClientPartners] = useState<ClientPartner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [categoriasReembolsaveis, setCategoriasReembolsaveis] = useState<Categoria[]>([]);
  const [favoriteDescriptions, setFavoriteDescriptions] = useState<FavoriteDescription[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);

  const isReembolso = formData.receiptType === "reembolso";

  // Detect DECEA or INFRAERO category
  const selectedCategoria = categoriasReembolsaveis.find(c => c.id === formData.reembolsoCategoriaId);
  const categoriaNome = selectedCategoria?.nome || formData.reembolsoCategoriaNome || "";
  const isDecea = categoriaNome.toUpperCase().includes("DECEA");
  const isInfraero = categoriaNome.toUpperCase().includes("INFRAERO");
  const isDECEAorINFRAERO = isDecea || isInfraero;

  // Cálculo automático do valor quando rateado
  useEffect(() => {
    if (formData.reembolsoRateado && formData.reembolsoValorTotal && formData.reembolsoPorcentagem) {
      const valorTotal = parseFloat(formData.reembolsoValorTotal) || 0;
      const porcentagem = parseFloat(formData.reembolsoPorcentagem) || 0;
      const valorCalculado = (valorTotal * porcentagem / 100).toFixed(2);
      setFormData(prev => ({ ...prev, valor: valorCalculado }));
    }
  }, [formData.reembolsoValorTotal, formData.reembolsoPorcentagem, formData.reembolsoRateado]);

  const parseLocalDate = (dateString: string): Date => {
    const [y, m, d] = dateString.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  // Load categorias reembolsáveis
  useEffect(() => {
    const loadCategorias = async () => {
      const { data } = await supabase
        .from("categorias_movimentacao")
        .select("id, nome, grupo_categoria")
        .eq("grupo_categoria", "DESPESAS REEMBOLSÁVEIS")
        .eq("ativo", true)
        .order("nome");

      if (data) {
        setCategoriasReembolsaveis(data);
      }
    };

    loadCategorias();
  }, []);

  // Load favorite descriptions
  useEffect(() => {
    const loadFavoriteDescriptions = async () => {
      const { data } = await supabase
        .from("receipt_descriptions")
        .select("*")
        .order("created_at", { ascending: false });

      setFavoriteDescriptions(data || []);
    };

    loadFavoriteDescriptions();
  }, []);

  // Reset campos de reembolso ao mudar tipo
  useEffect(() => {
    if (formData.receiptType === "pagamento") {
      setFormData((prev) => ({
        ...prev,
        reembolsoValorTotal: "",
        reembolsoPorcentagem: "",
        reembolsoCategoriaId: "",
        reembolsoCategoriaNome: "",
        reembolsoNumeroDocumento: "",
        reembolsoRateado: false,
        reembolsoBoletoFile: null,
        reembolsoNotaFiscalFile: null,
        numeroDocumentoDecea: "",
        competenciaDecea: "",
        decealFile: null,
        numeroDocumentoInfraero: "",
        competenciaInfraero: "",
        infraeroFile: null,
        dataVencimentoBoleto: "",
        valorTotalBoleto: "",
      }));
    }
  }, [formData.receiptType]);

  // Reset DECEA/INFRAERO fields when category changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      numeroDocumentoDecea: "",
      competenciaDecea: "",
      decealFile: null,
      numeroDocumentoInfraero: "",
      competenciaInfraero: "",
      infraeroFile: null,
      dataVencimentoBoleto: "",
      valorTotalBoleto: "",
    }));
  }, [formData.reembolsoCategoriaId]);

  // Auto-fill description based on category
  useEffect(() => {
    if (isReembolso && selectedCategoria) {
      setFormData(prev => ({
        ...prev,
        servicoDescricao: `Referente a ${selectedCategoria.nome}`,
      }));
    }
  }, [formData.reembolsoCategoriaId]);

  // Cliente / Aeronave - preenche dados do pagador
  useEffect(() => {
    if (!formData.clienteId) {
      setAircrafts([]);
      setClientPartners([]);
      setSelectedPartnerId("");
      return;
    }

    loadAircrafts(formData.clienteId);
    loadClientPartners(formData.clienteId);

    const client = clientesAtivos.find((c) => c.id === formData.clienteId);
    if (client) {
      setFormData((prev) => ({
        ...prev,
        pagadorNome: client.company_name || "",
        pagadorDocumento: client.cnpj || "",
        pagadorEndereco: client.address || "",
        pagadorCidade: client.city || "",
        pagadorUF: client.uf || "",
      }));
    }
    setSelectedPartnerId("");
  }, [formData.clienteId]);

  // Quando seleciona um sócio, atualiza dados do pagador
  useEffect(() => {
    if (!selectedPartnerId || selectedPartnerId === "__client__") {
      const client = clientesAtivos.find((c) => c.id === formData.clienteId);
      if (client && formData.clienteId) {
        setFormData((prev) => ({
          ...prev,
          pagadorNome: client.company_name || "",
          pagadorDocumento: client.cnpj || "",
          pagadorEndereco: client.address || "",
          pagadorCidade: client.city || "",
          pagadorUF: client.uf || "",
        }));
      }
      return;
    }
    const partner = clientPartners.find((p) => p.id === selectedPartnerId);
    if (partner) {
      setFormData((prev) => ({
        ...prev,
        pagadorNome: partner.name || "",
        pagadorDocumento: partner.cpf || "",
      }));
    }
  }, [selectedPartnerId]);

  const loadAircrafts = async (clientId: string) => {
    const { data } = await supabase
      .from("client_aircraft")
      .select(`aircraft:aircraft_id ( id, registration, model )`)
      .eq("client_id", clientId);

    if (data) {
      setAircrafts(data.map((c) => c.aircraft).filter(Boolean));
    }
  };

  const loadClientPartners = async (clientId: string) => {
    const { data } = await supabase
      .from("client_partners")
      .select("id, name, cpf, share_percentage")
      .eq("client_id", clientId)
      .order("name");
    setClientPartners(data || []);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const submissionData = {
      ...formData,
      pagadorNome: formData.pagadorNome,
      pagadorDocumento: formData.pagadorDocumento,
      pagadorEndereco: formData.pagadorEndereco,
      pagadorCidade: formData.pagadorCidade,
      pagadorUF: formData.pagadorUF,
      valor: formData.valor,
      servicoDescricao: formData.servicoDescricao,
      selectedPartnerId,
      categoriaNome,
      isDecea,
      isInfraero,
      originalFormData: formData,
    };

    onSubmit(submissionData);
  };

  const handleFileChange = (field: string, file: File | null) => {
    setFormData((prev) => ({ ...prev, [field]: file }));
  };

  const selectFavoriteDescription = (description: string) => {
    setFormData(prev => ({ ...prev, servicoDescricao: description }));
    setShowFavorites(false);
  };

  // Prepare items for SearchableCombobox
  const clienteItems = clientesAtivos.map(c => ({
    id: c.id,
    label: c.company_name || "Sem nome",
  }));

  const aeronaveItems = aircrafts.map((a: any) => ({
    id: a.id,
    label: `${a.registration} – ${a.model}`,
  }));

  const categoriaItems = categoriasReembolsaveis.map(c => ({
    id: c.id,
    label: c.nome,
  }));

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* TIPO */}
          <div>
            <Label>Tipo de Recibo</Label>
            <Select
              value={formData.receiptType}
              onValueChange={(v) =>
                setFormData((p) => ({ ...p, receiptType: v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pagamento">Pagamento</SelectItem>
                <SelectItem value="reembolso">Reembolso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* CATEGORIA - SearchableCombobox for reembolso */}
          {isReembolso && (
            <div>
              <Label>Categoria (Despesas Reembolsáveis) *</Label>
              <SearchableCombobox
                items={categoriaItems}
                value={formData.reembolsoCategoriaId}
                onChange={(id, label) =>
                  setFormData((p) => ({ ...p, reembolsoCategoriaId: id, reembolsoCategoriaNome: label }))
                }
                placeholder="Selecione a categoria"
                searchPlaceholder="Buscar categoria..."
                emptyMessage="Nenhuma categoria encontrada"
              />
            </div>
          )}

          {/* CLIENTE / AERONAVE - SearchableCombobox */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Cliente</Label>
              <SearchableCombobox
                items={clienteItems}
                value={formData.clienteId}
                onChange={(id) =>
                  setFormData((p) => ({ ...p, clienteId: id }))
                }
                placeholder="Selecione o cliente"
                searchPlaceholder="Buscar cliente..."
                emptyMessage="Nenhum cliente encontrado"
              />
            </div>

            <div>
              <Label>Aeronave</Label>
              <SearchableCombobox
                items={aeronaveItems}
                value={formData.aircraftId}
                onChange={(id) =>
                  setFormData((p) => ({ ...p, aircraftId: id }))
                }
                placeholder="Selecione a aeronave"
                searchPlaceholder="Buscar aeronave..."
                emptyMessage="Nenhuma aeronave encontrada"
                disabled={!formData.clienteId}
              />
            </div>
          </div>

          {/* SÓCIO (PARTNER) */}
          {clientPartners.length > 0 && formData.clienteId && (
            <div className="p-4 border border-border rounded-lg bg-muted/20 space-y-2">
              <Label className="text-sm font-semibold">Sócio / Pagador</Label>
              <p className="text-xs text-muted-foreground">
                Este cliente possui sócios vinculados. Selecione o sócio que será o pagador do recibo.
              </p>
              <Select
                value={selectedPartnerId}
                onValueChange={setSelectedPartnerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o sócio (pagador)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__client__">
                    {clientesAtivos.find(c => c.id === formData.clienteId)?.company_name || "Cliente Principal"}
                  </SelectItem>
                  {clientPartners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.cpf ? `(${p.cpf})` : ""} — {p.share_percentage}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* DADOS DO PAGADOR */}
          <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
            <Label className="text-sm font-semibold">Dados do Pagador</Label>
            <p className="text-xs text-muted-foreground -mt-2">
              {selectedPartnerId ? "Preenchido pelo sócio selecionado" : formData.clienteId ? "Preenchido automaticamente pelo cliente selecionado" : "Preencha manualmente os dados do pagador"}
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Nome / Razão Social *</Label>
                <Input
                  value={formData.pagadorNome}
                  onChange={(e) => setFormData((p) => ({ ...p, pagadorNome: e.target.value }))}
                  placeholder="Nome do pagador"
                  required
                />
              </div>
              <div>
                <Label>CPF / CNPJ *</Label>
                <Input
                  value={formData.pagadorDocumento}
                  onChange={(e) => setFormData((p) => ({ ...p, pagadorDocumento: e.target.value }))}
                  placeholder="Documento do pagador"
                  required
                />
              </div>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input
                value={formData.pagadorEndereco}
                onChange={(e) => setFormData((p) => ({ ...p, pagadorEndereco: e.target.value }))}
                placeholder="Endereço"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Cidade</Label>
                <Input
                  value={formData.pagadorCidade}
                  onChange={(e) => setFormData((p) => ({ ...p, pagadorCidade: e.target.value }))}
                  placeholder="Cidade"
                />
              </div>
              <div>
                <Label>UF</Label>
                <Input
                  value={formData.pagadorUF}
                  onChange={(e) => setFormData((p) => ({ ...p, pagadorUF: e.target.value }))}
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          {/* FORMA DE PAGAMENTO - apenas para pagamento */}
          {!isReembolso && (
            <div>
              <Label>Forma de Pagamento</Label>
              <Select
                value={formData.formaPagamento}
                onValueChange={(v) => setFormData((p) => ({ ...p, formaPagamento: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* =================== DECEA SPECIFIC FIELDS =================== */}
          {isReembolso && isDecea && (
            <div className="p-4 border border-amber-500/30 rounded-lg bg-amber-500/5 space-y-4">
              <Label className="text-sm font-semibold text-amber-700">📋 Campos DECEA</Label>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Número do Documento *</Label>
                  <Input
                    value={formData.numeroDocumentoDecea}
                    onChange={(e) => setFormData(p => ({ ...p, numeroDocumentoDecea: e.target.value }))}
                    placeholder="Nº do documento DECEA"
                    required
                  />
                </div>
                <div>
                  <Label>Competência *</Label>
                  <Input
                    value={formData.competenciaDecea}
                    onChange={(e) => setFormData(p => ({ ...p, competenciaDecea: e.target.value }))}
                    placeholder="Ex: 02/2026"
                    required
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Data de Vencimento do Boleto *</Label>
                  <Input
                    type="date"
                    value={formData.dataVencimentoBoleto}
                    onChange={(e) => setFormData(p => ({ ...p, dataVencimentoBoleto: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label>Valor Total do Boleto *</Label>
                  <MoneyInput
                    value={formData.valorTotalBoleto}
                    onChange={(e) => setFormData(p => ({ ...p, valorTotalBoleto: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <Label>Demonstrativo DECEA (PDF/Imagem)</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff"
                  onChange={(e) => handleFileChange("decealFile", e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground mt-1">Aceita PDF e imagens</p>
              </div>
            </div>
          )}

          {/* =================== INFRAERO SPECIFIC FIELDS =================== */}
          {isReembolso && isInfraero && (
            <div className="p-4 border border-blue-500/30 rounded-lg bg-blue-500/5 space-y-4">
              <Label className="text-sm font-semibold text-blue-700">📋 Campos INFRAERO</Label>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Documento INFRAERO *</Label>
                  <Input
                    value={formData.numeroDocumentoInfraero}
                    onChange={(e) => setFormData(p => ({ ...p, numeroDocumentoInfraero: e.target.value }))}
                    placeholder="Nº do documento INFRAERO"
                    required
                  />
                </div>
                <div>
                  <Label>Competência *</Label>
                  <Input
                    value={formData.competenciaInfraero}
                    onChange={(e) => setFormData(p => ({ ...p, competenciaInfraero: e.target.value }))}
                    placeholder="Ex: 02/2026"
                    required
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Data de Vencimento do Boleto *</Label>
                  <Input
                    type="date"
                    value={formData.dataVencimentoBoleto}
                    onChange={(e) => setFormData(p => ({ ...p, dataVencimentoBoleto: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label>Valor Total do Boleto *</Label>
                  <MoneyInput
                    value={formData.valorTotalBoleto}
                    onChange={(e) => setFormData(p => ({ ...p, valorTotalBoleto: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <Label>Demonstrativo INFRAERO (PDF/Imagem)</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff"
                  onChange={(e) => handleFileChange("infraeroFile", e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground mt-1">Aceita PDF e imagens</p>
              </div>
            </div>
          )}

          {/* Nº DOCUMENTO (for non-DECEA/INFRAERO reembolso) */}
          {isReembolso && !isDECEAorINFRAERO && (
            <div>
              <Label>Número do Documento</Label>
              <Input
                value={formData.reembolsoNumeroDocumento}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, reembolsoNumeroDocumento: e.target.value }))
                }
                placeholder="Ex: NF 12345"
              />
            </div>
          )}

          {/* CHECKBOX RATEIO */}
          {isReembolso && (
            <div className="flex items-center space-x-2 p-4 border border-border rounded-lg bg-muted/30">
              <Checkbox
                id="rateio"
                checked={formData.reembolsoRateado}
                onCheckedChange={(checked) =>
                  setFormData((p) => ({
                    ...p,
                    reembolsoRateado: checked === true,
                    ...(checked === false && {
                      reembolsoValorTotal: "",
                      reembolsoPorcentagem: "",
                    }),
                  }))
                }
              />
              <Label htmlFor="rateio" className="cursor-pointer">
                Despesa será rateada entre os sócios
              </Label>
            </div>
          )}

          {/* CAMPOS DE RATEIO */}
          {isReembolso && formData.reembolsoRateado && (
            <div className="grid md:grid-cols-3 gap-4 p-4 border border-primary/20 rounded-lg bg-primary/5">
              <div>
                <Label>Valor Total da Despesa *</Label>
                <MoneyInput
                  value={formData.reembolsoValorTotal}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      reembolsoValorTotal: e.target.value,
                    }))
                  }
                  required={formData.reembolsoRateado}
                />
              </div>
              <div>
                <Label>Percentual deste Cliente (%) *</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  max="100"
                  value={formData.reembolsoPorcentagem}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      reembolsoPorcentagem: e.target.value,
                    }))
                  }
                  placeholder="Ex: 40.625"
                  required={formData.reembolsoRateado}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Aceita até 3 casas decimais (ex: 33.333)
                </p>
              </div>
              <div>
                <Label>Valor do Recibo (Calculado)</Label>
                <MoneyInput
                  value={formData.valor}
                  readOnly
                  className="bg-muted cursor-not-allowed font-semibold"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Valor que este cliente irá pagar
                </p>
              </div>
            </div>
          )}

          {/* VALOR DO RECIBO - só aparece se NÃO rateado */}
          {isReembolso && !formData.reembolsoRateado && (
            <div>
              <Label>Valor do Recibo (100% para este cliente) *</Label>
              <MoneyInput
                value={formData.valor}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, valor: e.target.value }))
                }
                required
              />
            </div>
          )}

          {/* VALOR DO RECIBO - para pagamento normal */}
          {!isReembolso && (
            <div>
              <Label>Valor do Recibo *</Label>
              <MoneyInput
                value={formData.valor}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, valor: e.target.value }))
                }
                required
              />
            </div>
          )}

          {/* PRAZO DE QUITAÇÃO - apenas para reembolso (auto-fill from DECEA/INFRAERO vencimento) */}
          {isReembolso && (
            <div className="space-y-3">
              <Label>Prazo Máximo de Quitação</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between text-left font-normal rounded-xl border-border/60 bg-background shadow-sm hover:bg-accent/5"
                  >
                    {isDECEAorINFRAERO ? formData.dataVencimentoBoleto : formData.prazoMaximoQuitacao ? (
                      format(parseLocalDate(isDECEAorINFRAERO ? formData.dataVencimentoBoleto : formData.prazoMaximoQuitacao), "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      <span className="text-muted-foreground">Selecione a data</span>
                    )}
                    <Calendar className="w-4 h-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0 border-0">
                  <DatePickerCalendar
                    value={
                      isDECEAorINFRAERO
                        ? (formData.dataVencimentoBoleto ? new Date(formData.dataVencimentoBoleto + "T00:00:00") : undefined)
                        : (formData.prazoMaximoQuitacao ? new Date(formData.prazoMaximoQuitacao + "T00:00:00") : undefined)
                    }
                    onChange={(date) => {
                      const dateString = date ? format(date, "yyyy-MM-dd") : "";
                      if (isDECEAorINFRAERO) {
                        setFormData(p => ({ ...p, dataVencimentoBoleto: dateString, prazoMaximoQuitacao: dateString }));
                      } else {
                        setFormData((p) => ({ ...p, prazoMaximoQuitacao: dateString }));
                      }
                    }}
                    disabled={(date) => {
                      const minDate = new Date(formData.dataEmissao + "T00:00:00");
                      return date < minDate;
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* DESCRIÇÃO DO SERVIÇO / RECIBO */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Descrição do Serviço*</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowFavorites(!showFavorites)}
                className="text-xs"
              >
                <Star className="h-3 w-3 mr-1" />
                Favoritas
              </Button>
            </div>

            {showFavorites && favoriteDescriptions.length > 0 && (
              <div className="border border-border rounded-lg p-2 space-y-1 bg-muted/30 max-h-40 overflow-y-auto">
                {favoriteDescriptions.map((desc) => (
                  <button
                    key={desc.id}
                    type="button"
                    onClick={() => selectFavoriteDescription(desc.description)}
                    className="w-full text-left p-2 text-sm hover:bg-accent rounded transition-colors"
                  >
                    {desc.description}
                  </button>
                ))}
              </div>
            )}

            <Textarea
              value={formData.servicoDescricao}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  servicoDescricao: e.target.value,
                }))
              }
              placeholder="Ex: Referente a Tarifa de Navegação DECEA"
              rows={3}
              required
            />
          </div>

          {/* UPLOADS - for non DECEA/INFRAERO reembolso */}
          {isReembolso && !isDECEAorINFRAERO && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Boleto</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={(e) =>
                    handleFileChange(
                      "reembolsoBoletoFile",
                      e.target.files?.[0] || null
                    )
                  }
                />
              </div>

              <div>
                <Label>N.F / DEMONSTRATIVO</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={(e) =>
                    handleFileChange(
                      "reembolsoNotaFiscalFile",
                      e.target.files?.[0] || null
                    )
                  }
                />
              </div>
            </div>
          )}

          {/* SUBMIT */}
          <div className="flex justify-end">
            <Button type="submit" disabled={isGenerating}>
              <FileText className="mr-2 h-4 w-4" />
              {isGenerating ? "Gerando..." : "Gerar Recibo"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
