import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, CalendarIcon, Cake, Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useBirthdays } from "@/hooks/useBirthdays";
import type { Database } from "@/integrations/supabase/types";

type BirthdayRow = Database["public"]["Tables"]["birthdays"]["Row"];

const getBirthdayCategoryLabel = (category: string | null) => {
  switch (category) {
    case "clientes":
    case "cliente":
      return "Cliente";
    case "colaboradores":
    case "colaborador":
    case "funcionario":
      return "Colaborador";
    case "fornecedores":
    case "fornecedor":
      return "Fornecedor";
    case "hoteis":
    case "hotel":
      return "Hotel";
    default:
      return "";
  }
};

export default function Aniversarios() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBirthday, setEditingBirthday] = useState<BirthdayRow | null>(null);
  const { toast } = useToast();
  const [filter, setFilter] = useState<"month" | "next7" | "all">("month");
  const [birthdayDateOpen, setBirthdayDateOpen] = useState(false);

  const {
    isLoading,
    refetch,
    getFilteredBirthdays,
    birthdaysThisMonth,
    birthdaysNextSevenDays,
    totalBirthdays,
  } = useBirthdays();

  const [formData, setFormData] = useState({
    nome: "",
    data_aniversario: "",
    empresa: "",
    category: "cliente" as string,
  });

  const filteredBirthdays = useMemo(() => {
    return getFilteredBirthdays(filter);
  }, [filter, getFilteredBirthdays]);

  return (
    <div className="p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Cake className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Aniversários</h1>
            </div>
            <p className="text-muted-foreground mt-3">
              Acompanhe e gerencie os aniversários dos seus contatos
            </p>
          </div>
          <Button onClick={() => {
            setEditingBirthday(null);
            setFormData({ nome: "", data_aniversario: "", empresa: "", category: "cliente" });
            setIsDialogOpen(true);
          }} className="flex items-center gap-2 h-11 px-6 bg-gradient-to-r from-primary to-primary/90 hover:shadow-lg transition-all">
            <Plus className="h-5 w-5" />
            Novo Aniversário
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card onClick={() => setFilter("month")} className="cursor-pointer group hover:shadow-lg hover:border-blue-400 transition-all border-2 border-transparent">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Este Mês</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">{birthdaysThisMonth}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 group-hover:scale-110 transition-transform">
                  <Cake className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card onClick={() => setFilter("next7")} className="cursor-pointer group hover:shadow-lg hover:border-orange-400 transition-all border-2 border-transparent">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Próximos 7 dias</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">{birthdaysNextSevenDays}</p>
                </div>
                <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900/30 group-hover:scale-110 transition-transform">
                  <Calendar className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card onClick={() => setFilter("all")} className="cursor-pointer group hover:shadow-lg hover:border-purple-400 transition-all border-2 border-transparent">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Total de Aniversários</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-purple-500 bg-clip-text text-transparent">{totalBirthdays}</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30 group-hover:scale-110 transition-transform">
                  <Cake className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10 pb-6">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 rounded-lg bg-primary/10">
                <Cake className="h-5 w-5 text-primary" />
              </div>
              {filter === "next7" ? "Aniversários - Próximos 7 dias" : filter === "all" ? "Todos os Aniversários" : "Aniversariantes deste Mês"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="mb-3 p-3 rounded-lg bg-primary/10">
                  <Cake className="h-8 w-8 text-primary animate-bounce" />
                </div>
                <p>Carregando aniversários...</p>
              </div>
            ) : filteredBirthdays.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="mb-3 p-3 rounded-lg bg-muted">
                  <Cake className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium">Nenhum aniversário registrado.</p>
                <p className="text-sm mt-1">Clique em "Novo Aniversário" para adicionar.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBirthdays.map((birthday) => (
                  <div
                    key={birthday.id}
                    className="group relative flex items-center justify-between p-5 border-2 border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-all duration-300 shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <Cake className="h-7 w-7 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-foreground">{birthday.nome}</h3>
                        {birthday.empresa && (
                          <p className="text-sm text-muted-foreground mt-0.5">{birthday.empresa}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <div className="text-xl font-bold text-primary">{birthday.displayDate}</div>
                      {getBirthdayCategoryLabel(birthday.category) && (
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/20">{getBirthdayCategoryLabel(birthday.category)}</Badge>
                      )}
                    </div>

                    {birthday.source !== "user_profiles" && (
                      <div className="absolute right-4 top-1/4 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingBirthday(birthday);
                            setFormData({
                              nome: birthday.nome,
                              data_aniversario: (birthday.data_aniversario || "").slice(0, 10),
                              empresa: birthday.empresa || "",
                              category: birthday.category || "cliente",
                            });
                            setIsDialogOpen(true);
                          }}
                          aria-label="Editar aniversário"
                          title="Editar aniversário"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={async () => {
                            const confirmed = window.confirm(`Excluir aniversário de ${birthday.nome}?`);
                            if (!confirmed) return;
                            try {
                              const { error } = await supabase.from("birthdays").delete().eq("id", birthday.id);
                              if (error) throw error;
                              toast({ title: "Excluído", description: "Aniversário excluído com sucesso" });
                              refetch();
                            } catch (err) {
                              console.error("Erro ao excluir aniversário:", err);
                              toast({ title: "Erro", description: "Não foi possível excluir", variant: "destructive" });
                            }
                          }}
                          aria-label="Excluir aniversário"
                          title="Excluir aniversário"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Cake className="h-5 w-5 text-primary" />
                </div>
              </div>
              <DialogTitle className="text-2xl">
                {editingBirthday ? "Editar Aniversário" : "Novo Aniversário"}
              </DialogTitle>
              <DialogDescription>
                {editingBirthday ? "Atualize os dados do aniversário" : "Cadastre um novo aniversário para acompanhar"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <Label htmlFor="data_aniversario">Data de Aniversário *</Label>
                <Popover open={birthdayDateOpen} onOpenChange={setBirthdayDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-white" />
                      {formData.data_aniversario
                        ? format(new Date(formData.data_aniversario), "dd/MM/yyyy", { locale: ptBR })
                        : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={4}>
                    <UICalendar
                      mode="single"
                      selected={formData.data_aniversario ? new Date(formData.data_aniversario) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const formattedDate = `${year}-${month}-${day}`;
                          setFormData({ ...formData, data_aniversario: formattedDate });
                          setBirthdayDateOpen(false);
                        }
                      }}
                      disabled={(date) => date > new Date()}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="empresa">Empresa</Label>
                <Input
                  id="empresa"
                  value={formData.empresa}
                  onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                  placeholder="Nome da empresa"
                />
              </div>

              <div>
                <Label htmlFor="categoria">Categoria *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="colaborador">Colaborador</SelectItem>
                    <SelectItem value="fornecedor">Fornecedor</SelectItem>
                    <SelectItem value="hotel">Hotel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="sm:mr-auto">
                Cancelar
              </Button>
              <Button onClick={async () => {
                try {
                  if (!formData.nome || !formData.data_aniversario) {
                    toast({
                      title: "Campos obrigatórios",
                      description: "Nome e data são obrigatórios",
                      variant: "destructive",
                    });
                    return;
                  }

                  if (editingBirthday) {
                    const { error } = await supabase
                      .from("birthdays")
                      .update({
                        nome: formData.nome,
                        data_aniversario: formData.data_aniversario,
                        empresa: formData.empresa,
                        category: formData.category as any,
                        updated_at: new Date().toISOString(),
                      })
                      .eq("id", editingBirthday.id);
                    if (error) throw error;
                    toast({ title: "Atualizado", description: "Aniversário atualizado com sucesso" });
                  } else {
                    const { error } = await supabase
                      .from("birthdays")
                      .insert([formData as any]);
                    if (error) throw error;
                    toast({ title: "Sucesso", description: "Aniversário cadastrado com sucesso" });
                  }

                  setIsDialogOpen(false);
                  setEditingBirthday(null);
                  refetch();
                } catch (error) {
                  console.error("Erro ao salvar aniversário:", error);
                  toast({
                    title: "Erro",
                    description: "Erro ao salvar aniversário",
                    variant: "destructive",
                  });
                }
              }} className="bg-gradient-to-r from-primary to-primary/90 hover:shadow-lg transition-all">
                {editingBirthday ? "Atualizar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
