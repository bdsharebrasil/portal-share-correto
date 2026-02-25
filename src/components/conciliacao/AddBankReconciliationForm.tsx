import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, Loader2, X, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { syncBankReconciliationToFinancial } from "@/services/financialSyncClient";

interface Client {
  id: string;
  company_name: string;
}

interface Aircraft {
  id: string;
  registration: string;
}

interface UserProfile {
  id: string;
  full_name: string;
}

const schema = z.object({
  type: z.enum(["cliente", "colaborador"], {
    errorMap: () => ({ message: "Selecione um tipo válido" }),
  }),
  date: z.string().min(1, "Data é obrigatória"),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  status: z.enum(["pendente", "enviado", "recebido", "pago"], {
    errorMap: () => ({ message: "Selecione um status válido" }),
  }),
  clientId: z.string().optional(),
  aircraftId: z.string().optional(),
  category: z.string().optional(),
  receiverId: z.string().optional(),
  reembolsavel: z.enum(["sim", "nao"]).optional(),
  percentual: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.type === "cliente") {
    if (!data.clientId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clientId"],
        message: "Cliente é obrigatório para este tipo",
      });
    }
    if (!data.aircraftId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["aircraftId"],
        message: "Aeronave é obrigatória para este tipo",
      });
    }
    if (data.reembolsavel === "sim" && !data.category) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: "Categoria é obrigatória para despesa reembolsável",
      });
    }
    if (data.reembolsavel === "nao" && !data.percentual) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["percentual"],
        message: "Percentual é obrigatório para despesa não-reembolsável",
      });
    }
  }

  if (data.type === "colaborador") {
    if (!data.receiverId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["receiverId"],
        message: "Colaborador é obrigatório para este tipo",
      });
    }
  }
});

type FormValues = z.infer<typeof schema>;

interface AddBankReconciliationFormProps {
  onSuccess?: () => void;
  defaultOpen?: boolean;
}

export function AddBankReconciliationForm({
  onSuccess,
  defaultOpen = false,
}: AddBankReconciliationFormProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [categories, setCategories] = useState<{ id: string; nome: string }[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [boletoFile, setBoletoFile] = useState<File | null>(null);
  const [notaFile, setNotaFile] = useState<File | null>(null);
  const [uploadingBoleto, setUploadingBoleto] = useState(false);
  const [uploadingNota, setUploadingNota] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "cliente",
      status: "pendente",
      date: new Date().toLocaleDateString('en-CA'),
      description: "",
      amount: "",
      clientId: "",
      aircraftId: "",
      category: "",
      receiverId: "",
      reembolsavel: "sim",
      percentual: "",
    },
  });

  const watchType = form.watch("type");
  const watchReembolsavel = form.watch("reembolsavel");

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      setLoadingData(true);

      const [clientsResponse, aircraftResponse, usersResponse, categoriesResponse] = await Promise.all([
        supabase.from("clients").select("id, company_name").order("company_name"),
        supabase.from("aircraft").select("id, registration").order("registration"),
        supabase
          .from("user_profiles")
          .select("id, full_name, employment_status")
          .eq("employment_status", "ativo" as any)
          .order("full_name"),
        supabase
          .from("categorias_movimentacao")
          .select("id, nome")
          .eq("tipo", "despesa")
          .eq("reembolsavel", true)
          .eq("ativo", true)
          .order("nome"),
      ]);

      if (clientsResponse.error) throw clientsResponse.error;
      if (aircraftResponse.error) throw aircraftResponse.error;
      if (usersResponse.error) throw usersResponse.error;
      if (categoriesResponse.error) throw categoriesResponse.error;

      setClients((clientsResponse.data || []) as any);
      setAircraft((aircraftResponse.data || []) as any);
      setUsers((usersResponse.data || []) as any);
      setCategories((categoriesResponse.data || []) as any);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados necessários.",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const uploadFile = async (
    file: File,
    fieldName: string,
    setUploading: (val: boolean) => void
  ): Promise<string | null> => {
    if (!file) return null;

    try {
      setUploading(true);
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `reconciliation/${timestamp}-${fieldName}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error(`Erro ao fazer upload de ${fieldName}:`, error);
      toast({
        title: "Erro",
        description: `Falha ao enviar ${fieldName}`,
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      let boletoUrl: string | null = null;
      let notaUrl: string | null = null;

      // Upload de arquivos se for não-reembolsável
      if (data.type === "cliente" && data.reembolsavel === "nao") {
        if (boletoFile) {
          boletoUrl = await uploadFile(boletoFile, "boleto", setUploadingBoleto);
        }
        if (notaFile) {
          notaUrl = await uploadFile(notaFile, "nota-fiscal", setUploadingNota);
        }
      }

      const insertData: Record<string, any> = {
        type: data.type,
        date: data.date,
        description: data.description,
        amount: parseFloat(data.amount),
        status: data.status,
        criado_por: user.id,
        afeta_caixa_empresa: data.reembolsavel === "sim",
        forma_pagamento: data.reembolsavel === "sim" ? "empresa_paga" : "rateio_direto",
      };

      if (data.type === "cliente") {
        insertData.client_id = data.clientId || null;
        insertData.aircraft_id = data.aircraftId || null;

        if (data.reembolsavel === "sim") {
          insertData.category = data.category || null;
        } else {
          insertData.boleto_url = boletoUrl;
          insertData.nf_url = notaUrl;
          insertData.percentual = data.percentual || null;
        }
      } else if (data.type === "colaborador") {
        if (!data.receiverId) {
          throw new Error("Colaborador deve ser selecionado.");
        }

        const { data: receiverExists, error: checkError } = await supabase
          .from("user_profiles")
          .select("id, full_name, employment_status")
          .eq("id", data.receiverId as any)
          .eq("employment_status", "ativo" as any)
          .single();

        if (checkError || !receiverExists) {
          throw new Error(
            "Colaborador selecionado não existe, está inativo ou você não tem permissão para acessá-lo. Selecione um colaborador ativo da lista."
          );
        }

        insertData.receiver_id = data.receiverId;
      }

      const { data: inserted, error } = await (supabase as any)
        .from("bank_reconciliations")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error);
        if (error.message?.includes("user_profiles")) {
          throw new Error(
            "Colaborador selecionado não existe. Por favor, selecione um colaborador válido da lista."
          );
        }
        throw error;
      }

      // Se é tipo cliente não-reembolsável, criar rateio
      if (data.type === "cliente" && data.reembolsavel === "nao" && inserted && data.clientId) {
        try {
          const percentual = parseFloat(data.percentual || "0");
          const valorRateado = (parseFloat(data.amount) * percentual) / 100;

          await (supabase as any).from("rateio_despesas").insert({
            despesa_id: inserted.id,
            client_id: data.clientId,
            aeronave_id: data.aircraftId || null,
            percentual: percentual,
            valor_rateado: valorRateado,
            status: "pendente",
            boleto: boletoUrl,
            nota_fiscal: notaUrl,
          });
        } catch (rateioError) {
          console.error("Erro ao criar rateio:", rateioError);
          toast({
            title: "Aviso",
            description: "Reconciliação criada, mas houve erro ao criar o rateio.",
            variant: "default",
          });
        }
      }

      // Sincronizar automaticamente com controle_bancario e contas_areceber
      if (inserted?.id) {
        await syncBankReconciliationToFinancial(inserted.id, user.id);
      }

      toast({
        title: "Sucesso",
        description: "Reconciliação bancária adicionada com sucesso.",
      });

      form.reset();
      setBoletoFile(null);
      setNotaFile(null);
      setIsOpen(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Erro ao adicionar reconciliação:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível adicionar a reconciliação.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.reset();
    setBoletoFile(null);
    setNotaFile(null);
    setIsOpen(false);
  };

  return (
    <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors rounded-t-xl">
            <CardTitle className="flex items-center justify-between text-lg">
              <span className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Nova Reconciliação Bancária
              </span>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Type Selection */}
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Conciliação *</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cliente">Cliente</SelectItem>
                            <SelectItem value="colaborador">Colaborador</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Date */}
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className="rounded-lg" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Status */}
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status *</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="enviado">Enviado</SelectItem>
                            {watchType === "cliente" ? (
                              <SelectItem value="recebido">Recebido</SelectItem>
                            ) : (
                              <SelectItem value="pago">Pago</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Description */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Pagamento de fatura" {...field} className="rounded-lg" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Amount */}
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor (R$) *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                            className="rounded-lg"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Client-specific fields */}
                {watchType === "cliente" && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="clientId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cliente *</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={loadingData}
                            >
                              <FormControl>
                                <SelectTrigger className="rounded-lg">
                                  <SelectValue placeholder="Selecione um cliente" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {clients.map((client) => (
                                  <SelectItem key={client.id} value={client.id}>
                                    {client.company_name}
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
                        name="aircraftId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Aeronave *</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={loadingData}
                            >
                              <FormControl>
                                <SelectTrigger className="rounded-lg">
                                  <SelectValue placeholder="Selecione uma aeronave" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {aircraft.map((ac) => (
                                  <SelectItem key={ac.id} value={ac.id}>
                                    {ac.registration}
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
                        name="reembolsavel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Despesa *</FormLabel>
                            <Select value={field.value || "sim"} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="rounded-lg">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="sim">Reembolsável</SelectItem>
                                <SelectItem value="nao">Não Reembolsável (Rateio)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {watchReembolsavel === "sim" && (
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Categoria (Despesa Reembolsável) *</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={loadingData}
                            >
                              <FormControl>
                                <SelectTrigger className="rounded-lg">
                                  <SelectValue placeholder="Selecione uma categoria" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {categories.length > 0 ? (
                                  categories.map((category) => (
                                    <SelectItem key={category.id} value={category.nome}>
                                      {category.nome}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                    Nenhuma categoria reembolsável disponível
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {watchReembolsavel === "nao" && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="percentual"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Percentual (%) *</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Ex: 50.00"
                                  {...field}
                                  className="rounded-lg"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="space-y-2">
                          <FormLabel>Boleto</FormLabel>
                          <div className="flex gap-2 items-center">
                            <Input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => setBoletoFile(e.target.files?.[0] || null)}
                              disabled={uploadingBoleto}
                              className="flex-1 rounded-lg"
                            />
                            {uploadingBoleto && <Loader2 className="h-4 w-4 animate-spin" />}
                          </div>
                          {boletoFile && <p className="text-xs text-muted-foreground">{boletoFile.name}</p>}
                        </div>

                        <div className="space-y-2">
                          <FormLabel>Nota Fiscal</FormLabel>
                          <div className="flex gap-2 items-center">
                            <Input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.xml"
                              onChange={(e) => setNotaFile(e.target.files?.[0] || null)}
                              disabled={uploadingNota}
                              className="flex-1 rounded-lg"
                            />
                            {uploadingNota && <Loader2 className="h-4 w-4 animate-spin" />}
                          </div>
                          {notaFile && <p className="text-xs text-muted-foreground">{notaFile.name}</p>}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Colaborador-specific fields */}
                {watchType === "colaborador" && (
                  <FormField
                    control={form.control}
                    name="receiverId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Colaborador *</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={loadingData}
                        >
                          <FormControl>
                            <SelectTrigger className="rounded-lg">
                              <SelectValue placeholder="Selecione um colaborador" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    className="rounded-lg"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loading || loadingData || uploadingBoleto || uploadingNota}
                    className="rounded-lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adicionando...
                      </>
                    ) : (
                      "Adicionar"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
