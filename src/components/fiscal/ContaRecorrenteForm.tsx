import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select as RegularSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Select as GroupedSelect, SelectContent as GroupedSelectContent, SelectItem as GroupedSelectItem, SelectLabel, SelectTrigger as GroupedSelectTrigger, SelectValue as GroupedSelectValue, SelectGroup } from "@/components/ui/grouped-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutocompleteInput, type AutocompleteOption } from "@/components/ui/autocomplete-input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategoriasFinanceiro } from "@/hooks/useCategoriasFinanceiro";
import { useGroupedCategories } from "@/hooks/useGroupedCategories";
import { format } from "date-fns";
import { X, Save } from "lucide-react";

interface ContaRecorrenteFormProps {
  conta?: any;
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

export function ContaRecorrenteForm({
  conta,
  onSuccess,
  onCancel
}: ContaRecorrenteFormProps) {
  const { user } = useAuth();
  const groupedCategories = useGroupedCategories("despesa");
  const [fornecedorProfiles, setFornecedorProfiles] = useState<any[]>([]);

  useEffect(() => {
    loadFornecedorProfiles();
  }, []);

  const loadFornecedorProfiles = async () => {
    try {
      // Buscar colaboradores (user_profiles)
      const { data: userProfiles, error: userError } = await supabase
        .from("user_profiles")
        .select("id, full_name, cpf, email")
        .order("full_name", { ascending: true });

      if (userError) {
        console.error("Erro ao carregar colaboradores:", userError);
      }

      // Buscar fornecedores favoritos
      const { data: fornecedoresFavoritos, error: fornecError } = await supabase
        .from("fornecedores_favoritos")
        .select("id, nome_completo, documento, categoria, apelido")
        .order("nome_completo", { ascending: true });

      if (fornecError) {
        console.error("Erro ao carregar fornecedores favoritos:", fornecError);
      }

      // Combinar dados: colaboradores + fornecedores favoritos
      const combinedData = [
        ...(userProfiles || []).map(profile => ({
          id: profile.id,
          full_name: profile.full_name,
          cpf: profile.cpf,
          email: profile.email,
          type: "colaborador"
        })),
        ...(fornecedoresFavoritos || []).map(fornecedor => ({
          id: fornecedor.id,
          full_name: fornecedor.nome_completo,
          cpf: fornecedor.documento,
          email: null,
          type: "fornecedor",
          categoria: fornecedor.categoria,
          apelido: fornecedor.apelido
        }))
      ];

      setFornecedorProfiles(combinedData);
    } catch (error: any) {
      console.error("Erro ao carregar fornecedores:", error.message);
    }
  };

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      data_agendamento: format(new Date(), "yyyy-MM-dd"),
      descricao: "",
      fornecedor: "",
      valor: "",
      categoria: "",
      status: "agendado",
      eh_recorrente: true,
      frequencia_recorrencia: "mensal",
      dia_recorrencia: "1",
      lembrete_antecipado: true,
      notas: ""
    }
  });

  const lembreteAntecipado = watch("lembrete_antecipado");

  useEffect(() => {
    if (conta) {
      setValue("data_agendamento", conta.data_agendamento);
      setValue("descricao", conta.descricao);
      setValue("fornecedor", conta.fornecedor);
      setValue("valor", conta.valor.toString());
      setValue("categoria", conta.categoria || "");
      setValue("status", conta.status);
      setValue("frequencia_recorrencia", conta.frequencia_recorrencia || "mensal");
      setValue("dia_recorrencia", conta.dia_recorrencia?.toString() || "1");
      setValue("lembrete_antecipado", conta.lembrete_antecipado || false);
      setValue("notas", conta.notas || "");
    } else {
      reset();
      setValue("data_agendamento", format(new Date(), "yyyy-MM-dd"));
      setValue("eh_recorrente", true);
      setValue("status", "agendado");
      setValue("frequencia_recorrencia", "mensal");
      setValue("dia_recorrencia", "1");
      setValue("lembrete_antecipado", true);
    }
  }, [conta, setValue, reset]);

  const onSubmit = async (formData: any) => {
    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }

    try {
      let valor = null;
      if (formData.valor) {
        valor = parseFloat(formData.valor);
        if (isNaN(valor) || valor < 0) {
          toast.error("Valor deve ser um número válido e maior ou igual a zero");
          return;
        }
      }

      const data = {
        descricao: formData.descricao,
        fornecedor: formData.fornecedor,
        valor: valor !== null ? valor : null,
        categoria: formData.categoria || null,
        status: formData.status,
        frequencia_recorrencia: formData.frequencia_recorrencia,
        dia_recorrencia: formData.dia_recorrencia ? parseInt(formData.dia_recorrencia) : null,
        lembrete_antecipado: formData.lembrete_antecipado || false,
        notas: formData.notas || null,
        atualizado_por: user.id,
      };

      if (conta?.id) {
        const { error } = await supabase
          .from("contas_recorrentes")
          .update(data as any)
          .eq("id", conta.id);

        if (error) {
          toast.error(`Erro ao atualizar: ${error.message}`);
          return;
        }
        toast.success("Conta recorrente atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("contas_recorrentes")
          .insert({
            ...data,
            criado_por: user.id
          } as any);

        if (error) {
          toast.error(`Erro ao criar: ${error.message}`);
          return;
        }
        toast.success("Conta recorrente criada com sucesso!");
      }

      reset();
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar conta recorrente");
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-foreground">
          {conta ? "Editar Conta Recorrente" : "Nova Conta Recorrente"}
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="descricao">Descrição da Conta *</Label>
              <Input
                id="descricao"
                placeholder="Ex: Internet, Aluguel, Seguro"
                {...register("descricao", { required: "Descrição é obrigatória" })}
                className={errors.descricao ? "border-destructive" : ""}
              />
              {errors.descricao && <span className="text-xs text-destructive">{errors.descricao.message}</span>}
            </div>

            <div>
              <Label htmlFor="fornecedor">Fornecedor/Beneficiário *</Label>
              <AutocompleteInput
                value={watch("fornecedor") || ""}
                onChange={(value) => {
                  setValue("fornecedor", value);
                }}
                onSelect={(option) => {
                  const fornecedor = fornecedorProfiles.find(f => f.id === option.id);
                  if (fornecedor) {
                    setValue("fornecedor", fornecedor.full_name);
                  }
                }}
                options={fornecedorProfiles.map(f => {
                  // Adicionar apelido ou tipo na label para diferenciar
                  let label = f.full_name;
                  if (f.type === "fornecedor" && f.apelido) {
                    label = `${f.full_name} (${f.apelido})`;
                  } else if (f.type === "colaborador") {
                    label = `${f.full_name} (Colaborador)`;
                  }
                  return {
                    id: f.id,
                    label
                  };
                })}
                placeholder="Buscar ou digite um fornecedor"
              />
              {errors.fornecedor && <span className="text-xs text-destructive">{errors.fornecedor.message}</span>}
            </div>

            <div>
              <Label htmlFor="valor">Valor <span className="text-xs text-muted-foreground"></span></Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                placeholder="R$"
                {...register("valor")}
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
                  <SelectItem value="agendado">Ativo</SelectItem>
                  <SelectItem value="cancelado">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Seção de Recorrência */}
          <div className="space-y-4 border-t border-border pt-4">
            <h3 className="font-semibold text-foreground">Configuração de Recorrência</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-border">
              <div>
                <Label htmlFor="frequencia_recorrencia">Frequência de Pagamento *</Label>
                <Select onValueChange={(value) => setValue("frequencia_recorrencia", value)}>
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
                <Label htmlFor="dia_recorrencia">Dia do Mês para Vencimento *</Label>
                <Select onValueChange={(value) => setValue("dia_recorrencia", value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
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
                  Esta conta vence todo dia <strong>{watch("dia_recorrencia") || "?"}</strong> do mês
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
                    Deseja receber lembretes antecipados sobre essa conta?
                  </Label>
                </div>
                {lembreteAntecipado && (
                  <p className="text-sm text-muted-foreground ml-6 p-2 bg-primary/10 rounded border border-primary/20">
                    🔔 Você receberá notificações <strong>3 dias antes</strong>, <strong>2 dias antes</strong> e <strong>1 dia antes</strong> do vencimento.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="notas">Notas e Observações</Label>
            <Textarea
              id="notas"
              placeholder="Adicione observações sobre essa conta recorrente (opcional)"
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
              {isSubmitting ? "Salvando..." : "Salvar Conta Recorrente"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
