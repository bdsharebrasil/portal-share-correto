import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Trash2, Plus, Users, Calculator, Percent, DollarSign, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Socio {
  id?: string;
  cliente_id: string;
  cliente_nome: string;
  percentual: number;
  valor_rateado: number;
  horas_voadas?: number;
}

interface RateioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  valorTotal: number;
  aeronaveRegistro: string;
  aeronaveId?: string;
  lancamentoId?: string;
  tipoRateio?: "propriedade" | "uso" | "misto" | "horas" | "percentual" | "valor";
  periodo?: { inicio: string; fim: string };
  onSave: (rateios: Socio[], tipoRateio: string) => void;
}

export function RateioDialog({
  open,
  onOpenChange,
  valorTotal,
  aeronaveRegistro,
  aeronaveId,
  lancamentoId,
  tipoRateio = "propriedade",
  periodo,
  onSave,
}: RateioDialogProps) {
  const [tipoRateoLocal, setTipoRateio] = useState<"horas" | "percentual" | "valor">(
    tipoRateio === "uso" ? "horas" : "percentual"
  );
  const [socios, setSocios] = useState<Socio[]>([]);
  const [sociosDisponiveis, setSociosDisponiveis] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Carrega sócios da aeronave
  useEffect(() => {
    if (open && aeronaveRegistro) {
      loadSocios();
    }
  }, [open, aeronaveRegistro]);

  const loadSocios = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("aeronaves_socios")
        .select("*")
        .eq("aeronave_registro", aeronaveRegistro)
        .eq("ativo", true);

      if (error) throw error;

      if (data && data.length > 0) {
        setSociosDisponiveis(data);

        // Inicializa os sócios com os dados carregados
        let sociosIniciais: Socio[] = data.map((s) => ({
          cliente_id: s.cliente_id || "",
          cliente_nome: s.cliente_nome,
          percentual: s.percentual_participacao || 50,
          valor_rateado: (valorTotal * (s.percentual_participacao || 50)) / 100,
          horas_voadas: 0,
        }));

        // Se tipoRateio === 'uso', buscar horas_voadas do lancamentos_diario_bordo
        if (tipoRateio === "uso" && aeronaveId && periodo) {
          sociosIniciais = await Promise.all(
            sociosIniciais.map(async (socio) => {
              try {
                const { data: logbookData, error: logErr } = await (supabase as any)
                  .from("lancamentos_diario_bordo")
                  .select("tempo_total, is_loan, loan_recipient_client_id")
                  .eq("aeronave_id", aeronaveId)
                  .eq("clientes_id", socio.cliente_id)
                  .gte("data_registro", periodo.inicio)
                  .lte("data_registro", periodo.fim);

                if (logErr) throw logErr;

                const totalHoras = logbookData?.reduce((sum: number, entry: any) => {
                  // Se is_loan=true, este voo não conta para este cliente
                  return entry.is_loan ? sum : sum + (entry.tempo_total || 0);
                }, 0) || 0;

                return { ...socio, horas_voadas: Math.round(totalHoras * 100) / 100 };
              } catch (err) {
                console.error("Erro ao buscar horas voadas:", err);
                return socio;
              }
            })
          );
        }

        setSocios(sociosIniciais);
      } else {
        setSociosDisponiveis([]);
        setSocios([
          { cliente_id: "", cliente_nome: "", percentual: 50, valor_rateado: valorTotal / 2, horas_voadas: 0 },
          { cliente_id: "", cliente_nome: "", percentual: 50, valor_rateado: valorTotal / 2, horas_voadas: 0 },
        ]);
      }
    } catch (error) {
      console.error("Erro ao carregar sócios:", error);
    }
  };

  // Recalcula os valores quando muda o tipo de rateio ou horas
  useEffect(() => {
    if (tipoRateoLocal === "horas") {
      recalcularPorHoras();
    } else if (tipoRateoLocal === "percentual") {
      recalcularPorPercentual();
    }
  }, [tipoRateoLocal, valorTotal]);

  const recalcularPorHoras = () => {
    const totalHoras = socios.reduce((acc, s) => acc + (s.horas_voadas || 0), 0);
    if (totalHoras === 0) return;

    const novos = socios.map((s) => ({
      ...s,
      percentual: ((s.horas_voadas || 0) / totalHoras) * 100,
      valor_rateado: (valorTotal * (s.horas_voadas || 0)) / totalHoras,
    }));
    setSocios(novos);
  };

  const recalcularPorPercentual = () => {
    const novos = socios.map((s) => ({
      ...s,
      valor_rateado: (valorTotal * s.percentual) / 100,
    }));
    setSocios(novos);
  };

  const handleHorasChange = (index: number, horas: number) => {
    const novos = [...socios];
    novos[index].horas_voadas = horas;
    
    const totalHoras = novos.reduce((acc, s) => acc + (s.horas_voadas || 0), 0);
    if (totalHoras > 0) {
      novos.forEach((s) => {
        s.percentual = ((s.horas_voadas || 0) / totalHoras) * 100;
        s.valor_rateado = (valorTotal * (s.horas_voadas || 0)) / totalHoras;
      });
    }
    
    setSocios(novos);
  };

  const handlePercentualChange = (index: number, percentual: number) => {
    const novos = [...socios];
    novos[index].percentual = percentual;
    novos[index].valor_rateado = (valorTotal * percentual) / 100;
    setSocios(novos);
  };

  const handleValorChange = (index: number, valor: number) => {
    const novos = [...socios];
    novos[index].valor_rateado = valor;
    novos[index].percentual = (valor / valorTotal) * 100;
    setSocios(novos);
  };

  const handleNomeChange = (index: number, nome: string) => {
    const novos = [...socios];
    novos[index].cliente_nome = nome;
    setSocios(novos);
  };

  const adicionarSocio = () => {
    const percentualRestante = 100 - totalPercentual;
    setSocios([
      ...socios,
      {
        cliente_id: "",
        cliente_nome: "",
        percentual: Math.max(0, percentualRestante),
        valor_rateado: Math.max(0, (valorTotal * percentualRestante) / 100),
        horas_voadas: 0,
      },
    ]);
  };

  const removerSocio = (index: number) => {
    if (socios.length <= 2) {
      toast.error("Mínimo de 2 sócios para rateio");
      return;
    }
    const novos = socios.filter((_, i) => i !== index);
    setSocios(novos);
  };

  const totalPercentual = useMemo(() => {
    return socios.reduce((acc, s) => acc + s.percentual, 0);
  }, [socios]);

  const totalRateado = useMemo(() => {
    return socios.reduce((acc, s) => acc + s.valor_rateado, 0);
  }, [socios]);

  const isValid = useMemo(() => {
    const percentualValido = Math.abs(totalPercentual - 100) < 0.01;
    const valorValido = Math.abs(totalRateado - valorTotal) < 0.01;
    const todosComNome = socios.every((s) => s.cliente_nome.trim() !== "");
    return percentualValido && valorValido && todosComNome && socios.length >= 2;
  }, [totalPercentual, totalRateado, valorTotal, socios]);

  const handleSave = async () => {
    if (!isValid) {
      toast.error("Verifique os dados do rateio");
      return;
    }

    setIsLoading(true);
    try {
      onSave(socios, tipoRateio);
      onOpenChange(false);
      toast.success("Rateio configurado com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar rateio");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span>Rateio entre Sócios</span>
              {aeronaveRegistro && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {aeronaveRegistro}
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Valor Total */}
          <Card className="p-4 bg-muted/30 border-border/50">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Valor Total</span>
              <span className="text-2xl font-bold text-foreground">
                R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </Card>

          {/* Tipo de Rateio */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Tipo de Rateio</Label>
            <RadioGroup
              value={tipoRateio}
              onValueChange={(v) => setTipoRateio(v as "horas" | "percentual" | "valor")}
              className="flex flex-wrap gap-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="horas" id="horas" />
                <Label htmlFor="horas" className="flex items-center gap-2 cursor-pointer">
                  <Clock className="h-4 w-4 text-blue-400" />
                  Por horas de voo
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="percentual" id="percentual" />
                <Label htmlFor="percentual" className="flex items-center gap-2 cursor-pointer">
                  <Percent className="h-4 w-4 text-green-400" />
                  Por percentual fixo
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="valor" id="valor" />
                <Label htmlFor="valor" className="flex items-center gap-2 cursor-pointer">
                  <DollarSign className="h-4 w-4 text-yellow-400" />
                  Valor específico
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Lista de Sócios */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-semibold">Sócios</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={adicionarSocio}
                className="h-8 text-xs gap-1"
              >
                <Plus className="h-3 w-3" />
                Adicionar
              </Button>
            </div>

            <div className="space-y-3">
              {socios.map((socio, index) => (
                <Card key={index} className="p-4 bg-background/50 border-border/50">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="md:col-span-2">
                        <Label className="text-xs text-muted-foreground">Nome</Label>
                        <Input
                          value={socio.cliente_nome}
                          onChange={(e) => handleNomeChange(index, e.target.value)}
                          placeholder="Nome do sócio"
                          className="h-9 mt-1 bg-background"
                        />
                      </div>

                      {tipoRateio === "horas" && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Horas</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={socio.horas_voadas || ""}
                            onChange={(e) => handleHorasChange(index, parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="h-9 mt-1 bg-background"
                          />
                        </div>
                      )}

                      {tipoRateio === "percentual" && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Percentual</Label>
                          <div className="relative">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={socio.percentual || ""}
                              onChange={(e) => handlePercentualChange(index, parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className="h-9 mt-1 bg-background pr-8"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm mt-0.5">
                              %
                            </span>
                          </div>
                        </div>
                      )}

                      {tipoRateio === "valor" && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Valor</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={socio.valor_rateado || ""}
                            onChange={(e) => handleValorChange(index, parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="h-9 mt-1 bg-background"
                          />
                        </div>
                      )}

                      <div>
                        <Label className="text-xs text-muted-foreground">Resultado</Label>
                        <div className="h-9 mt-1 flex items-center gap-2">
                          <Badge variant="secondary" className="text-sm">
                            {socio.percentual.toFixed(1)}%
                          </Badge>
                          <span className="text-sm font-semibold text-primary">
                            R$ {socio.valor_rateado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removerSocio(index)}
                      className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Resumo */}
          <Card className={cn(
            "p-4 border-2",
            isValid ? "bg-green-950/20 border-green-600/50" : "bg-red-950/20 border-red-600/50"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isValid ? (
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-400" />
                )}
                <span className="text-sm font-medium">Total Rateado</span>
              </div>
              <div className="text-right">
                <div className={cn(
                  "text-lg font-bold",
                  isValid ? "text-green-400" : "text-red-400"
                )}>
                  R$ {totalRateado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {totalPercentual.toFixed(1)}% do total
                </div>
              </div>
            </div>
          </Card>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid || isLoading}
            className="bg-primary hover:bg-primary/90"
          >
            {isLoading ? "Salvando..." : "Salvar Rateio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
