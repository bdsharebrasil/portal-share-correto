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
  status: z.enum(["pendente", "recebido", "enviado", "pago"], {
    errorMap: () => ({ message: "Selecione um status válido" }),
  }),
  clientId: z.string().optional(),
  aircraftId: z.string().optional(),
  category: z.string().optional(),
  receiverId: z.string().optional(),
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
    if (!data.category) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: "Categoria é obrigatória para este tipo",
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
  const [loadingData, setLoadingData] = useState(true);
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
    },
  });

  const watchType = form.watch("type");

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    try {
      setLoadingData(true);

      const [clientsResponse, aircraftResponse, usersResponse] = await Promise.all([
        supabase.from("clients").select("id, company_name").order("company_name"),
        supabase.from("aircraft").select("id, registration").order("registration"),
        supabase
          .from("user_profiles")
          .select("id, full_name, employment_status")
          .eq("employment_status", "ativo" as any)
          .order("full_name"),
      ]);

      if (clientsResponse.error) throw clientsResponse.error;
      if (aircraftResponse.error) throw aircraftResponse.error;
      if (usersResponse.error) throw usersResponse.error;

      setClients((clientsResponse.data || []) as any);
      setAircraft((aircraftResponse.data || []) as any);
      setUsers((usersResponse.data || []) as any);
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

      const insertData: Record<string, any> = {
        type: data.type,
        date: data.date,
        description: data.description,
        amount: parseFloat(data.amount),
        status: data.status,
        created_by: user.id,
      };

      if (data.type === "cliente") {
        insertData.client_id = data.clientId;
        insertData.aircraft_id = data.aircraftId;
        insertData.category = data.category;
      } else if (data.type === "colaborador") {
        if (!data.receiverId) {
          throw new Error("Colaborador deve ser selecionado.");
        }

        // Validar que o receiver_id existe em user_profiles e está ativo
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

      const { error } = await supabase
        .from("bank_reconciliations")
        .insert([insertData] as any);

      if (error) {
        if (error.message?.includes("user_profiles")) {
          throw new Error(
            "Colaborador selecionado não existe. Por favor, selecione um colaborador válido da lista."
          );
        }
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Reconciliação bancária adicionada com sucesso.",
      });

      form.reset();
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
      <DialogContent className="max-w-2xl">
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
                    <Input type="date" {...field} />
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
                      {watchType === "cliente" ? (
                        <SelectItem value="recebido">Recebido</SelectItem>
                      ) : (
                        <>
                          <SelectItem value="enviado">Enviado</SelectItem>
                          <SelectItem value="pago">Pago</SelectItem>
                        </>
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
                          <SelectTrigger>
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
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: combustivel, manutencao, locacao"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
              <Button type="submit" disabled={loading || loadingData}>
                {loading ? "Adicionando..." : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
