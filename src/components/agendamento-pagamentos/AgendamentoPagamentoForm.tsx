import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategoriasFinanceiro } from "@/hooks/useCategoriasFinanceiro";
import { format } from "date-fns";
import { X, Save } from "lucide-react";
import { syncAgendamentoPagamentoToControle, removeAgendamentoPagamentoFromControle } from "@/services/syncSalariesToBankingControl";

interface AgendamentoPagamentoFormProps {
  agendamento?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const frequencias = [
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "anual", label: "Anual" }
];

const diasDoMes = Array.from({ length: 31 }, (_, i) => i + 1);

export function AgendamentoPagamentoForm({
  agendamento,
  onSuccess,
  onCancel
}: AgendamentoPagamentoFormProps) {
  const { user } = useAuth();
  const { categorias: allCategorias } = useCategoriasFinanceiro();
  const categoriaNomes = allCategorias.map(c => c.nome);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      data_agendamento: format(new Date(), "yyyy-MM-dd"),
      descricao: "",
      fornecedor: "",
      valor: "",
      categoria: "",
      status: "agendado",
      eh_recorrente: false,
      frequencia_recorrencia: "mensal",
      dia_recorrencia: "",
      lembrete_antecipado: false,
      criar_conta_a_pagar_automatica: false,
      notas: ""
    }
  });

  const ehRecorrente = watch("eh_recorrente");
  const lembreteAntecipado = watch("lembrete_antecipado");

  useEffect(() => {
    if (agendamento) {
      setValue("data_agendamento", agendamento.data_agendamento);
      setValue("descricao", agendamento.descricao);
      setValue("fornecedor", agendamento.fornecedor);
      setValue("valor", agendamento.valor.toString());
      setValue("categoria", agendamento.categoria || "");
      setValue("status", agendamento.status);
      setValue("eh_recorrente", agendamento.eh_recorrente || false);
      setValue("frequencia_recorrencia", agendamento.frequencia_recorrencia || "mensal");
      setValue("dia_recorrencia", agendamento.dia_recorrencia?.toString() || "");
      setValue("lembrete_antecipado", agendamento.lembrete_antecipado || false);
      setValue("criar_conta_a_pagar_automatica", agendamento.criar_conta_a_pagar_automatica || false);
      setValue("notas", agendamento.notas || "");
    } else {
      reset();
      setValue("data_agendamento", format(new Date(), "yyyy-MM-dd"));
      setValue("status", "agendado");
    }
  }, [agendamento, setValue, reset]);

  const onSubmit = async (formData: any) => {
    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }

    try {
      const valor = parseFloat(formData.valor);
      if (isNaN(valor) || valor <= 0) {
        toast.error("Valor deve ser maior que zero");
        return;
      }

      const data = {
        data_agendamento: formData.data_agendamento,
        descricao: formData.descricao,
        fornecedor: formData.fornecedor,
        valor,
        categoria: formData.categoria || null,
        status: formData.status,
        eh_recorrente: formData.eh_recorrente || false,
        frequencia_recorrencia: formData.eh_recorrente ? formData.frequencia_recorrencia : null,
        dia_recorrencia: formData.eh_recorrente && formData.dia_recorrencia ? parseInt(formData.dia_recorrencia) : null,
        lembrete_antecipado: formData.lembrete_antecipado || false,
        criar_conta_a_pagar_automatica: formData.criar_conta_a_pagar_automatica || false,
        notas: formData.notas || null,
        atualizado_por: user.id,
      };

      if (agendamento?.id) {
        // Se o status está sendo alterado para 'pago', sincroniza com controle bancário
        if (formData.status === 'pago' && agendamento.status !== 'pago') {
          const agendamentoAtualizado = { ...agendamento, ...data };
          await syncAgendamentoPagamentoToControle(agendamentoAtualizado, user?.id);
        }
        // Se o status está sendo alterado de 'pago' para 'cancelado', remove do controle
        else if (formData.status === 'cancelado' && agendamento.status === 'pago') {
          await removeAgendamentoPagamentoFromControle(agendamento.id);
        }

        const { error } = await supabase
          .from("agendamento_pagamentos")
          .update(data as any)
          .eq("id", agendamento.id);

        if (error) {
          toast.error(`Erro ao atualizar: ${error.message}`);
          return;
        }
        toast.success("Agendamento atualizado com sucesso!");
      } else {
        const { data: insertedData, error } = await supabase
          .from("agendamento_pagamentos")
          .insert({
            ...data,
            criado_por: user.id
          } as any)
          .select();

        if (error) {
          toast.error(`Erro ao criar: ${error.message}`);
          return;
        }

        // Se o novo agendamento é criado já como 'pago', sincroniza imediatamente
        if (formData.status === 'pago' && insertedData && insertedData.length > 0) {
          await syncAgendamentoPagamentoToControle({
            ...insertedData[0],
            valor: parseFloat(String(insertedData[0].valor))
          }, user?.id);
        }

        toast.success("Agendamento criado com sucesso!");
      }

      reset();
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar agendamento");
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-foreground">
          {agendamento ? "Editar Agendamento" : "Novo Agendamento de Pagamento"}
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="data_agendamento">Data de Agendamento *</Label>
              <Input
                id="data_agendamento"
                type="date"
                {...register("data_agendamento", { required: "Data é obrigatória" })}
                className={errors.data_agendamento ? "border-destructive" : ""}
              />
              {errors.data_agendamento && <span className="text-xs text-destructive">{errors.data_agendamento.message}</span>}
            </div>

            <div>
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                placeholder="Descreva o pagamento"
                {...register("descricao", { required: "Descrição é obrigatória" })}
                className={errors.descricao ? "border-destructive" : ""}
              />
              {errors.descricao && <span className="text-xs text-destructive">{errors.descricao.message}</span>}
            </div>

            <div>
              <Label htmlFor="fornecedor">Fornecedor *</Label>
              <Input
                id="fornecedor"
                placeholder="Nome do fornecedor"
                {...register("fornecedor", { required: "Fornecedor é obrigatório" })}
                className={errors.fornecedor ? "border-destructive" : ""}
              />
              {errors.fornecedor && <span className="text-xs text-destructive">{errors.fornecedor.message}</span>}
            </div>

            <div>
              <Label htmlFor="valor">Valor *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register("valor", { required: "Valor é obrigatório" })}
                className={errors.valor ? "border-destructive" : ""}
              />
              {errors.valor && <span className="text-xs text-destructive">{errors.valor.message}</span>}
            </div>

            <div>
              <Label htmlFor="categoria">Categoria</Label>
              <Select defaultValue="" onValueChange={(value) => setValue("categoria", value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] w-full">
                  {categoriaNomes.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                  {categoriaNomes.length === 0 && (
                    <div className="text-center py-3 text-muted-foreground text-sm">
                      Nenhuma categoria disponível
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select defaultValue="agendado" onValueChange={(value) => setValue("status", value)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="w-full">
                  <SelectItem value="agendado">Agendado</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Seção de Recorrência */}
          <div className="space-y-4 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="eh_recorrente"
                checked={ehRecorrente}
                onCheckedChange={(checked) => setValue("eh_recorrente", checked as boolean)}
              />
              <Label htmlFor="eh_recorrente" className="cursor-pointer font-medium">
                É um pagamento recorrente?
              </Label>
            </div>

            {ehRecorrente && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6 p-4 bg-muted/30 rounded-lg border border-border">
                <div>
                  <Label htmlFor="frequencia_recorrencia">Frequência</Label>
                  <Select defaultValue="mensal" onValueChange={(value) => setValue("frequencia_recorrencia", value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="w-full">
                      {frequencias.map((freq) => (
                        <SelectItem key={freq.value} value={freq.value}>
                          {freq.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="dia_recorrencia">Dia do Mês para Vencimento</Label>
                  <Select onValueChange={(value) => setValue("dia_recorrencia", value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o dia" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] w-full">
                      {diasDoMes.map((dia) => (
                        <SelectItem key={dia} value={dia.toString()}>
                          Dia {dia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Todo dia {watch("dia_recorrencia") || "X"} do mês esta conta vence
                  </p>
                </div>

                <div className="md:col-span-2 space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="lembrete_antecipado"
                      checked={lembreteAntecipado}
                      onCheckedChange={(checked) => setValue("lembrete_antecipado", checked as boolean)}
                    />
                    <Label htmlFor="lembrete_antecipado" className="cursor-pointer">
                      Deseja ser lembrado antecipadamente desse pagamento?
                    </Label>
                  </div>
                  {lembreteAntecipado && (
                    <p className="text-sm text-muted-foreground ml-6 p-2 bg-primary/10 rounded border border-primary/20">
                      📌 Você receberá notificações: <strong>3 dias antes</strong>, <strong>2 dias antes</strong> e <strong>1 dia antes</strong> do vencimento.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="criar_conta_a_pagar_automatica"
                {...register("criar_conta_a_pagar_automatica")}
              />
              <Label htmlFor="criar_conta_a_pagar_automatica" className="cursor-pointer">
                Criar conta a pagar automaticamente quando marcar como pago?
              </Label>
            </div>
          </div>

          <div>
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              placeholder="Adicione notas ou observações"
              rows={2}
              {...register("notas")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
