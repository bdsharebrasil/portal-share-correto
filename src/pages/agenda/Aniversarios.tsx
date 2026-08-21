// @ts-nocheck
import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  CalendarIcon,
  Cake,
  Plus,
  Edit,
  Trash2,
  Building2,
  Sparkles,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useBirthdays } from "@/hooks/useBirthdays";
import type { Database } from "@/integrations/supabase/types";

type BirthdayRow = Database["public"]["Tables"]["birthdays"]["Row"] & {
  avatar_url?: string | null;
  displayDate?: string;
  source?: string;
};

// Configuração visual das categorias
const getCategoryBadge = (category: string | null) => {
  switch (category?.toLowerCase()) {
    case "clientes":
    case "cliente":
      return {
        label: "Cliente",
        className: "bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20",
      };
    case "colaboradores":
    case "colaborador":
    case "funcionario":
      return {
        label: "Colaborador",
        className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20",
      };
    case "fornecedores":
    case "fornecedor":
      return {
        label: "Fornecedor",
        className: "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20",
      };
    case "hoteis":
    case "hotel":
      return {
        label: "Hotel",
        className: "bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20",
      };
    default:
      return null;
  }
};

// Gera as iniciais para o fallback do Avatar
const getInitials = (name?: string) => {
  if (!name) return "AN";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
    category: "cliente",
    avatar_url: "",
  });

  const filteredBirthdays: BirthdayRow[] = useMemo(() => {
    return getFilteredBirthdays(filter);
  }, [filter, getFilteredBirthdays]);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 text-primary shadow-inner">
              <Cake className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Aniversários
            </h1>
          </div>
          <p className="text-muted-foreground text-sm pl-1">
            Acompanhe e comemore as datas especiais dos seus contatos
          </p>
        </div>

        <Button
          onClick={() => {
            setEditingBirthday(null);
            setFormData({
              nome: "",
              data_aniversario: "",
              empresa: "",
              category: "cliente",
              avatar_url: "",
            });
            setIsDialogOpen(true);
          }}
          className="flex items-center gap-2 h-11 px-5 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-medium rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-200"
        >
          <Plus className="h-5 w-5" />
          Novo Aniversário
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          onClick={() => setFilter("month")}
          className={`cursor-pointer transition-all duration-300 rounded-2xl bg-background/60 backdrop-blur-md border ${
            filter === "month"
              ? "border-primary/80 ring-1 ring-primary/40 bg-card/60"
              : "border-border/60 hover:border-border hover:bg-card/40"
          }`}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Este Mês
                </p>
                <p className="text-3xl font-extrabold text-foreground">
                  {birthdaysThisMonth}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <Cake className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setFilter("next7")}
          className={`cursor-pointer transition-all duration-300 rounded-2xl bg-background/60 backdrop-blur-md border ${
            filter === "next7"
              ? "border-primary/80 ring-1 ring-primary/40 bg-card/60"
              : "border-border/60 hover:border-border hover:bg-card/40"
          }`}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Próximos 7 dias
                </p>
                <p className="text-3xl font-extrabold text-foreground">
                  {birthdaysNextSevenDays}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Calendar className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setFilter("all")}
          className={`cursor-pointer transition-all duration-300 rounded-2xl bg-background/60 backdrop-blur-md border ${
            filter === "all"
              ? "border-primary/80 ring-1 ring-primary/40 bg-card/60"
              : "border-border/60 hover:border-border hover:bg-card/40"
          }`}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Total Geral
                </p>
                <p className="text-3xl font-extrabold text-foreground">
                  {totalBirthdays}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main List Card */}
      <Card className="border border-border/80 bg-background/60 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden">
        <CardHeader className="border-b border-border/60 pb-5 pt-6 px-6">
          <CardTitle className="flex items-center gap-3 text-lg font-semibold text-foreground">
            <Cake className="h-5 w-5 text-primary" />
            {filter === "next7"
              ? "Aniversários - Próximos 7 dias"
              : filter === "all"
              ? "Todos os Aniversários Cadastrados"
              : "Aniversariantes Deste Mês"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <div className="p-4 rounded-full bg-card border border-border mb-3 animate-pulse">
                <Cake className="h-8 w-8 text-primary animate-bounce" />
              </div>
              <p className="text-sm">Carregando aniversariantes...</p>
            </div>
          ) : filteredBirthdays.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <div className="p-4 rounded-full bg-card border border-border mb-3">
                <Cake className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">
                Nenhum aniversário encontrado
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Clique em "Novo Aniversário" para cadastrar um contato.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredBirthdays.map((birthday) => {
                const categoryBadge = getCategoryBadge(birthday.category);

                return (
                  <div
                    key={birthday.id}
                    className="group relative flex items-center justify-between p-4 rounded-xl border border-border/70 bg-card/40 hover:bg-card/80 hover:border-border/80 transition-all duration-200 shadow-sm"
                  >
                    {/* User Info & Avatar */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <Avatar className="h-12 w-12 border border-border/60 shadow-inner flex-shrink-0 group-hover:border-primary/50 transition-colors">
                        <AvatarImage
                          src={birthday.avatar_url || undefined}
                          alt={birthday.nome}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-card-secondary text-foreground font-semibold text-sm">
                          {getInitials(birthday.nome)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground text-base truncate group-hover:text-primary transition-colors">
                          {birthday.nome}
                        </h3>
                        {birthday.empresa && (
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                            <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            {birthday.empresa}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Date & Category Badge */}
                    <div className="flex flex-col items-end gap-1.5 pl-3">
                      <span className="text-base font-bold text-foreground tracking-tight">
                        {birthday.displayDate}
                      </span>
                      {categoryBadge && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 font-medium border ${categoryBadge.className}`}
                        >
                          {categoryBadge.label}
                        </Badge>
                      )}
                    </div>

                    {/* Quick Actions (On Hover) */}
                    {birthday.source !== "user_profiles" && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-card/90 backdrop-blur-md border border-border/80 rounded-lg p-1 shadow-lg">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-white hover:bg-card-secondary rounded-md"
                          onClick={() => {
                            setEditingBirthday(birthday);
                            setFormData({
                              nome: birthday.nome,
                              data_aniversario: (birthday.data_aniversario || "").slice(0, 10),
                              empresa: birthday.empresa || "",
                              category: birthday.category || "cliente",
                              avatar_url: birthday.avatar_url || "",
                            });
                            setIsDialogOpen(true);
                          }}
                          title="Editar"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-md"
                          onClick={async () => {
                            const confirmed = window.confirm(
                              `Excluir o aniversário de ${birthday.nome}?`
                            );
                            if (!confirmed) return;
                            try {
                              const { error } = await supabase
                                .from("birthdays")
                                .delete()
                                .eq("id", birthday.id);
                              if (error) throw error;
                              toast({
                                title: "Excluído",
                                description: "Aniversário excluído com sucesso",
                              });
                              refetch();
                            } catch (err) {
                              console.error("Erro ao excluir aniversário:", err);
                              toast({
                                title: "Erro",
                                description: "Não foi possível excluir",
                                variant: "destructive",
                              });
                            }
                          }}
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md bg-background border-border text-foreground rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                <Cake className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl">
                {editingBirthday ? "Editar Aniversário" : "Novo Aniversário"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-muted-foreground text-xs">
              {editingBirthday
                ? "Atualize os dados do aniversário do seu contato."
                : "Preencha os campos abaixo para cadastrar um novo aniversário."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="nome" className="text-xs font-medium text-muted-foreground">
                Nome completo *
              </Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Maria Silva"
                className="mt-1.5 bg-card border-border focus:border-primary text-foreground"
              />
            </div>

            <div>
              <Label htmlFor="data_aniversario" className="text-xs font-medium text-muted-foreground">
                Data de Aniversário *
              </Label>
              <Popover open={birthdayDateOpen} onOpenChange={setBirthdayDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal mt-1.5 bg-card border-border text-foreground hover:bg-card-secondary"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {formData.data_aniversario
                      ? format(new Date(formData.data_aniversario), "dd/MM/yyyy", { locale: ptBR })
                      : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                  <UICalendar
                    mode="single"
                    selected={formData.data_aniversario ? new Date(formData.data_aniversario) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, "0");
                        const day = String(date.getDate()).padStart(2, "0");
                        setFormData({ ...formData, data_aniversario: `${year}-${month}-${day}` });
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
              <Label htmlFor="avatar_url" className="text-xs font-medium text-muted-foreground">
                URL da Foto de Perfil (Opcional)
              </Label>
              <Input
                id="avatar_url"
                value={formData.avatar_url}
                onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                placeholder="https://exemplo.com/foto.jpg"
                className="mt-1.5 bg-card border-border focus:border-primary text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="empresa" className="text-xs font-medium text-muted-foreground">
                  Empresa
                </Label>
                <Input
                  id="empresa"
                  value={formData.empresa}
                  onChange={(e) => setFormData({ ...formData, empresa: e.target.value })}
                  placeholder="Nome da empresa"
                  className="mt-1.5 bg-card border-border focus:border-primary text-foreground"
                />
              </div>

              <div>
                <Label htmlFor="categoria" className="text-xs font-medium text-muted-foreground">
                  Categoria *
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="mt-1.5 bg-card border-border text-foreground focus:ring-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="colaborador">Colaborador</SelectItem>
                    <SelectItem value="fornecedor">Fornecedor</SelectItem>
                    <SelectItem value="hotel">Hotel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="border-border text-muted-foreground hover:bg-card"
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                try {
                  if (!formData.nome || !formData.data_aniversario) {
                    toast({
                      title: "Campos obrigatórios",
                      description: "Nome e data são obrigatórios",
                      variant: "destructive",
                    });
                    return;
                  }

                  const payload = {
                    nome: formData.nome,
                    data_aniversario: formData.data_aniversario,
                    empresa: formData.empresa,
                    category: formData.category,
                    avatar_url: formData.avatar_url || null,
                  };

                  if (editingBirthday) {
                    const { error } = await supabase
                      .from("birthdays")
                      .update({
                        ...payload,
                        updated_at: new Date().toISOString(),
                      })
                      .eq("id", editingBirthday.id);
                    if (error) throw error;
                    toast({
                      title: "Atualizado",
                      description: "Aniversário atualizado com sucesso",
                    });
                  } else {
                    const { error } = await supabase
                      .from("birthdays")
                      .insert([payload]);
                    if (error) throw error;
                    toast({
                      title: "Sucesso",
                      description: "Aniversário cadastrado com sucesso",
                    });
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
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              {editingBirthday ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
