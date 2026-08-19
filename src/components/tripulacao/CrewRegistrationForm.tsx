import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Edit2,
  Trash2,
  Plus,
  Plane,
  UserRound,
  FileText,
  Search,
  Phone,
  CreditCard,
} from "lucide-react";

interface Aircraft {
  id: string;
  matricula: string;
  modelo: string;
}

interface FreelanceCrew {
  id: string;
  canac: string;
  nome_completo: string;
  data_nascimento?: string | null;
  telefone?: string | null;
  url_avatar?: string | null;
  rg?: string | null;
  cpf?: string | null;
  endereco?: string | null;
  status: string;
  criado_em: string;
  aeronave_id?: string | null;
  observacao?: string | null;

  aeronave?: Aircraft | null;
}

interface FormData {
  canac: string;
  nome_completo: string;
  data_nascimento: string;
  telefone: string;
  rg: string;
  cpf: string;
  endereco: string;
  status: string;
  aeronave_id: string;
  observacao: string;
}

const INITIAL_FORM_STATE: FormData = {
  canac: "",
  nome_completo: "",
  data_nascimento: "",
  telefone: "",
  rg: "",
  cpf: "",
  endereco: "",
  status: "ativo",
  aeronave_id: "",
  observacao: "",
};

export function CrewRegistrationForm() {
  const [crewList, setCrewList] = useState<FreelanceCrew[]>([]);
  const [aircraftList, setAircraftList] = useState<Aircraft[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isAircraftLoading, setIsAircraftLoading] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_STATE);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadCrew();
    loadAircraft();
  }, []);

  const loadCrew = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("tripulacao")
        .select(`
          id,
          canac,
          nome_completo,
          data_nascimento,
          telefone,
          url_avatar,
          status,
          rg,
          cpf,
          endereco,
          criado_em,
          aeronave_id,
          observacao,
          aeronave:aeronave_id (
            id,
            matricula,
            modelo
          )
        `)
        .order("nome_completo", { ascending: true });

      if (error) {
        throw error;
      }

      setCrewList((data || []) as FreelanceCrew[]);
    } catch (error: any) {
      console.error("Erro ao carregar tripulantes externos:", error);

      toast({
        title: "Erro",
        description:
          error?.message || "Falha ao carregar tripulantes externos.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAircraft = async () => {
    try {
      setIsAircraftLoading(true);

      const { data, error } = await supabase
        .from("aeronave")
        .select("id, matricula, modelo")
        .order("matricula", { ascending: true });

      if (error) {
        throw error;
      }

      setAircraftList((data || []) as Aircraft[]);
    } catch (error: any) {
      console.error("Erro ao carregar aeronaves:", error);

      toast({
        title: "Erro",
        description:
          error?.message || "Falha ao carregar aeronaves.",
        variant: "destructive",
      });
    } finally {
      setIsAircraftLoading(false);
    }
  };

  const handleInputChange = (
    field: keyof FormData,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM_STATE);
    setEditingId(null);
  };

  const selectedAircraft = useMemo(() => {
    return aircraftList.find(
      (aircraft) => aircraft.id === formData.aeronave_id
    );
  }, [aircraftList, formData.aeronave_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.canac.trim() || !formData.nome_completo.trim()) {
      toast({
        title: "Validação",
        description: "CANAC e Nome são campos obrigatórios.",
        variant: "destructive",
      });

      return;
    }

    try {
      setIsLoading(true);

      const payload = {
        canac: formData.canac.trim(),
        nome_completo: formData.nome_completo.trim(),
        data_nascimento: formData.data_nascimento || null,
        telefone: formData.telefone.trim() || null,
        rg: formData.rg.trim() || null,
        cpf: formData.cpf.trim() || null,
        endereco: formData.endereco.trim() || null,
        status: formData.status,
        aeronave_id: formData.aeronave_id || null,
        observacao: formData.observacao.trim() || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("tripulacao")
          .update(payload)
          .eq("id", editingId);

        if (error) {
          throw error;
        }

        toast({
          title: "Sucesso",
          description: "Tripulante externo atualizado com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from("tripulacao")
          .insert([payload]);

        if (error) {
          throw error;
        }

        toast({
          title: "Sucesso",
          description: "Tripulante externo cadastrado com sucesso.",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      await loadCrew();
    } catch (error: any) {
      console.error("Erro ao salvar tripulante:", error);

      toast({
        title: "Erro",
        description:
          error?.message || "Não foi possível salvar o tripulante.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (crew: FreelanceCrew) => {
    setFormData({
      canac: crew.canac || "",
      nome_completo: crew.nome_completo || "",
      data_nascimento: crew.data_nascimento || "",
      telefone: crew.telefone || "",
      rg: crew.rg || "",
      cpf: crew.cpf || "",
      endereco: crew.endereco || "",
      status: crew.status || "ativo",
      aeronave_id: crew.aeronave_id || "",
      observacao: crew.observacao || "",
    });

    setEditingId(crew.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "Tem certeza que deseja excluir este tripulante externo?"
    );

    if (!confirmed) return;

    try {
      setIsLoading(true);

      const { error } = await supabase
        .from("tripulacao")
        .delete()
        .eq("id", id);

      if (error) {
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Tripulante externo removido com sucesso.",
      });

      await loadCrew();
    } catch (error: any) {
      console.error("Erro ao excluir tripulante:", error);

      toast({
        title: "Erro",
        description:
          error?.message || "Não foi possível excluir o tripulante.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCrew = crewList.filter((crew) => {
    const search = searchTerm.toLowerCase().trim();

    if (!search) return true;

    return (
      crew.nome_completo?.toLowerCase().includes(search) ||
      crew.canac?.toLowerCase().includes(search) ||
      crew.cpf?.toLowerCase().includes(search) ||
      crew.aeronave?.matricula?.toLowerCase().includes(search) ||
      crew.aeronave?.modelo?.toLowerCase().includes(search) ||
      crew.observacao?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
              <UserRound className="h-5 w-5 text-amber-400" />
            </div>

            <div>
              <h2 className="text-2xl font-bold">
                Tripulantes Externos
              </h2>

              <p className="text-sm text-muted-foreground mt-1">
                Profissionais sem vínculo empregatício com a Share Brasil
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo tripulante
        </Button>
      </div>

      {/* AVISO */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-4">
        <div className="flex items-start gap-3">
          <UserRound className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />

          <div>
            <p className="font-medium text-amber-300">
              Cadastro de profissionais externos
            </p>

            <p className="text-sm text-muted-foreground mt-1">
              Utilize este cadastro para tripulantes que não fazem parte
              do quadro de funcionários da Share, como freelancers ou
              profissionais contratados diretamente pelo cliente.
            </p>
          </div>
        </div>
      </div>

      {/* BUSCA */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

        <Input
          placeholder="Buscar por nome, CANAC, aeronave ou vínculo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* TABELA */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading && crewList.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              Carregando tripulantes...
            </div>
          ) : filteredCrew.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <UserRound className="h-7 w-7 text-muted-foreground" />
              </div>

              <p className="font-medium">
                {searchTerm
                  ? "Nenhum tripulante encontrado"
                  : "Nenhum tripulante externo cadastrado"}
              </p>

              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm
                  ? "Tente buscar por outro nome, CANAC, aeronave ou observação."
                  : "Cadastre o primeiro profissional externo."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Tripulante</TableHead>
                    <TableHead>CANAC</TableHead>
                    <TableHead>Aeronave</TableHead>
                    <TableHead>Vínculo / Observação</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredCrew.map((crew) => (
                    <TableRow
                      key={crew.id}
                      className="hover:bg-muted/30"
                    >
                      {/* TRIPULANTE */}
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-[220px]">
                          {crew.url_avatar ? (
                            <img
                              src={crew.url_avatar}
                              alt={crew.nome_completo}
                              className="h-10 w-10 rounded-full object-cover border"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                              <UserRound className="h-5 w-5 text-primary" />
                            </div>
                          )}

                          <div>
                            <p className="font-medium">
                              {crew.nome_completo}
                            </p>

                            <p className="text-xs text-muted-foreground">
                              Tripulante externo
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* CANAC */}
                      <TableCell>
                        <div className="font-medium">
                          {crew.canac}
                        </div>
                      </TableCell>

                      {/* AERONAVE */}
                      <TableCell>
                        {crew.aeronave ? (
                          <div className="flex items-center gap-2 min-w-[180px]">
                            <div className="h-8 w-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                              <Plane className="h-4 w-4 text-sky-400" />
                            </div>

                            <div>
                              <p className="font-medium">
                                {crew.aeronave.matricula}
                              </p>

                              <p className="text-xs text-muted-foreground">
                                {crew.aeronave.modelo}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">
                            Não vinculada
                          </span>
                        )}
                      </TableCell>

                      {/* VÍNCULO / OBSERVAÇÃO */}
                      <TableCell>
                        <div className="max-w-[300px] space-y-1">
                          <Badge
                            variant="outline"
                            className="border-amber-500/30 text-amber-400"
                          >
                            Sem vínculo Share
                          </Badge>

                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {crew.observacao || (
                              <span className="italic">
                                Sem observação informada
                              </span>
                            )}
                          </p>
                        </div>
                      </TableCell>

                      {/* CONTATO */}
                      <TableCell>
                        <div className="space-y-1 text-sm min-w-[150px]">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{crew.cpf || "CPF não informado"}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{crew.telefone || "Telefone não informado"}</span>
                          </div>
                        </div>
                      </TableCell>

                      {/* STATUS */}
                      <TableCell>
                        <Badge
                          variant={
                            crew.status === "ativo"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {crew.status === "ativo"
                            ? "Ativo"
                            : "Inativo"}
                        </Badge>
                      </TableCell>

                      {/* AÇÕES */}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(crew)}
                            disabled={isLoading}
                            title="Editar tripulante"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(crew.id)}
                            disabled={isLoading}
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            title="Excluir tripulante"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);

          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5" />

              {editingId
                ? "Editar Tripulante Externo"
                : "Novo Tripulante Externo"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* IDENTIFICAÇÃO */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <UserRound className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">
                  Identificação
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome_completo">
                    Nome Completo *
                  </Label>

                  <Input
                    id="nome_completo"
                    value={formData.nome_completo}
                    onChange={(e) =>
                      handleInputChange(
                        "nome_completo",
                        e.target.value
                      )
                    }
                    placeholder="João Silva"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="canac">
                    CANAC *
                  </Label>

                  <Input
                    id="canac"
                    value={formData.canac}
                    onChange={(e) =>
                      handleInputChange(
                        "canac",
                        e.target.value
                      )
                    }
                    placeholder="Ex: 1234567"
                    required
                  />
                </div>
              </div>
            </div>

            {/* DOCUMENTOS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">
                  Documentos e contato
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>

                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(e) =>
                      handleInputChange(
                        "cpf",
                        e.target.value
                      )
                    }
                    placeholder="000.000.000-00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rg">RG</Label>

                  <Input
                    id="rg"
                    value={formData.rg}
                    onChange={(e) =>
                      handleInputChange(
                        "rg",
                        e.target.value
                      )
                    }
                    placeholder="00.000.000-0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data_nascimento">
                    Data de Nascimento
                  </Label>

                  <Input
                    id="data_nascimento"
                    type="date"
                    value={formData.data_nascimento}
                    onChange={(e) =>
                      handleInputChange(
                        "data_nascimento",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">
                    Telefone
                  </Label>

                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) =>
                      handleInputChange(
                        "telefone",
                        e.target.value
                      )
                    }
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="endereco">
                  Endereço
                </Label>

                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) =>
                    handleInputChange(
                      "endereco",
                      e.target.value
                    )
                  }
                  placeholder="Rua, número, bairro, cidade"
                />
              </div>
            </div>

            {/* AERONAVE E VÍNCULO */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <Plane className="h-4 w-4 text-sky-400" />
                <h3 className="font-semibold">
                  Alocação e vínculo
                </h3>
              </div>

              <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-sm text-muted-foreground">
                <strong className="text-sky-300">
                  Aeronave:
                </strong>{" "}
                informe a aeronave à qual este tripulante está
                relacionado.
                <br />

                <strong className="text-amber-300">
                  Observação:
                </strong>{" "}
                informe como ele está sendo contratado, por exemplo
                "Freelancer" ou "Contratação direta do cliente".
              </div>

              <div className="space-y-2">
                <Label htmlFor="aeronave_id">
                  Aeronave
                </Label>

                <Select
                  value={formData.aeronave_id || undefined}
                  onValueChange={(value) =>
                    handleInputChange(
                      "aeronave_id",
                      value
                    )
                  }
                  disabled={isAircraftLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        isAircraftLoading
                          ? "Carregando aeronaves..."
                          : "Selecione a aeronave"
                      }
                    />
                  </SelectTrigger>

                  <SelectContent>
                    {aircraftList.length === 0 ? (
                      <SelectItem
                        value="__none__"
                        disabled
                      >
                        Nenhuma aeronave encontrada
                      </SelectItem>
                    ) : (
                      aircraftList.map((aircraft) => (
                        <SelectItem
                          key={aircraft.id}
                          value={aircraft.id}
                        >
                          {aircraft.matricula} — {aircraft.modelo}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                {selectedAircraft && (
                  <p className="text-xs text-muted-foreground">
                    Aeronave selecionada:{" "}
                    <strong>
                      {selectedAircraft.matricula}
                    </strong>{" "}
                    — {selectedAircraft.modelo}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacao">
                  Vínculo / Observação
                </Label>

                <Textarea
                  id="observacao"
                  value={formData.observacao}
                  onChange={(e) =>
                    handleInputChange(
                      "observacao",
                      e.target.value
                    )
                  }
                  rows={4}
                  placeholder={`Exemplos:
Freelancer contratado pela Share para esta aeronave.
Contratação direta do cliente.
Freelancer para voo específico.
Tripulante eventual sem vínculo empregatício com a Share.`}
                />

                <p className="text-xs text-muted-foreground">
                  Este campo é importante para identificar
                  claramente a condição do profissional.
                </p>
              </div>
            </div>

            {/* STATUS */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status">
                  Status
                </Label>

                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    handleInputChange("status", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="ativo">
                      Ativo
                    </SelectItem>

                    <SelectItem value="inativo">
                      Inativo
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* RESUMO */}
            {(selectedAircraft ||
              formData.observacao.trim()) && (
              <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                <p className="text-sm font-semibold">
                  Resumo do vínculo
                </p>

                {selectedAircraft && (
                  <div className="flex items-center gap-2 text-sm">
                    <Plane className="h-4 w-4 text-sky-400" />
                    <span>
                      {selectedAircraft.matricula} —{" "}
                      {selectedAircraft.modelo}
                    </span>
                  </div>
                )}

                {formData.observacao.trim() && (
                  <div className="flex items-start gap-2 text-sm">
                    <FileText className="h-4 w-4 text-amber-400 mt-0.5" />
                    <span className="text-muted-foreground">
                      {formData.observacao}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* BOTÕES */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                {isLoading
                  ? "Salvando..."
                  : editingId
                    ? "Salvar Alterações"
                    : "Cadastrar Tripulante"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
