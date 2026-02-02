import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { FileText, Star } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { ClienteSearchInput } from "./ClienteSearchInput";

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
    reembolsoNumeroDocumento: "",
    reembolsoRateado: false,
    reembolsoBoletoFile: null as File | null,
    reembolsoNotaFiscalFile: null as File | null,
  });

  const [clienteSearchValue, setClienteSearchValue] = useState({
    clienteId: "",
    nome: "",
    documento: "",
    endereco: "",
    cidade: "",
    uf: "",
    useFromDatabase: false,
  });

  const [aircrafts, setAircrafts] = useState<any[]>([]);
  const [categoriasAgrupadas, setCategoriasAgrupadas] = useState<
    Record<string, Categoria[]>
  >({});
  const [favoriteDescriptions, setFavoriteDescriptions] = useState<FavoriteDescription[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);

  const isReembolso = formData.receiptType === "reembolso";

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

  // Load categorias
  useEffect(() => {
    const loadCategorias = async () => {
      const { data } = await supabase
        .from("categorias_movimentacao")
        .select("id, nome, grupo_categoria")
        .eq("tipo", "despesa")
        .eq("reembolsavel", true)
        .eq("ativo", true)
        .order("grupo_categoria")
        .order("nome");

      if (!data) return;

      const grouped = data.reduce((acc, cat) => {
        const grupo = cat.grupo_categoria || "OUTROS";
        if (!acc[grupo]) acc[grupo] = [];
        acc[grupo].push(cat);
        return acc;
      }, {} as Record<string, Categoria[]>);

      setCategoriasAgrupadas(grouped);
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

  // Reset ao mudar tipo
  useEffect(() => {
    if (formData.receiptType === "pagamento") {
      setFormData((prev) => ({
        ...prev,
        clienteId: "",
        aircraftId: "",
        reembolsoValorTotal: "",
        reembolsoPorcentagem: "",
        reembolsoCategoriaId: "",
        reembolsoNumeroDocumento: "",
        reembolsoRateado: false,
        reembolsoBoletoFile: null,
        reembolsoNotaFiscalFile: null,
      }));
      setAircrafts([]);
    } else {
      // Ao mudar para reembolso, limpa os campos do pagador
      // pois serão preenchidos automaticamente ao selecionar cliente
      setFormData((prev) => ({
        ...prev,
        pagadorNome: "",
        pagadorDocumento: "",
        pagadorEndereco: "",
        pagadorCidade: "",
        pagadorUF: "",
      }));
    }
  }, [formData.receiptType]);

  // Sincroniza a seleção de cliente com o formData
  const handleClienteSearchChange = (searchValue: typeof clienteSearchValue) => {
    setClienteSearchValue(searchValue);

    // Atualiza os dados do pagador no formulário
    setFormData((prev) => ({
      ...prev,
      clienteId: searchValue.clienteId,
      pagadorNome: searchValue.nome,
      pagadorDocumento: searchValue.documento,
      pagadorEndereco: searchValue.endereco,
      pagadorCidade: searchValue.cidade,
      pagadorUF: searchValue.uf,
    }));

    // Se é reembolso e foi selecionado um cliente, carrega as aeronaves
    if (formData.receiptType === "reembolso" && searchValue.clienteId) {
      loadAircrafts(searchValue.clienteId);
    }
  };

  // Cliente / Aeronave
  useEffect(() => {
    if (!formData.clienteId) {
      setAircrafts([]);
      return;
    }

    loadAircrafts(formData.clienteId);

    if (isReembolso) {
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
    }
  }, [formData.clienteId, isReembolso, clientesAtivos]);

  const loadAircrafts = async (clientId: string) => {
    const { data } = await supabase
      .from("client_aircraft")
      .select(`aircraft:aircraft_id ( id, registration, model )`)
      .eq("client_id", clientId);

    if (data) {
      setAircrafts(data.map((c) => c.aircraft).filter(Boolean));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validação específica por tipo
    if (isReembolso) {
      if (!formData.clienteId) {
        alert("Por favor, selecione o cliente para o reembolso");
        return;
      }
      if (!formData.aircraftId) {
        alert("Por favor, selecione a aeronave para o reembolso");
        return;
      }
      if (!formData.reembolsoCategoriaId) {
        alert("Por favor, selecione a categoria do reembolso");
        return;
      }
    } else {
      // Para pagamento, valida nome do pagador
      if (!formData.pagadorNome?.trim()) {
        alert("Por favor, preencha o nome do pagador");
        return;
      }
    }

    // Validações comuns
    if (!formData.valor || Number(formData.valor) <= 0) {
      alert("Por favor, preencha um valor válido");
      return;
    }
    if (!formData.servicoDescricao?.trim()) {
      alert("Por favor, preencha a descrição do serviço");
      return;
    }

    // Prepara os dados conforme a estrutura da tabela bank_reconciliations
    const submissionData = {
      // Dados básicos
      type: "cliente",
      date: formData.dataEmissao,
      description: formData.servicoDescricao,
      amount: parseFloat(formData.valor),
      status: "pendente",

      // IDs relacionados
      client_id: formData.clienteId || null,
      aircraft_id: formData.aircraftId || null,
      categoria_movimentacao_id: formData.reembolsoCategoriaId || null,

      // Dados específicos de reembolso
      tipo_documento: formData.reembolsoRateado ? "rateio" : "recibo",
      doc: formData.reembolsoNumeroDocumento || null,
      payment_term: formData.prazoMaximoQuitacao || null,

      // Dados de rateio
      percentual: formData.reembolsoRateado ? formData.reembolsoPorcentagem : null,

      // Forma de pagamento
      forma_pagamento: formData.reembolsoRateado ? "rateio_direto" : "empresa_paga",
      afeta_caixa_empresa: true,

      // Dados do fornecedor (para recibos de reembolso)
      fornecedor_nome: formData.pagadorNome || null,
      fornecedor_dados: formData.pagadorNome ? {
        nome: formData.pagadorNome,
        documento: formData.pagadorDocumento,
        endereco: formData.pagadorEndereco,
        cidade: formData.pagadorCidade,
        uf: formData.pagadorUF
      } : null,

      // Arquivos (URLs serão preenchidas após upload)
      boleto_url: null, // Será preenchido após upload
      nf_url: null, // Será preenchido após upload

      // Dados adicionais de rateio
      ...(formData.reembolsoRateado && {
        rateio_data: {
          valor_total: parseFloat(formData.reembolsoValorTotal),
          percentual: parseFloat(formData.reembolsoPorcentagem),
          valor_cliente: parseFloat(formData.valor)
        }
      }),

      // Arquivos para upload
      files: {
        boleto: formData.reembolsoBoletoFile,
        notaFiscal: formData.reembolsoNotaFiscalFile
      },

      // Dados originais do formulário (para compatibilidade)
      originalFormData: formData
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

          {/* BUSCA DE CLIENTE / PAGADOR - Para ambos os tipos */}
          <div className="p-4 border border-border rounded-lg bg-muted/30">
            <h3 className="font-semibold text-sm mb-4">
              {isReembolso ? "Dados do Cliente (Reembolso)" : "Dados do Pagador"}
            </h3>
            <ClienteSearchInput
              value={clienteSearchValue}
              onChange={handleClienteSearchChange}
              required={true}
              disabled={false}
            />
          </div>

          {/* AERONAVE - APENAS PARA REEMBOLSOS */}
          {isReembolso && clienteSearchValue.clienteId && (
            <div>
              <Label>Aeronave *</Label>
              <Select
                value={formData.aircraftId}
                disabled={!formData.clienteId}
                onValueChange={(v) =>
                  setFormData((p) => ({ ...p, aircraftId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a aeronave" />
                </SelectTrigger>
                <SelectContent>
                  {aircrafts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.registration} – {a.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* CATEGORIA E NÚMERO DO DOCUMENTO */}
          {isReembolso && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Categoria (Reembolso) *</Label>
                <Select
                  value={formData.reembolsoCategoriaId}
                  onValueChange={(v) =>
                    setFormData((p) => ({ ...p, reembolsoCategoriaId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoriasAgrupadas).map(([grupo, cats]) => (
                      <div key={grupo}>
                        <div className="px-2 py-1 text-xs font-bold uppercase opacity-70">
                          {grupo}
                        </div>
                        {cats.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.nome}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                    // Reset valores se desmarcar
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

          {/* CAMPOS DE RATEIO - só aparecem se marcado */}
          {isReembolso && formData.reembolsoRateado && (
            <div className="grid md:grid-cols-3 gap-4 p-4 border border-primary/20 rounded-lg bg-primary/5">
              <div>
                <Label>Valor Total da Despesa *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.reembolsoValorTotal}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      reembolsoValorTotal: e.target.value,
                    }))
                  }
                  placeholder="100% da despesa"
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
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valor}
                  readOnly
                  className="bg-muted cursor-not-allowed font-semibold"
                  placeholder="Calculado automaticamente"
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
              <Input
                type="number"
                step="0.01"
                value={formData.valor}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, valor: e.target.value }))
                }
                placeholder="Valor total da despesa"
                required
              />
            </div>
          )}

          {/* VALOR DO RECIBO - para pagamento normal */}
          {!isReembolso && (
            <div>
              <Label>Valor do Recibo *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.valor}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, valor: e.target.value }))
                }
                placeholder="Valor do recibo"
                required
              />
            </div>
          )}

          {/* PRAZO DE QUITAÇÃO */}
          {isReembolso && (
            <div className="space-y-3">
              <Label>Prazo Máximo de Quitação</Label>
              <div className="grid md:grid-cols-2 gap-4">
                {/* Input manual de data */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Digite a data</Label>
                  <Input
                    type="date"
                    value={formData.prazoMaximoQuitacao}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        prazoMaximoQuitacao: e.target.value,
                      }))
                    }
                    min={formData.dataEmissao}
                    className="w-full"
                  />
                </div>
              </div>
              {formData.prazoMaximoQuitacao && (
                <p className="text-xs text-muted-foreground">
                  Data selecionada: {format(parseLocalDate(formData.prazoMaximoQuitacao), "dd/MM/yyyy")}
                </p>
              )}
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
              placeholder="Ex: Reembolso de despesas de hangaragem referente ao mês de março"
              rows={3}
              required
            />
          </div>

          {/* UPLOADS */}
          {isReembolso && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Boleto</Label>
                <Input
                  type="file"
                  accept=".pdf"
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
                  accept=".pdf"
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
