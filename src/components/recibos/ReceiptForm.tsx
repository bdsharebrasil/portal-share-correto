import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Receipt, Star, CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useReceiptForm } from "@/hooks/useReceiptForm";
import { parseLocalDate, numberToCurrencyWords, formatCurrency } from "@/lib/receiptUtils";
import { supabase } from "@/integrations/supabase/client";

interface Cliente {
  id: string;
  company_name: string | null;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  uf: string | null;
}

interface Aircraft {
  id: string;
  registration: string;
  model: string | null;
}

interface FavoritePayer {
  id: string;
  name: string;
  document: string;
  address?: string;
  city?: string;
  uf?: string;
}

interface ReceiptFormProps {
  clientesAtivos: Cliente[];
  favoritePayers: FavoritePayer[];
  isGenerating: boolean;
  onSubmit: (formData: any) => Promise<void>;
}

export function ReceiptForm({
  clientesAtivos,
  favoritePayers,
  isGenerating,
  onSubmit,
}: ReceiptFormProps) {
  const { form, errors, isValid, updateField, updatePayer, reset, getFormDataForSubmit } = useReceiptForm();
  const [suggestions, setSuggestions] = useState<FavoritePayer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aircrafts, setAircrafts] = useState<Aircraft[]>([]);
  const [isLoadingAircrafts, setIsLoadingAircrafts] = useState(false);
  const [aircraftSuggestions, setAircraftSuggestions] = useState<Aircraft[]>([]);
  const [showAircraftSuggestions, setShowAircraftSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const aircraftContainerRef = useRef<HTMLDivElement | null>(null);

  // Event listener para fechar sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (!aircraftContainerRef.current?.contains(e.target as Node)) {
        setShowAircraftSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadClientAircrafts = async (clienteId: string) => {
    setIsLoadingAircrafts(true);
    try {
      const { data, error } = await supabase
        .from("client_aircraft")
        .select("aircraft_id, aircraft:aircraft_id(id, registration, model)")
        .eq("client_id", clienteId);

      if (error) throw error;

      const loadedAircrafts: Aircraft[] = (data || []).map((item: any) => ({
        id: item.aircraft_id,
        registration: item.aircraft?.registration || item.aircraft_id,
        model: item.aircraft?.model || null,
      }));

      setAircrafts(loadedAircrafts);
      // Limpar seleção anterior
      updateField("selectedAircraftId", "");
    } catch (err) {
      console.error("Erro ao carregar aeronaves do cliente:", err);
      setAircrafts([]);
    } finally {
      setIsLoadingAircrafts(false);
    }
  };

  const handleClienteSelect = (clienteId: string) => {
    const cliente = clientesAtivos.find((c) => c.id === clienteId);
    if (cliente) {
      updatePayer({
        selectedClienteId: clienteId,
        pagadorNome: cliente.company_name || "",
        pagadorDocumento: cliente.cnpj || "",
        pagadorEndereco: cliente.address || "",
        pagadorCidade: cliente.city || "",
        pagadorUF: cliente.uf || "",
      });
      // Carregar as aeronaves do cliente
      loadClientAircrafts(clienteId);
    }
  };

  const handlePayerNameChange = (value: string) => {
    updateField("pagadorNome", value);
    if (value.length > 2) {
      const filtered = favoritePayers.filter((p) =>
        p.name.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const applySuggestion = (payer: FavoritePayer) => {
    updatePayer({
      pagadorNome: payer.name,
      pagadorDocumento: payer.document,
      pagadorEndereco: payer.address || "",
      pagadorCidade: payer.city || "",
      pagadorUF: payer.uf || "",
    });
    setShowSuggestions(false);
  };

  const handleAircraftChange = (value: string) => {
    updateField("selectedAircraftId", value);
    if (value.length > 0 && aircrafts.length > 0) {
      const filtered = aircrafts.filter((a) =>
        a.registration.toLowerCase().includes(value.toLowerCase()) ||
        (a.model && a.model.toLowerCase().includes(value.toLowerCase()))
      );
      setAircraftSuggestions(filtered);
      setShowAircraftSuggestions(filtered.length > 0);
    } else {
      setShowAircraftSuggestions(false);
    }
  };

  const applyAircraftSuggestion = (aircraft: Aircraft) => {
    updateField("selectedAircraftId", aircraft.registration);
    setShowAircraftSuggestions(false);
  };

  const handleSubmit = async () => {
    const formData = getFormDataForSubmit();
    if (!formData) return;
    await onSubmit(formData);
    reset();
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card: Dados do Recibo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Dados do Recibo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            <div className="space-y-2">
              <Label>Data de Emissão *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(parseLocalDate(form.dataEmissao), "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <UICalendar
                    mode="single"
                    selected={(() => {
                      // Converter string YYYY-MM-DD para data local sem conversão UTC
                      const [year, month, day] = form.dataEmissao.split('-').map(Number);
                      return new Date(year, month - 1, day);
                    })()}
                    onSelect={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, "0");
                        const day = String(date.getDate()).padStart(2, "0");
                        updateField("dataEmissao", `${year}-${month}-${day}`);
                      }
                    }}
                    disabled={(date) => {
                      // Comparar apenas a data (não a hora) com hoje
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const selectedDate = new Date(date);
                      selectedDate.setHours(0, 0, 0, 0);
                      return selectedDate > today;
                    }}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                placeholder="0,00"
                step="0.01"
                min="0"
                value={form.valor}
                onChange={(e) => updateField("valor", e.target.value)}
              />
              {form.valor && parseFloat(form.valor) > 0 && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
                  <span className="font-medium">Por extenso: </span>
                  <span className="italic">{numberToCurrencyWords(parseFloat(form.valor.replace(",", ".")))}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Descrição do Serviço *</Label>
              <Textarea
                placeholder="Descreva os serviços prestados"
                rows={3}
                value={form.servico}
                onChange={(e) => updateField("servico", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Recibo *</Label>
              <Select value={form.receiptType} onValueChange={(v) => updateField("receiptType", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagamento">Pagamento realizado</SelectItem>
                  <SelectItem value="reembolso">Solicitação de reembolso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.receiptType === "pagamento" && (
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Input
                  placeholder="PIX, Dinheiro, Transferência bancária..."
                  value={form.formaPagamento}
                  onChange={(e) => updateField("formaPagamento", e.target.value)}
                />
              </div>
            )}

            {form.receiptType !== "pagamento" && (
              <div className="space-y-2">
                <Label>Prazo de Quitação</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.prazoMaximoQuitacao
                        ? format((() => {
                          const [year, month, day] = form.prazoMaximoQuitacao.split('-').map(Number);
                          return new Date(year, month - 1, day);
                        })(), "dd/MM/yyyy", { locale: ptBR })
                        : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <UICalendar
                      mode="single"
                      selected={form.prazoMaximoQuitacao ? (() => {
                        const [year, month, day] = form.prazoMaximoQuitacao.split('-').map(Number);
                        return new Date(year, month - 1, day);
                      })() : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, "0");
                          const day = String(date.getDate()).padStart(2, "0");
                          updateField("prazoMaximoQuitacao", `${year}-${month}-${day}`);
                        }
                      }}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card: Dados do Pagador */}
        <Card>
          <CardHeader>
            <CardTitle>Dados do Pagador</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Selecionar Cliente</Label>
              <Select value={form.selectedClienteId} onValueChange={handleClienteSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um cliente cadastrado..." />
                </SelectTrigger>
                <SelectContent>
                  {clientesAtivos.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.selectedClienteId && (
              <div className="space-y-2 relative" ref={aircraftContainerRef}>
                <Label>Aeronave {isLoadingAircrafts && "(carregando...)"}</Label>
                <Input
                  placeholder={isLoadingAircrafts ? "Carregando aeronaves..." : "Digite ou selecione uma aeronave..."}
                  value={form.selectedAircraftId}
                  onChange={(e) => handleAircraftChange(e.target.value)}
                  onFocus={() => {
                    if (aircrafts.length > 0 && form.selectedAircraftId.length > 0) {
                      setShowAircraftSuggestions(true);
                    }
                  }}
                  disabled={isLoadingAircrafts}
                />
                {showAircraftSuggestions && aircraftSuggestions.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
                    <div className="max-h-64 overflow-auto p-2 space-y-1">
                      {aircraftSuggestions.map((aircraft) => (
                        <button
                          key={aircraft.id}
                          type="button"
                          className="w-full text-left px-3 py-2 rounded hover:bg-accent hover:text-accent-foreground"
                          onClick={() => applyAircraftSuggestion(aircraft)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{aircraft.registration}</div>
                              {aircraft.model && (
                                <div className="text-xs text-muted-foreground">{aircraft.model}</div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2 relative" ref={containerRef}>
              <Label>Nome/Razão Social *</Label>
              <Input
                placeholder="Nome completo ou razão social"
                value={form.pagadorNome}
                onChange={(e) => handlePayerNameChange(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
                  <div className="max-h-64 overflow-auto p-2 space-y-1">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full text-left px-3 py-2 rounded hover:bg-accent hover:text-accent-foreground"
                        onClick={() => applySuggestion(s)}
                      >
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <div>
                            <div className="font-medium text-sm">{s.name}</div>
                            <div className="text-xs text-muted-foreground">{s.document}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>CPF/CNPJ *</Label>
              <Input
                placeholder="000.000.000-00"
                value={form.pagadorDocumento}
                onChange={(e) => updateField("pagadorDocumento", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                placeholder="Endereço completo"
                value={form.pagadorEndereco}
                onChange={(e) => updateField("pagadorEndereco", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  placeholder="Cidade"
                  value={form.pagadorCidade}
                  onChange={(e) => updateField("pagadorCidade", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Input
                  placeholder="SP"
                  maxLength={2}
                  value={form.pagadorUF}
                  onChange={(e) => updateField("pagadorUF", e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                id="add-favorito"
                checked={form.addAsFavorite}
                onCheckedChange={(v) => updateField("addAsFavorite", Boolean(v))}
              />
              <Label htmlFor="add-favorito" className="cursor-pointer font-normal">
                Adicionar como favorito
              </Label>
            </div>

            <Button className="w-full mt-4" onClick={handleSubmit} disabled={isGenerating || !isValid}>
              <Receipt className="h-4 w-4 mr-2" />
              {isGenerating ? "Gerando..." : "Gerar Recibo"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
