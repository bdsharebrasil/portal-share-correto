import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { FileText, Upload, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

/* =========================
   TIPOS
========================= */

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

/* =========================
   COMPONENTE
========================= */

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
    reembolsoBoletoFile: null as File | null,
    reembolsoNotaFiscalFile: null as File | null,
  });

  const [aircrafts, setAircrafts] = useState<any[]>([]);
  const [categoriasAgrupadas, setCategoriasAgrupadas] = useState<
    Record<string, Categoria[]>
  >({});

  const isReembolso = formData.receiptType === "reembolso";

  /* =========================
     HELPERS DE DATA
  ========================= */

  const parseLocalDate = (dateString: string): Date => {
    const [y, m, d] = dateString.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const formatDateToString = (date: Date): string => {
    return format(date, "yyyy-MM-dd");
  };

  /* =========================
     LOAD CATEGORIAS
  ========================= */

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

  /* =========================
     RESET AO MUDAR TIPO
  ========================= */

  useEffect(() => {
    if (formData.receiptType === "pagamento") {
      setFormData((prev) => ({
        ...prev,
        clienteId: "",
        aircraftId: "",
        reembolsoValorTotal: "",
        reembolsoPorcentagem: "",
        reembolsoCategoriaId: "",
        reembolsoBoletoFile: null,
        reembolsoNotaFiscalFile: null,
      }));
      setAircrafts([]);
    }
  }, [formData.receiptType]);

  /* =========================
     CLIENTE / AERONAVE
  ========================= */

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
  }, [formData.clienteId, isReembolso]);

  const loadAircrafts = async (clientId: string) => {
    const { data } = await supabase
      .from("client_aircraft")
      .select(
        `aircraft:aircraft_id ( id, registration, model )`
      )
      .eq("client_id", clientId);

    if (data) {
      setAircrafts(data.map((c) => c.aircraft).filter(Boolean));
    }
  };

  /* =========================
     SUBMIT
  ========================= */

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleFileChange = (field: string, file: File | null) => {
    setFormData((prev) => ({ ...prev, [field]: file }));
  };

  /* =========================
     RENDER
  ========================= */

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

          {/* CLIENTE / AERONAVE */}
          {isReembolso && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Cliente *</Label>
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
            </div>
          )}
{/* DESCRIÇÃO DO SERVIÇO / RECIBO */}
<div className="space-y-2">
  <Label>
    Descrição do Serviço / Referência do Recibo *
  </Label>
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
<div className="space-y-2">
  <Label>Valor do Recibo *</Label>
  <Input
    type="number"
    step="0.01"
    value={formData.valor}
    onChange={(e) =>
      setFormData((prev) => ({ ...prev, valor: e.target.value }))
    }
    placeholder="Valor que este cliente irá pagar"
    required
  />
  {isReembolso && (
    <p className="text-xs text-muted-foreground">
      Valor correspondente a este cliente no rateio
    </p>
  )}
</div>
<div className="space-y-2">
  <Label>Valor Total da Despesa</Label>
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
    placeholder="100% da despesa (opcional)"
  />
</div>
<div className="space-y-2">
  <Label>Percentual deste Cliente (%)</Label>
  <Input
    type="number"
    step="0.01"
    min="0"
    max="100"
    value={formData.reembolsoPorcentagem}
    onChange={(e) =>
      setFormData((prev) => ({
        ...prev,
        reembolsoPorcentagem: e.target.value,
      }))
    }
    placeholder="Ex: 40"
  />
</div>

          {/* PRAZO DE QUITAÇÃO */}
          {isReembolso && (
            <div>
              <Label>Prazo Máximo de Quitação</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.prazoMaximoQuitacao
                      ? format(
                        parseLocalDate(formData.prazoMaximoQuitacao),
                        "dd 'de' MMMM 'de' yyyy",
                        { locale: ptBR }
                      )
                      : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0">
                  <Calendar
                    mode="single"
                    selected={
                      formData.prazoMaximoQuitacao
                        ? parseLocalDate(formData.prazoMaximoQuitacao)
                        : undefined
                    }
                    onSelect={(d) =>
                      d &&
                      setFormData((p) => ({
                        ...p,
                        prazoMaximoQuitacao: formatDateToString(d),
                      }))
                    }
                    disabled={(d) =>
                      d < parseLocalDate(formData.dataEmissao)
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* CATEGORIA */}
          {isReembolso && (
            <div>
              <Label>Categoria (Reembolso)</Label>
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
                  {Object.entries(categoriasAgrupadas).map(
                    ([grupo, cats]) => (
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
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* UPLOADS */}
          {isReembolso && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Boleto (PDF)</Label>
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
                <Label>Nota Fiscal (PDF)</Label>
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
