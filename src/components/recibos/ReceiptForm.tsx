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

  // Reset campos de reembolso ao mudar tipo (mas manter cliente/pagador)
  useEffect(() => {
    if (formData.receiptType === "pagamento") {
      setFormData((prev) => ({
        ...prev,
        reembolsoValorTotal: "",
        reembolsoPorcentagem: "",
        reembolsoCategoriaId: "",
        reembolsoNumeroDocumento: "",
        reembolsoRateado: false,
        reembolsoBoletoFile: null,
        reembolsoNotaFiscalFile: null,
      }));
    }
  }, [formData.receiptType]);

  // Cliente / Aeronave - preenche dados do pagador para ambos os tipos
  useEffect(() => {
    if (!formData.clienteId) {
      setAircrafts([]);
      return;
    }

    loadAircrafts(formData.clienteId);

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
  }, [formData.clienteId]);

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

    // Envia dados do formulário diretamente com campos de pagador no nível raiz
    const submissionData = {
      ...formData,
      // Garantir campos no nível raiz para EmissaoRecibo
      pagadorNome: formData.pagadorNome,
      pagadorDocumento: formData.pagadorDocumento,
      pagadorEndereco: formData.pagadorEndereco,
      pagadorCidade: formData.pagadorCidade,
      pagadorUF: formData.pagadorUF,
      valor: formData.valor,
      servicoDescricao: formData.servicoDescricao,
      // Compatibilidade
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

          {/* CLIENTE / AERONAVE - visível para ambos os tipos */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Cliente</Label>
              <Select
                value={formData.clienteId}
                onValueChange={(v) =>
                  setFormData((p) => ({ ...p, clienteId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientesAtivos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Aeronave</Label>
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
          </div>

          {/* DADOS DO PAGADOR - visível para ambos os tipos */}
          <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
            <Label className="text-sm font-semibold">Dados do Pagador</Label>
            <p className="text-xs text-muted-foreground -mt-2">
              {formData.clienteId ? "Preenchido automaticamente pelo cliente selecionado" : "Preencha manualmente os dados do pagador"}
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

          {/* FORMA DE PAGAMENTO - visível para ambos os tipos */}
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

          {/* PRAZO DE QUITAÇÃO - visível para ambos */}
          <div className="space-y-3">
            <Label>Prazo Máximo de Quitação</Label>
            <div className="grid md:grid-cols-2 gap-4">
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
