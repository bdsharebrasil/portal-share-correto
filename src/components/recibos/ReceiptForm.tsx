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
  description?: string;
  descricao?: string;
}

interface ClientPartner {
  id: string;
  name?: string;
  nome?: string;
  cpf: string;
  percentual_sociedade?: number;
  percentual_participacao?: number;
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
  const [valorEditadoManualmente, setValorEditadoManualmente] = useState(false);

  const isReembolso = formData.receiptType === "reembolso";

  // Detect DECEA or INFRAERO category
  const selectedCategoria = categoriasReembolsaveis.find(c => c.id === formData.reembolsoCategoriaId);
  const categoriaNome = selectedCategoria?.nome || formData.reembolsoCategoriaNome || "";
  const isDecea = categoriaNome.toUpperCase().includes("DECEA");
  const isInfraero = categoriaNome.toUpperCase().includes("INFRAERO");
  const isDECEAorINFRAERO = isDecea || isInfraero;

  // Cálculo automático do valor quando rateado - SEMPRE atualiza se não foi editado manualmente
  useEffect(() => {
    if (formData.reembolsoRateado && formData.reembolsoValorTotal && formData.reembolsoPorcentagem) {
      // Normalizar valor total: remover ponto (separador de milhares) e substituir vírgula por ponto
      const valorTotalStr = String(formData.reembolsoValorTotal)
        .replace(/\./g, "")
        .replace(/,/g, ".");
      const valorTotal = parseFloat(valorTotalStr) || 0;
      const porcentagem = parseFloat(formData.reembolsoPorcentagem) || 0;
      const valorCalculado = (valorTotal * porcentagem / 100).toFixed(2);

      // Só atualiza se o usuário não editou manualmente
      if (!valorEditadoManualmente) {
        setFormData(prev => ({ ...prev, valor: valorCalculado }));
      }
    }
  }, [formData.reembolsoValorTotal, formData.reembolsoPorcentagem, formData.reembolsoRateado, valorEditadoManualmente]);

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
        .order("criado_em", { ascending: false });

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
      setValorEditadoManualmente(false);
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

  // Auto-fill description based on category (and INFRAERO/DECEA specific fields)
  useEffect(() => {
    if (!isReembolso || !selectedCategoria) return;

    if (isInfraero) {
      const comp = formData.competenciaInfraero ? ` COMPETÊNCIA ${formData.competenciaInfraero.toUpperCase()}` : "";
      const doc = formData.numeroDocumentoInfraero ? ` DEMONSTRATIVO ${formData.numeroDocumentoInfraero.toUpperCase()}` : "";
      setFormData(prev => ({
        ...prev,
        servicoDescricao: `REFERENTE A INFRAERO${comp}${doc}`.trim(),
      }));
    } else if (isDecea) {
      const comp = formData.competenciaDecea ? ` COMPETÊNCIA ${formData.competenciaDecea.toUpperCase()}` : "";
      const doc = formData.numeroDocumentoDecea ? ` DEMONSTRATIVO ${formData.numeroDocumentoDecea.toUpperCase()}` : "";
      setFormData(prev => ({
        ...prev,
        servicoDescricao: `REFERENTE A DECEA${comp}${doc}`.trim(),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        servicoDescricao: `Referente a ${selectedCategoria.nome}`,
      }));
    }
  }, [formData.reembolsoCategoriaId, formData.competenciaInfraero, formData.numeroDocumentoInfraero, formData.competenciaDecea, formData.numeroDocumentoDecea]);

  // For INFRAERO/DECEA: auto-sync boleto value as total expense value
  useEffect(() => {
    if (!isDECEAorINFRAERO || !formData.valorTotalBoleto) return;
    setFormData(prev => ({
      ...prev,
      reembolsoValorTotal: prev.valorTotalBoleto,
      reembolsoRateado: true,
    }));
  }, [formData.valorTotalBoleto, isDECEAorINFRAERO]);

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
        pagadorNome: client.razao_social || client.nome || "",
        pagadorDocumento: client.cnpj || "",
        pagadorEndereco: client.endereco || client.address || "",
        pagadorCidade: client.cidade || client.city || "",
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
          pagadorNome: client.razao_social || client.nome || "",
          pagadorDocumento: client.cnpj || "",
          pagadorEndereco: client.endereco || client.address || "",
          pagadorCidade: client.cidade || client.city || "",
          pagadorUF: client.uf || "",
        }));
      }
      return;
    }
    const partner = clientPartners.find((p) => p.id === selectedPartnerId);
    if (partner) {
      setFormData((prev) => ({
        ...prev,
        pagadorNome: partner.nome || partner.name || "",
        pagadorDocumento: partner.cpf || "",
      }));
    }
  }, [selectedPartnerId]);

  const loadAircrafts = async (clientId: string) => {
    // Load client's aircraft
    const { data: clientData } = await supabase
      .from("cotistas_aeronave")
      .select(`id_aeronave, aeronave:id_aeronave ( id, matricula, modelo )`)
      .eq("id_clientes", clientId);

    const clientAircraftIds = new Set<string>();
    const clientAircrafts = (clientData || []).map((c: any) => {
      const a = c.aeronave;
      if (!a) return null;
      clientAircraftIds.add(a.id);
      return { id: a.id, matricula: a.matricula, modelo: a.modelo, isClient: true };
    }).filter(Boolean);

    // Load all other aircraft
    const { data: allData } = await supabase
      .from("aeronave")
      .select("id, matricula, modelo")
      .eq("status", "ativo")
      .order("matricula");

    const otherAircrafts = (allData || [])
      .filter((a: any) => !clientAircraftIds.has(a.id))
      .map((a: any) => ({ id: a.id, matricula: a.matricula, modelo: a.modelo, isClient: false }));

    setAircrafts([...clientAircrafts, ...otherAircrafts]);
  };

  const loadClientPartners = async (clientId: string) => {
    const { data } = await supabase
      .from("socios_cliente")
      .select("id, nome, cpf, percentual_participacao")
      .eq("cliente_id", clientId)
      .order("nome");
    setClientPartners((data || []).map(d => ({
      id: d.id,
      name: d.nome,
      nome: d.nome,
      cpf: d.cpf,
      percentual_sociedade: d.percentual_participacao,
      percentual_participacao: d.percentual_participacao,
    })));
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
    label: c.razao_social || "Sem nome",
  }));

  const aeronaveItems = aircrafts.map((a: any) => ({
    id: a.id,
    label: `${a.matricula} – ${a.modelo}${a.isClient ? ' ★' : ''}`,
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
                    {clientesAtivos.find(c => c.id === formData.clienteId)?.razao_social || "Cliente Principal"}
                  </SelectItem>
                  {clientPartners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome || p.name} {p.cpf ? `(${p.cpf})` : ""} — {p.percentual_participacao || p.percentual_sociedade}%
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
                  <div className="relative">
                    <Input
                      value={formData.dataVencimentoBoleto ? format(parseLocalDate(formData.dataVencimentoBoleto), "dd/MM/yyyy") : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
                        if (raw.length === 8) {
                          const [dd, mm, yyyy] = [raw.slice(0, 2), raw.slice(2, 4), raw.slice(4, 8)];
                          setFormData(p => ({ ...p, dataVencimentoBoleto: `${yyyy}-${mm}-${dd}` }));
                        } else if (raw.length === 0) {
                          setFormData(p => ({ ...p, dataVencimentoBoleto: "" }));
                        }
                      }}
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className="pr-10 rounded-xl border-border/60"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          <Calendar className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-auto p-0 border-0 z-[9999]">
                        <DatePickerCalendar
                          value={formData.dataVencimentoBoleto ? new Date(formData.dataVencimentoBoleto + "T00:00:00") : undefined}
                          onChange={(date) => {
                            const dateString = date ? format(date, "yyyy-MM-dd") : "";
                            setFormData(p => ({ ...p, dataVencimentoBoleto: dateString }));
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
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
                  <div className="relative">
                    <Input
                      value={formData.dataVencimentoBoleto ? format(parseLocalDate(formData.dataVencimentoBoleto), "dd/MM/yyyy") : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
                        if (raw.length === 8) {
                          const [dd, mm, yyyy] = [raw.slice(0, 2), raw.slice(2, 4), raw.slice(4, 8)];
                          setFormData(p => ({ ...p, dataVencimentoBoleto: `${yyyy}-${mm}-${dd}` }));
                        } else if (raw.length === 0) {
                          setFormData(p => ({ ...p, dataVencimentoBoleto: "" }));
                        }
                      }}
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className="pr-10 rounded-xl border-border/60"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          <Calendar className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-auto p-0 border-0 z-[9999]">
                        <DatePickerCalendar
                          value={formData.dataVencimentoBoleto ? new Date(formData.dataVencimentoBoleto + "T00:00:00") : undefined}
                          onChange={(date) => {
                            const dateString = date ? format(date, "yyyy-MM-dd") : "";
                            setFormData(p => ({ ...p, dataVencimentoBoleto: dateString }));
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
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
                onCheckedChange={(checked) => {
                  setFormData((p) => ({
                    ...p,
                    reembolsoRateado: checked === true,
                    ...(checked === false && {
                      reembolsoValorTotal: "",
                      reembolsoPorcentagem: "",
                    }),
                  }));
                  // Reset estado de edição manual
                  setValorEditadoManualmente(false);
                }}
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
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      reembolsoPorcentagem: e.target.value,
                    }));
                    // Resetar edição manual quando mudar a porcentagem
                    setValorEditadoManualmente(false);
                  }}
                  placeholder="Ex: 40.625"
                  required={formData.reembolsoRateado}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Aceita até 3 casas decimais (ex: 33.333)
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Valor do Recibo</Label>
                  {valorEditadoManualmente && (
                    <button
                      type="button"
                      onClick={() => {
                        // Recalcular o valor
                        const valorTotalStr = String(formData.reembolsoValorTotal)
                          .replace(/\./g, "")
                          .replace(/,/g, ".");
                        const valorTotal = parseFloat(valorTotalStr) || 0;
                        const porcentagem = parseFloat(formData.reembolsoPorcentagem) || 0;
                        const valorCalculado = (valorTotal * porcentagem / 100).toFixed(2);
                        setFormData(prev => ({ ...prev, valor: valorCalculado }));
                        setValorEditadoManualmente(false);
                      }}
                      className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <MoneyInput
                  value={formData.valor}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      valor: e.target.value,
                    }));
                    setValorEditadoManualmente(true);
                  }}
                  className="font-semibold"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {valorEditadoManualmente
                    ? "Valor ajustado manualmente"
                    : "Calculado automaticamente"}
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
                {favoriteDescriptions.map((desc) => {
                  const text = desc.descricao || desc.description || "";
                  return (
                    <button
                      key={desc.id}
                      type="button"
                      onClick={() => selectFavoriteDescription(text)}
                      className="w-full text-left p-2 text-sm hover:bg-accent rounded transition-colors"
                    >
                      {text}
                    </button>
                  );
                })}
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
