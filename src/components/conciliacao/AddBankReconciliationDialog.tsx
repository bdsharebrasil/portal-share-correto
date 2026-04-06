import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Upload, Loader2 } from "lucide-react";

interface Client {
  id: string;
  company_name: string;
}

interface Aircraft {
  id: string;
  matricula: string;
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

interface AddBankReconciliationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddBankReconciliationDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddBankReconciliationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [categories, setCategories] = useState<{ id: string; nome: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);
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
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    try {
      setLoadingData(true);

      const [clientsResponse, aircraftResponse, usersResponse, categoriesResponse] = await Promise.all([
        supabase.from("clientes").select("id, razao_social").order("razao_social"),
        supabase.from('aeronave').select('id, matricula').order("matricula"),
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

      const { error: uploadError, data } = await supabase.storage
        .from("documentos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from("documentos")
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
        insertData.cliente_id = data.clientId;
        insertData.aeronave_id = data.aircraftId;

        if (data.reembolsavel === "sim") {
          insertData.categoria = data.category;
        } else {
          insertData.boleto_url = boletoUrl;
          insertData.nf_url = notaUrl;
          insertData.percentual = data.percentual;
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

        insertData.recebedor_id = data.receiverId;
      }

      const { data: inserted, error } = await supabase
        .from("conciliacoes_bancarias")
        .insert([insertData] as any)
        .select()
        .single();

      if (error) {
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

      // Se é tipo cliente reembolsável, criar conta a receber
      if (data.type === "cliente" && data.reembolsavel === "sim" && data.clientId && inserted) {
        try {
          const { data: clientData } = await supabase
            .from("clientes")
            .select("razao_social, cnpj")
            .eq("id", data.clientId)
            .single();

          let aircraftRegistration = "";
          if (data.aircraftId) {
            const { data: aircraftData } = await supabase
              .from('aeronave')
              .select('matricula')
              .eq("id", data.aircraftId)
              .single();
            if (aircraftData) {
              aircraftRegistration = aircraftData.matricula;
            }
          }

          const numeroDocumento = `REIMB-${Date.now().toString().slice(-6)}`;
          const clienteNome = (clientData as any)?.razao_social || "Cliente";

          await supabase.from("contas_areceber").insert({
            numero: numeroDocumento,
            referencia: clienteNome,
            cliente_nome: clienteNome,
            cliente_cnpj: (clientData as any)?.cnpj || "",
            data_criacao: data.date,
            data_vencimento: data.date,
            valor: parseFloat(data.amount),
            categoria: data.category || "Reembolso de Despesa",
            descricao: data.description || "Conta a receber",
            status: "pendente",
            arquivo_pdf_url: null,
            aeronave: aircraftRegistration,
            criado_por: user.id
          });
        } catch (err) {
          console.error("Erro ao criar conta a receber:", err);
        }
      }

      toast({
        title: "Sucesso",
        description: "Reconciliação bancária adicionada com sucesso.",
      });

      form.reset();
      setBoletoFile(null);
      setNotaFile(null);
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Reconciliação Bancária</DialogTitle>
          <DialogDescription>
            Registre manualmente uma nova movimentação bancária
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Type Selection */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Conciliação *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
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

            {/* Common Fields */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data *</FormLabel>
                  <FormControl>
                    <Input type="data" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Pagamento de fatura" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
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

            {/* Client-specific fields */}
            {watchType === "cliente" && (
              <>
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
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {(client as any).razao_social}
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
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma aeronave" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {aircraft.map((ac) => (
                            <SelectItem key={ac.id} value={ac.id}>
                              {ac.matricula}
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
                          <SelectTrigger>
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
                            <SelectTrigger>
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
                  <>
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
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-2">
                      <FormLabel>Boleto *</FormLabel>
                      <div className="flex gap-2 items-center">
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => setBoletoFile(e.target.files?.[0] || null)}
                          disabled={uploadingBoleto}
                          className="flex-1"
                        />
                        {uploadingBoleto && <Loader2 className="h-4 w-4 animate-spin" />}
                      </div>
                      {boletoFile && <p className="text-xs text-slate-500">{boletoFile.name}</p>}
                    </div>

                    <div className="space-y-2">
                      <FormLabel>Nota Fiscal *</FormLabel>
                      <div className="flex gap-2 items-center">
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.xml"
                          onChange={(e) => setNotaFile(e.target.files?.[0] || null)}
                          disabled={uploadingNota}
                          className="flex-1"
                        />
                        {uploadingNota && <Loader2 className="h-4 w-4 animate-spin" />}
                      </div>
                      {notaFile && <p className="text-xs text-slate-500">{notaFile.name}</p>}
                    </div>
                  </>
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
                        <SelectTrigger>
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

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || loadingData || uploadingBoleto || uploadingNota}
              >
                {loading ? "Adicionando..." : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}