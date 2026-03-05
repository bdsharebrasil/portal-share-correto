import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const colaboradorSchema = z.object({
  needsSystemAccess: z.boolean().default(true),
  login: z.string().optional(),
  password: z.string().optional(),
  full_name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  birth_date: z.string().optional(),
  address: z.string().optional(),
  company_start_date: z.string().optional(),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  canac: z.string().optional(),
  department: z.string().optional(),
  role: z.enum(["admin", "financeiro_master", "gestor_master", "financeiro", "tripulante", "piloto_chefe", "operacoes", "coordenador_de_voo", "adm"]),
}).refine((data) => {
  // Se precisa de acesso ao sistema, login e senha são obrigatórios
  if (data.needsSystemAccess) {
    return data.login && data.login.length >= 3 && data.password && data.password.length >= 6;
  }
  return true;
}, {
  message: "Login (mín. 3 caracteres) e senha (mín. 6 caracteres) são obrigatórios para usuários com acesso ao sistema",
  path: ["login"],
});

const clienteSchema = z.object({
  login: z.string().min(3, "Login deve ter no mínimo 3 caracteres"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  client_id: z.string().min(1, "Selecione um cliente"),
});

type ColaboradorFormData = z.infer<typeof colaboradorSchema>;
type ClienteFormData = z.infer<typeof clienteSchema>;

export function CreateUserForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [userType, setUserType] = useState<"colaborador" | "cliente">("colaborador");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const colaboradorForm = useForm<ColaboradorFormData>({
    resolver: zodResolver(colaboradorSchema),
    defaultValues: {
      needsSystemAccess: true,
      role: "adm",
      full_name: "",
    },
  });

  const clienteForm = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
  });

  const needsSystemAccess = colaboradorForm.watch("needsSystemAccess");

  const onSubmitColaborador = async (data: ColaboradorFormData) => {
    setIsLoading(true);
    try {
      const email = data.needsSystemAccess ? `${data.login}@share` : undefined;
      
      const { data: result, error } = await supabase.functions.invoke("create-user", {
        body: {
          email,
          password: data.needsSystemAccess ? data.password : undefined,
          role: data.role,
          userType: "colaborador",
          needsSystemAccess: data.needsSystemAccess,
          profileData: {
            full_name: data.full_name,
            email: data.email,
            phone: data.phone,
            birth_date: data.birth_date,
            address: data.address,
            company_start_date: data.company_start_date,
            cpf: data.cpf,
            rg: data.rg,
            canac: data.canac,
            department: data.department,
          },
        },
      });

      if (error) throw error;

      const crewRoles = ['tripulante', 'piloto_chefe', 'coordenador_de_voo'];
      const isCrewMember = crewRoles.includes(data.role);

      toast({
        title: "Sucesso!",
        description: `Colaborador criado com sucesso.${isCrewMember ? ' Também adicionado à tripulação.' : ''}${!data.needsSystemAccess ? ' (Sem acesso ao sistema)' : ''}`,
      });

      colaboradorForm.reset({
        needsSystemAccess: true,
        role: "adm",
        full_name: "",
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["crew_members"] });
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar colaborador.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitCliente = async (data: ClienteFormData) => {
    setIsLoading(true);
    try {
      const email = `${data.login}@share`;
      
      const { data: result, error } = await supabase.functions.invoke("create-user", {
        body: {
          email,
          password: data.password,
          role: "cliente",
          userType: "cliente",
          clientId: data.client_id,
          needsSystemAccess: true,
        },
      });

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Cliente criado com sucesso.",
      });

      clienteForm.reset();
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar cliente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar Novo Usuário</CardTitle>
        <CardDescription>
          Selecione o tipo de usuário e preencha os dados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={userType} onValueChange={(v) => setUserType(v as "colaborador" | "cliente")}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="colaborador">Colaborador</TabsTrigger>
            <TabsTrigger value="cliente">Cliente</TabsTrigger>
          </TabsList>

          <TabsContent value="colaborador">
            <Form {...colaboradorForm}>
              <form onSubmit={colaboradorForm.handleSubmit(onSubmitColaborador)} className="space-y-4">
                {/* Switch para acesso ao sistema */}
                <FormField
                  control={colaboradorForm.control}
                  name="needsSystemAccess"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/50">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Acesso ao Sistema</FormLabel>
                        <FormDescription>
                          {field.value 
                            ? "Usuário poderá fazer login no sistema" 
                            : "Apenas cadastro interno (sem login)"}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Campos de login e senha - apenas se precisa de acesso */}
                  {needsSystemAccess && (
                    <>
                      <FormField
                        control={colaboradorForm.control}
                        name="login"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Login *</FormLabel>
                            <FormControl>
                              <Input placeholder="usuario" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={colaboradorForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha *</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="******" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <FormField
                    control={colaboradorForm.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="João Silva" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={colaboradorForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Real</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="joao@exemplo.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={colaboradorForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input placeholder="(11) 99999-9999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={colaboradorForm.control}
                    name="birth_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Nascimento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={colaboradorForm.control}
                    name="company_start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Início na Empresa</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={colaboradorForm.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <Input placeholder="000.000.000-00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={colaboradorForm.control}
                    name="rg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RG</FormLabel>
                        <FormControl>
                          <Input placeholder="00.000.000-0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={colaboradorForm.control}
                    name="canac"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código ANAC</FormLabel>
                        <FormControl>
                          <Input placeholder="000000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={colaboradorForm.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Setor</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o setor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Financeiro">Financeiro</SelectItem>
                            <SelectItem value="Tripulação">Tripulação</SelectItem>
                            <SelectItem value="CTM">CTM</SelectItem>
                            <SelectItem value="RH">RH</SelectItem>
                            <SelectItem value="Coordenação de Voo">Coordenação de Voo</SelectItem>
                            <SelectItem value="Administrativo">Administrativo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={colaboradorForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="gestor_master">Gestor Master</SelectItem>
                            <SelectItem value="financeiro_master">Financeiro Master</SelectItem>
                            <SelectItem value="financeiro">Financeiro</SelectItem>
                            <SelectItem value="tripulante">Tripulante</SelectItem>
                            <SelectItem value="piloto_chefe">Piloto Chefe</SelectItem>
                            <SelectItem value="operacoes">Operações</SelectItem>
                            <SelectItem value="coordenador_de_voo">Coordenador de Voo</SelectItem>
                            <SelectItem value="adm">Administrativo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">
                          Tripulante, Piloto Chefe e Coordenador de Voo serão adicionados à tabela de tripulação automaticamente.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={colaboradorForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua, número, bairro, cidade - UF" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar Colaborador"
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="cliente">
            <ClientForm form={clienteForm} onSubmit={onSubmitCliente} isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ClientForm({ form, onSubmit, isLoading }: { form: any; onSubmit: any; isLoading: boolean }) {
  const [clients, setClients] = useState<any[]>([]);

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase.from("clients").select("id, company_name").order("company_name");
      if (data) setClients(data);
    };
    fetchClients();
  }, []);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="client_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cliente *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
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
          name="login"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Login *</FormLabel>
              <FormControl>
                <Input placeholder="usuario" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Senha *</FormLabel>
              <FormControl>
                <Input type="password" placeholder="******" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Criando...
            </>
          ) : (
            "Criar Cliente"
          )}
        </Button>
      </form>
    </Form>
  );
}
