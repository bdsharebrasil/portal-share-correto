import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Plus, Trash2, Edit, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Departamento {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string | null;
  departamento_pai_id: string | null;
  criado_em: string | null;
}

const departamentoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  descricao: z.string().optional(),
  cor: z.string().optional(),
  departamento_pai_id: z.string().optional().nullable(),
});

type DepartamentoFormData = z.infer<typeof departamentoSchema>;

interface EstruturaDepartamentosTabProps {
  triggerOnly?: boolean;
}

const cores = [
  { nome: "Azul", valor: "#3b82f6" },
  { nome: "Verde", valor: "#10b981" },
  { nome: "Vermelho", valor: "#ef4444" },
  { nome: "Roxo", valor: "#8b5cf6" },
  { nome: "Laranja", valor: "#f97316" },
  { nome: "Rosa", valor: "#ec4899" },
];

export function EstruturaDepartamentosTab({ triggerOnly = false }: EstruturaDepartamentosTabProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<DepartamentoFormData>({
    resolver: zodResolver(departamentoSchema),
    defaultValues: {
      nome: "",
      descricao: "",
      cor: "#3b82f6",
      departamento_pai_id: "",
    },
  });

  // Fetch departamentos
  const { data: departamentos = [] } = useQuery({
    queryKey: ["departamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departamentos")
        .select("*")
        .order("nome");

      if (error) throw error;
      return data as Departamento[];
    },
  });

  // Create/Update departamento
  const saveMutation = useMutation({
    mutationFn: async (formData: DepartamentoFormData) => {
      if (!user) throw new Error("Não autenticado");

      if (editingId) {
        const { error } = await supabase
          .from("departamentos")
          .update(formData)
          .eq("id", editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("departamentos")
          .insert({
            nome: formData.nome,
            descricao: formData.descricao,
            cor: formData.cor,
            departamento_pai_id: formData.departamento_pai_id,
            criado_por: user.id,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departamentos"] });
      toast({
        title: "Sucesso",
        description: editingId
          ? "Departamento atualizado com sucesso"
          : "Departamento criado com sucesso",
      });
      form.reset();
      setOpen(false);
      setEditingId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete departamento
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("departamentos")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departamentos"] });
      toast({
        title: "Sucesso",
        description: "Departamento deletado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (depto: Departamento) => {
    setEditingId(depto.id);
    form.reset({
      nome: depto.nome,
      descricao: depto.descricao || "",
      cor: depto.cor || "#3b82f6",
      departamento_pai_id: depto.departamento_pai_id || "",
    });
    setOpen(true);
  };

  const handleNew = () => {
    setEditingId(null);
    form.reset({
      nome: "",
      descricao: "",
      cor: "#3b82f6",
      departamento_pai_id: "",
    });
    setOpen(true);
  };

  const onSubmit = (data: DepartamentoFormData) => {
    const formData = {
      ...data,
      departamento_pai_id: data.departamento_pai_id === "" ? null : data.departamento_pai_id,
      cor: data.cor || "#3b82f6",
    };
    saveMutation.mutate(formData);
  };

  // Agrupar departamentos por hierarquia
  const deptosPrincipais = departamentos.filter((d) => !d.departamento_pai_id);
  const getSubdepartamentos = (parentId: string) =>
    departamentos.filter((d) => d.departamento_pai_id === parentId);

  // Se é apenas para mostrar o trigger (botão), retorna apenas isso
  if (triggerOnly) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button onClick={handleNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Departamento
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Departamento" : "Criar Departamento"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Financeiro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Descrição do departamento (opcional)"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="departamento_pai_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departamento Pai (opcional)</FormLabel>
                    <Select
                      value={field.value && field.value !== "" ? field.value : "none"}
                      onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Nenhum (departamento principal)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhum (departamento principal)</SelectItem>
                        {deptosPrincipais.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cor"
                render={({ field }) => {
                  const corSelecionada = cores.find(c => c.valor === field.value);
                  return (
                    <FormItem>
                      <FormLabel>Cor</FormLabel>
                      <Select value={field.value || "#3b82f6"} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue>
                              {corSelecionada && (
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded"
                                    style={{ backgroundColor: corSelecionada.valor }}
                                  />
                                  {corSelecionada.nome}
                                </div>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {cores.map((cor) => (
                            <SelectItem key={cor.valor} value={cor.valor}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded"
                                  style={{ backgroundColor: cor.valor }}
                                />
                                {cor.nome}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  }


  return (
    <div className="space-y-6">
      {/* Header com Empresa */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Estrutura da Empresa</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os departamentos e suas ramificações
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Departamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Departamento" : "Criar Departamento"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Financeiro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Descrição do departamento (opcional)"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="departamento_pai_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Departamento Pai (opcional)</FormLabel>
                      <Select
                        value={field.value && field.value !== "" ? field.value : "none"}
                        onValueChange={(val) => field.onChange(val === "none" ? "" : val)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Nenhum (departamento principal)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Nenhum (departamento principal)</SelectItem>
                          {deptosPrincipais.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cor"
                  render={({ field }) => {
                    const corSelecionada = cores.find(c => c.valor === field.value);
                    return (
                      <FormItem>
                        <FormLabel>Cor</FormLabel>
                        <Select value={field.value || "#3b82f6"} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue>
                                {corSelecionada && (
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded"
                                      style={{ backgroundColor: corSelecionada.valor }}
                                    />
                                    {corSelecionada.nome}
                                  </div>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {cores.map((cor) => (
                              <SelectItem key={cor.valor} value={cor.valor}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-4 h-4 rounded"
                                    style={{ backgroundColor: cor.valor }}
                                  />
                                  {cor.nome}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Departamentos Grid */}
      {departamentos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum departamento cadastrado</p>
            <p className="text-sm mt-2">Clique em "Novo Departamento" para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {deptosPrincipais.map((depto) => {
            const subdeptos = getSubdepartamentos(depto.id);
            return (
              <Card
                key={depto.id}
                className="overflow-hidden hover:shadow-lg transition-shadow"
              >
                <CardHeader className="pb-3" style={{ borderTopColor: depto.cor || "#3b82f6", borderTopWidth: 4 }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{depto.nome}</CardTitle>
                      {depto.descricao && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {depto.descricao}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {subdeptos.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                        Ramificações ({subdeptos.length})
                      </p>
                      <div className="space-y-2">
                        {subdeptos.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm"
                          >
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1">{sub.nome}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Badge variant="secondary">{subdeptos.length} sub-depts</Badge>
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1"
                      onClick={() => handleEdit(depto)}
                    >
                      <Edit className="h-3 w-3" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 gap-1"
                      onClick={() => {
                        if (
                          confirm(
                            `Tem certeza que deseja deletar "${depto.nome}"? As ramificações serão mantidas.`
                          )
                        ) {
                          deleteMutation.mutate(depto.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                      Deletar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
