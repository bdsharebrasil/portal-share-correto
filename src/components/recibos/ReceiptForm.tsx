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
import { FileText, Star, Calendar } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { toast } from "@/components/ui/use-toast";

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
  const [isSaving, setIsSaving] = useState(false);

  const isReembolso = formData.receiptType === "reembolso";

  const selectedCategoria = categoriasReembolsaveis.find(
    (c) => c.id === formData.reembolsoCategoriaId
  );
  const categoriaNome =
    selectedCategoria?.nome || formData.reembolsoCategoriaNome || "";
  const isDecea = categoriaNome.toUpperCase().includes("DECEA");
  const isInfraero = categoriaNome.toUpperCase().includes("INFRAERO");
  const isDECEAorINFRAERO = isDecea || isInfraero;

  // ─── Auto-calc valor when rateado ────────────────────────────────────────
  useEffect(() => {
    if (
      formData.reembolsoRateado &&
      formData.reembolsoValorTotal &&
      formData.reembolsoPorcentagem
    ) {
      const valorTotal =
        parseFloat(String(formData.reembolsoValorTotal).replace(",", ".")) || 0;
      const porcentagem = parseFloat(formData.reembolsoPorcentagem) || 0;
      const valorCalculado = ((valorTotal * porcentagem) / 100).toFixed(2);
      if (!valorEditadoManualmente) {
        setFormData((prev) => ({ ...prev, valor: valorCalculado }));
      }
    }
  }, [
    formData.reembolsoValorTotal,
    formData.reembolsoPorcentagem,
    formData.reembolsoRateado,
    valorEditadoManualmente,
  ]);

  const parseLocalDate = (dateString: string): Date => {
    const [y, m, d] = dateString.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  // ─── Load categorias reembolsáveis ───────────────────────────────────────
  useEffect(() => {
    supabase
      .from("categorias_movimentacao")
      .select("id, nome, grupo_categoria")
      .eq("grupo_categoria", "DESPESAS REEMBOLSÁVEIS")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => {
        if (data) setCategoriasReembolsaveis(data);
      });
  }, []);

  // ─── Load favorite descriptions ──────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("receipt_descriptions")
      .select("*")
      .order("criado_em", { ascending: false })
      .then(({ data }) => setFavoriteDescriptions(data || []));
  }, []);

  // ─── Reset reembolso fields when type changes ─────────────────────────────
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

  // ─── Reset DECEA/INFRAERO fields when category changes ───────────────────
  useEffect(() => {
    setFormData((prev) => ({
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

  // ─── Auto-fill description based on category + aeronave ──────────────────
  useEffect(() => {
    if (!isReembolso || !selectedCategoria) return;

    const selectedAircraft = aircrafts.find((a) => a.id === formData.aircraftId);
    const aeronaveStr = selectedAircraft?.matricula
      ? ` AERONAVE ${selectedAircraft.matricula}`
      : "";

    if (isInfraero) {
      const comp = formData.competenciaInfraero
        ? ` COMPETÊNCIA ${formData.competenciaInfraero.toUpperCase()}`
        : "";
      const doc = formData.numeroDocumentoInfraero
        ? ` DEMONSTRATIVO ${formData.numeroDocumentoInfraero.toUpperCase()}`
        : "";
      setFormData((prev) => ({
        ...prev,
        servicoDescricao: `REFERENTE A INFRAERO${aeronaveStr}${comp}${doc}`.trim(),
      }));
    } else if (isDecea) {
      const comp = formData.competenciaDecea
        ? ` COMPETÊNCIA ${formData.competenciaDecea.toUpperCase()}`
        : "";
      const doc = formData.numeroDocumentoDecea
        ? ` DEMONSTRATIVO ${formData.numeroDocumentoDecea.toUpperCase()}`
        : "";
      setFormData((prev) => ({
        ...prev,
        servicoDescricao: `REFERENTE A DECEA${aeronaveStr}${comp}${doc}`.trim(),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        servicoDescricao: `Referente a ${selectedCategoria.nome}`,
      }));
    }
  }, [
    formData.reembolsoCategoriaId,
    formData.aircraftId,
    formData.competenciaInfraero,
    formData.numeroDocumentoInfraero,
    formData.competenciaDecea,
    formData.numeroDocumentoDecea,
  ]);

  // ─── INFRAERO/DECEA: sync boleto value → reembolsoValorTotal ─────────────
  useEffect(() => {
    if (!isDECEAorINFRAERO || !formData.valorTotalBoleto) return;
    setFormData((prev) => ({
      ...prev,
      reembolsoValorTotal: prev.valorTotalBoleto,
      reembolsoRateado: true,
    }));
  }, [formData.valorTotalBoleto, isDECEAorINFRAERO]);

  // ─── Load ALL aircrafts on mount ──────────────────────────────────────────
  useEffect(() => {
    loadAllAircrafts();
  }, []);

  // Debug: log aircrafts when they change
  useEffect(() => {
    console.log("Aircrafts loaded:", aircrafts);
  }, [aircrafts]);

  // ─── When client changes: load all aircrafts ───────────────────────────────
  useEffect(() => {
    if (!formData.clienteId) {
      loadAllAircrafts();
      setClientPartners([]);
      setSelectedPartnerId("");
      return;
    }
    loadAllAircrafts();
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

  // ─── Load ALL aircrafts (no client filter) ────────────────────────────────
  const loadAllAircrafts = async () => {
    const { data, error } = await supabase
      .from("aeronave")
      .select("id, matricula, modelo, status")
      .order("matricula");

    if (error) {
      console.error("Error loading aircrafts:", error);
      return;
    }

    console.log("All aircrafts from DB:", data);

    setAircrafts(
      (data || []).map((a: any) => ({
        id: a.id,
        matricula: a.matricula,
        modelo: a.modelo,
        isClient: false,
      }))
    );
  };

  // ─── Load aircrafts: client's first (★), then all others ─────────────────
  const loadAircrafts = async (clientId: string) => {
    // 1. Fetch aircraft linked to this client
    const { data: clientData } = await supabase
      .from("cotistas_aeronave")
      .select(`id_aeronave, aeronave:id_aeronave ( id, matricula, modelo )`)
      .eq("id_clientes", clientId);

    const clientAircraftIds = new Set<string>();
    const clientAircrafts = (clientData || [])
      .map((c: any) => {
        const a = c.aeronave;
        if (!a) return null;
        clientAircraftIds.add(a.id);
        return {
          id: a.id,
          matricula: a.matricula,
          modelo: a.modelo,
          isClient: true,
        };
      })
      .filter(Boolean);

    // 2. Fetch ALL active aircraft
    const { data: allData } = await supabase
      .from("aeronave")
      .select("id, matricula, modelo")
      .eq("status", "ativo")
      .order("matricula");

    // 3. Other aircraft (not linked to this client)
    const otherAircrafts = (allData || [])
      .filter((a: any) => !clientAircraftIds.has(a.id))
      .map((a: any) => ({
        id: a.id,
        matricula: a.matricula,
        modelo: a.modelo,
        isClient: false,
      }));

    // 4. Client's aircraft first, then the rest
    const orderedAircrafts = [...clientAircrafts, ...otherAircrafts];
    setAircrafts(orderedAircrafts);

    // Auto-select client's first aircraft if current selection isn't in list
    setFormData((prev) => {
      const exists = orderedAircrafts.some((a) => a?.id === prev.aircraftId);
      if (exists) return prev;
      const preferred =
        orderedAircrafts.find((a) => a?.isClient) || orderedAircrafts[0];
      return { ...prev, aircraftId: preferred?.id || "" };
    });
  };

  const loadClientPartners = async (clientId: string) => {
    const { data } = await supabase
      .from("socios_cliente")
      .select("id, nome, cpf, percentual_participacao")
      .eq("cliente_id", clientId)
      .order("nome");
    setClientPartners(
      (data || []).map((d) => ({
        id: d.id,
        name: d.nome,
        nome: d.nome,
        cpf: d.cpf,
        percentual_sociedade: d.percentual_participacao,
        percentual_participacao: d.percentual_participacao,
      }))
    );
  };

  // ─── Upload helper ────────────────────────────────────────────────────────
  const uploadFile = async (
    file: File,
    path: string
  ): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from("recibos-anexos")
      .upload(path, file, { upsert: true });
    if (error) {
      console.error("Upload error:", error.message);
      return null;
    }
    const { data: publicData } = supabase.storage
      .from("recibos-anexos")
      .getPublicUrl(data.path);
    return publicData.publicUrl;
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      const hoje = new Date().toISOString().split("T")[0].replace(/-/g, "");
      const numeroRecibo = `REC-${hoje}-${Math.floor(1000 + Math.random() * 9000)}`;

      let urlBoleto: string | null = null;
      let urlNf: string | null = null;

      if (isReembolso) {
        if (isDECEAorINFRAERO) {
          const file = isDecea ? formData.decealFile : formData.infraeroFile;
          if (file) {
            urlNf = await uploadFile(
              file,
              `${user.id}/${numeroRecibo}-demonstrativo`
            );
          }
        } else {
          if (formData.reembolsoBoletoFile) {
            urlBoleto = await uploadFile(
              formData.reembolsoBoletoFile,
              `${user.id}/${numeroRecibo}-boleto`
            );
          }
          if (formData.reembolsoNotaFiscalFile) {
            urlNf = await uploadFile(
              formData.reembolsoNotaFiscalFile,
              `${user.id}/${numeroRecibo}-nf`
            );
          }
        }
      }

      let socioNome: string | null = null;
      if (selectedPartnerId && selectedPartnerId !== "__client__") {
        const partner = clientPartners.find((p) => p.id === selectedPartnerId);
        if (partner) socioNome = partner.nome || partner.name || null;
      }

      let numeroDocumento: string | null = null;
      if (isReembolso) {
        if (isDecea) {
          numeroDocumento = formData.numeroDocumentoDecea || null;
        } else if (isInfraero) {
          numeroDocumento = formData.numeroDocumentoInfraero || null;
        } else {
          numeroDocumento = formData.reembolsoNumeroDocumento || null;
        }
      }

      const dataMaxPagamento =
        formData.prazoMaximoQuitacao ||
        (isDECEAorINFRAERO && formData.dataVencimentoBoleto
          ? formData.dataVencimentoBoleto
          : null);

      const payload = {
        numero_recibo: numeroRecibo,
        usuario_id: user.id,

        nome_pagador: formData.pagadorNome,
        documento_pagador: formData.pagadorDocumento || null,
        endereco_pagador: formData.pagadorEndereco || null,
        cidade_pagador: formData.pagadorCidade || null,
        uf_pagador: formData.pagadorUF || null,

        valor: parseFloat(String(formData.valor).replace(",", ".")) || 0,
        valor_total: formData.reembolsoRateado
          ? parseFloat(String(formData.reembolsoValorTotal).replace(",", ".")) || null
          : null,
        percentual: formData.reembolsoRateado
          ? parseFloat(formData.reembolsoPorcentagem) || null
          : null,
        compartilhado: formData.reembolsoRateado,

        descricao_servico: formData.servicoDescricao,
        tipo_recibo: formData.receiptType,
        forma_pagamento: formData.formaPagamento || null,

        nome_categoria: isReembolso ? (categoriaNome || null) : null,
        numero_documento: numeroDocumento,

        data_emissao: formData.dataEmissao,
        data_max_pagamento: dataMaxPagamento || null,

        cliente_id: formData.clienteId || null,
        aeronave_id: formData.aircraftId || null,
        socios_cliente: socioNome,

        url_boleto: urlBoleto,
        url_nf: urlNf,
        url_pdf: null,

        status: "pendente",
      };

      const { data: inserted, error } = await supabase
        .from("recibos")
        .insert([payload])
        .select()
        .single();

      if (error) {
        toast({
          title: "Erro ao salvar recibo",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      onSubmit({
        ...formData,
        insertedRecibo: inserted,
        selectedPartnerId,
        categoriaNome,
        isDecea,
        isInfraero,
        originalFormData: formData,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = (field: string, file: File | null) => {
    setFormData((prev) => ({ ...prev, [field]: file }));
  };

  const selectFavoriteDescription = (description: string) => {
    setFormData((prev) => ({ ...prev, servicoDescricao: description }));
    setShowFavorites(false);
  };

  // ─── SearchableCombobox items ─────────────────────────────────────────────
  const clienteItems = clientesAtivos.map((c) => ({
    id: c.id,
    label: c.razao_social || "Sem nome",
  }));

  const aeronaveItems = aircrafts.map((a: any) => ({
    id: a.id,
    label: `${a.matricula} – ${a.modelo}${a.isClient ? " ★" : ""}`,
  }));

  const categoriaItems = categoriasReembolsaveis.map((c) => ({
    id: c.id,
    label: c.nome,
  }));

  const submitting = isGenerating || isSaving;

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="p-6 space-y-6">

          {/* TIPO */}
          <div>
            <Label>Tipo de Recibo</Label>
            <Select
              value={formData.receiptType}
              onValueChange={(v) => setFormData((p) => ({ ...p, receiptType: v }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pagamento">Pagamento</SelectItem>
                <SelectItem value="reembolso">Reembolso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* CATEGORIA */}
          {isReembolso && (
            <div>
              <Label>Categoria (Despesas Reembolsáveis) *</Label>
              <SearchableCombobox
                items={categoriaItems}
                value={formData.reembolsoCategoriaId}
                onChange={(id, label) =>
                  setFormData((p) => ({
                    ...p,
                    reembolsoCategoriaId: id,
                    reembolsoCategoriaNome: label,
                  }))
                }
                placeholder="Selecione a categoria"
                searchPlaceholder="Buscar categoria..."
                emptyMessage="Nenhuma categoria encontrada"
              />
            </div>
          )}

          {/* CLIENTE / AERONAVE */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Cliente</Label>
              <SearchableCombobox
                items={clienteItems}
                value={formData.clienteId}
                onChange={(id) => setFormData((p) => ({ ...p, clienteId: id }))}
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
                onChange={(id) => setFormData((p) => ({ ...p, aircraftId: id }))}
                placeholder="Selecione a aeronave"
                searchPlaceholder="Buscar aeronave..."
                emptyMessage="Nenhuma aeronave encontrada"
              />
            </div>
          </div>

          {/* SÓCIO */}
          {clientPartners.length > 0 && formData.clienteId && (
            <div className="p-4 border border-border rounded-lg bg-muted/20 space-y-2">
              <Label className="text-sm font-semibold">Sócio / Pagador</Label>
              <p className="text-xs text-muted-foreground">
                Este cliente possui sócios vinculados. Selecione o sócio que
                será o pagador do recibo.
              </p>
              <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o sócio (pagador)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__client__">
                    {clientesAtivos.find((c) => c.id === formData.clienteId)
                      ?.razao_social || "Cliente Principal"}
                  </SelectItem>
                  {clientPartners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome || p.name} {p.cpf ? `(${p.cpf})` : ""} —{" "}
                      {p.percentual_participacao || p.percentual_sociedade}%
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
              {selectedPartnerId
                ? "Preenchido pelo sócio selecionado"
                : formData.clienteId
                ? "Preenchido automaticamente pelo cliente selecionado"
                : "Preencha manualmente os dados do pagador"}
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Nome / Razão Social *</Label>
                <Input
                  value={formData.pagadorNome}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, pagadorNome: e.target.value }))
                  }
                  placeholder="Nome do pagador"
                  required
                />
              </div>
              <div>
                <Label>CPF / CNPJ *</Label>
                <Input
                  value={formData.pagadorDocumento}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      pagadorDocumento: e.target.value,
                    }))
                  }
                  placeholder="Documento do pagador"
                  required
                />
              </div>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input
                value={formData.pagadorEndereco}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    pagadorEndereco: e.target.value,
                  }))
                }
                placeholder="Endereço"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Cidade</Label>
                <Input
                  value={formData.pagadorCidade}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      pagadorCidade: e.target.value,
                    }))
                  }
                  placeholder="Cidade"
                />
              </div>
              <div>
                <Label>UF</Label>
                <Input
                  value={formData.pagadorUF}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, pagadorUF: e.target.value }))
                  }
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          {/* FORMA DE PAGAMENTO */}
          {!isReembolso && (
            <div>
              <Label>Forma de Pagamento</Label>
              <Select
                value={formData.formaPagamento}
                onValueChange={(v) =>
                  setFormData((p) => ({ ...p, formaPagamento: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="transferencia">
                    Transferência Bancária
                  </SelectItem>
                  <SelectItem value="cartao_credito">
                    Cartão de Crédito
                  </SelectItem>
                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* DECEA */}
          {isReembolso && isDecea && (
            <div className="p-4 border border-amber-500/30 rounded-lg bg-amber-500/5 space-y-4">
              <Label className="text-sm font-semibold text-amber-700">
                📋 Campos DECEA
              </Label>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Número do Documento *</Label>
                  <Input
                    value={formData.numeroDocumentoDecea}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        numeroDocumentoDecea: e.target.value,
                      }))
                    }
                    placeholder="Nº do documento DECEA"
                    required
                  />
                </div>
                <div>
                  <Label>Competência *</Label>
                  <Input
                    value={formData.competenciaDecea}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        competenciaDecea: e.target.value,
                      }))
                    }
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
                      value={
                        formData.dataVencimentoBoleto
                          ? format(
                              parseLocalDate(formData.dataVencimentoBoleto),
                              "dd/MM/yyyy"
                            )
                          : ""
                      }
                      onChange={(e) => {
                        const raw = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 8);
                        if (raw.length === 8) {
                          const [dd, mm, yyyy] = [
                            raw.slice(0, 2),
                            raw.slice(2, 4),
                            raw.slice(4, 8),
                          ];
                          setFormData((p) => ({
                            ...p,
                            dataVencimentoBoleto: `${yyyy}-${mm}-${dd}`,
                          }));
                        } else if (raw.length === 0) {
                          setFormData((p) => ({
                            ...p,
                            dataVencimentoBoleto: "",
                          }));
                        }
                      }}
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className="pr-10 rounded-xl border-border/60"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <Calendar className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        className="w-auto p-0 border-0 z-[9999]"
                      >
                        <DatePickerCalendar
                          value={
                            formData.dataVencimentoBoleto
                              ? new Date(
                                  formData.dataVencimentoBoleto + "T00:00:00"
                                )
                              : undefined
                          }
                          onChange={(date) => {
                            const dateString = date
                              ? format(date, "yyyy-MM-dd")
                              : "";
                            setFormData((p) => ({
                              ...p,
                              dataVencimentoBoleto: dateString,
                            }));
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
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        valorTotalBoleto: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>
              <div>
                <Label>Demonstrativo DECEA (PDF/Imagem)</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff"
                  onChange={(e) =>
                    handleFileChange("decealFile", e.target.files?.[0] || null)
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Aceita PDF e imagens
                </p>
              </div>
            </div>
          )}

          {/* INFRAERO */}
          {isReembolso && isInfraero && (
            <div className="p-4 border border-blue-500/30 rounded-lg bg-blue-500/5 space-y-4">
              <Label className="text-sm font-semibold text-blue-700">
                📋 Campos INFRAERO
              </Label>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Documento INFRAERO *</Label>
                  <Input
                    value={formData.numeroDocumentoInfraero}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        numeroDocumentoInfraero: e.target.value,
                      }))
                    }
                    placeholder="Nº do documento INFRAERO"
                    required
                  />
                </div>
                <div>
                  <Label>Competência *</Label>
                  <Input
                    value={formData.competenciaInfraero}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        competenciaInfraero: e.target.value,
                      }))
                    }
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
                      value={
                        formData.dataVencimentoBoleto
                          ? format(
                              parseLocalDate(formData.dataVencimentoBoleto),
                              "dd/MM/yyyy"
                            )
                          : ""
                      }
                      onChange={(e) => {
                        const raw = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 8);
                        if (raw.length === 8) {
                          const [dd, mm, yyyy] = [
                            raw.slice(0, 2),
                            raw.slice(2, 4),
                            raw.slice(4, 8),
                          ];
                          setFormData((p) => ({
                            ...p,
                            dataVencimentoBoleto: `${yyyy}-${mm}-${dd}`,
                          }));
                        } else if (raw.length === 0) {
                          setFormData((p) => ({
                            ...p,
                            dataVencimentoBoleto: "",
                          }));
                        }
                      }}
                      placeholder="DD/MM/AAAA"
                      maxLength={10}
                      className="pr-10 rounded-xl border-border/60"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <Calendar className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        className="w-auto p-0 border-0 z-[9999]"
                      >
                        <DatePickerCalendar
                          value={
                            formData.dataVencimentoBoleto
                              ? new Date(
                                  formData.dataVencimentoBoleto + "T00:00:00"
                                )
                              : undefined
                          }
                          onChange={(date) => {
                            const dateString = date
                              ? format(date, "yyyy-MM-dd")
                              : "";
                            setFormData((p) => ({
                              ...p,
                              dataVencimentoBoleto: dateString,
                            }));
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
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        valorTotalBoleto: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>
              <div>
                <Label>Demonstrativo INFRAERO (PDF/Imagem)</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff"
                  onChange={(e) =>
                    handleFileChange(
                      "infraeroFile",
                      e.target.files?.[0] || null
                    )
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Aceita PDF e imagens
                </p>
              </div>
            </div>
          )}

          {/* Nº DOCUMENTO (non-DECEA/INFRAERO reembolso) */}
          {isReembolso && !isDECEAorINFRAERO && (
            <div>
              <Label>Número do Documento</Label>
              <Input
                value={formData.reembolsoNumeroDocumento}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    reembolsoNumeroDocumento: e.target.value,
                  }))
                }
                placeholder="Ex: NF 12345"
              />
            </div>
          )}

          {/* RATEIO CHECKBOX */}
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
                        const valorTotal =
                          parseFloat(
                            String(formData.reembolsoValorTotal).replace(",", ".")
                          ) || 0;
                        const porcentagem =
                          parseFloat(formData.reembolsoPorcentagem) || 0;
                        const valorCalculado = (
                          (valorTotal * porcentagem) / 100
                        ).toFixed(2);
                        setFormData((prev) => ({
                          ...prev,
                          valor: valorCalculado,
                        }));
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
                    setFormData((prev) => ({ ...prev, valor: e.target.value }));
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

          {/* VALOR - não rateado */}
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

          {/* VALOR - pagamento */}
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

          {/* PRAZO DE QUITAÇÃO */}
          {isReembolso && (
            <div className="space-y-2">
              <Label>Prazo Máximo de Quitação</Label>
              <div className="relative">
                <Input
                  value={(() => {
                    const dateStr = formData.prazoMaximoQuitacao;
                    if (!dateStr) return "";
                    try {
                      return format(parseLocalDate(dateStr), "dd/MM/yyyy");
                    } catch {
                      return "";
                    }
                  })()}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
                    if (raw.length === 8) {
                      const [dd, mm, yyyy] = [
                        raw.slice(0, 2),
                        raw.slice(2, 4),
                        raw.slice(4, 8),
                      ];
                      setFormData((p) => ({
                        ...p,
                        prazoMaximoQuitacao: `${yyyy}-${mm}-${dd}`,
                      }));
                    } else if (raw.length === 0) {
                      setFormData((p) => ({ ...p, prazoMaximoQuitacao: "" }));
                    }
                  }}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className="pr-10 rounded-xl border-border/60"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <Calendar className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-auto p-0 border-0 z-[9999]"
                  >
                    <DatePickerCalendar
                      value={
                        formData.prazoMaximoQuitacao
                          ? new Date(formData.prazoMaximoQuitacao + "T00:00:00")
                          : undefined
                      }
                      onChange={(date) => {
                        const dateString = date
                          ? format(date, "yyyy-MM-dd")
                          : "";
                        setFormData((p) => ({
                          ...p,
                          prazoMaximoQuitacao: dateString,
                        }));
                      }}
                      disabled={(date) => {
                        const minDate = new Date(
                          formData.dataEmissao + "T00:00:00"
                        );
                        return date < minDate;
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* DESCRIÇÃO */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Descrição do Serviço *</Label>
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

          {/* UPLOADS */}
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
            <Button type="submit" disabled={submitting}>
              <FileText className="mr-2 h-4 w-4" />
              {submitting ? "Salvando..." : "Gerar Recibo"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
