import React, { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { formatDateToBR } from "@/lib/date-utils";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

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

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";

import {
  User,
  Plane,
  Calendar,
  Award,
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Clock,
  FileText,
  Lock,
  Users,
  ArrowLeft,
  Search,
  ShieldCheck,
  UserRound,
  BriefcaseBusiness,
  UserRoundCheck,
  UserRoundX,
  ChevronRight,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import { CrewMemberCard } from "@/components/tripulacao/TripulacaoCard";
import { CrewRegistrationForm } from "@/components/tripulacao/CrewRegistrationForm";

/* ============================================================================
 * TIPOS
 * ========================================================================== */

interface CrewLicenseLite {
  id: string;
  tipo_habilitacao: string;
  data_validade: string | null;
  CMA?: string | null;
  validade_cma?: string | null;
  FS_RH?: string | null;
}

interface CrewMember {
  id: string;
  nome_completo: string;
  canac: string;

  email?: string | null;
  telefone?: string | null;

  data_nascimento?: string | null;
  data_admissao?: string | null;

  status: string;

  url_avatar?: string | null;
  user_id?: string | null;

  role?: string | null;

  cpf?: string | null;
  rg?: string | null;
  endereco?: string | null;

  tipo_licenca?: string | null;

  /*
   * Caso futuramente exista no schema:
   *
   * vinculo?: "share" | "externo";
   * tipo_vinculo?: string;
   * contratado_share?: boolean;
   */

  _licenses?: CrewLicenseLite[];
}

interface CrewFlightHours {
  id: string;
  membro_tripulacao_id: string;
  aeronave_id: string;
  horas_totais: number;

  aeronave?: {
    matricula: string;
    modelo: string;
  } | null;
}

interface CrewLicense {
  id: string;
  membro_tripulacao_id: string;

  tipo_habilitacao: string;

  data_validade?: string | null;
  observacao?: string | null;

  CMA?: string | null;
  FS_RH?: string | null;
  validade_cma?: string | null;
}

interface LogbookFlight {
  id: string;
  data_registro: string;

  aerodromo_partida: string;
  aerodromo_chegada: string;

  tempo_total: number;

  natureza_voo: string;

  confirmado: boolean;
}

type MainTab = "members" | "registration";

type StatusFilter = "ativo" | "inativo";

/* ============================================================================
 * CONSTANTES
 * ========================================================================== */

const TIPOS_LICENCA = [
  {
    value: "PP",
    label: "PP — Piloto Privado",
  },
  {
    value: "PC",
    label: "PC — Piloto Comercial",
  },
  {
    value: "PLA",
    label: "PLA — Piloto de Linha Aérea",
  },
  {
    value: "PP-HELI",
    label: "PP-HELI — Piloto Privado de Helicóptero",
  },
  {
    value: "PC-HELI",
    label: "PC-HELI — Piloto Comercial de Helicóptero",
  },
];

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function normalizeText(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getDaysUntil(dateStr?: string | null) {
  if (!dateStr) return null;

  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date();

  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  return Math.ceil(
    (target.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function getLicenseStatus(
  license: CrewLicense | CrewLicenseLite
) {
  const dateStr =
    "CMA" in license && license.CMA
      ? license.validade_cma
      : license.data_validade;

  if (!dateStr) {
    return {
      type: "unknown" as const,
      label: "Sem validade",
      days: null,
    };
  }

  const days = getDaysUntil(dateStr);

  if (days === null) {
    return {
      type: "unknown" as const,
      label: "Sem validade",
      days: null,
    };
  }

  if (days < 0) {
    return {
      type: "expired" as const,
      label: "Vencida",
      days,
    };
  }

  if (days <= 30) {
    return {
      type: "critical" as const,
      label: `Vence em ${days} dias`,
      days,
    };
  }

  if (days <= 60) {
    return {
      type: "warning" as const,
      label: `Vence em ${days} dias`,
      days,
    };
  }

  return {
    type: "valid" as const,
    label: "Válida",
    days,
  };
}

/*
 * Neste momento usamos user_id como indicador de vínculo.
 *
 * Se o seu schema possuir um campo próprio para vínculo Share/Externo,
 * substitua esta função por ele.
 */
function getCrewRelationship(
  crew: CrewMember
): "share" | "externo" {
  return crew.user_id ? "share" : "externo";
}

/* ============================================================================
 * BADGES
 * ========================================================================== */

function RelationshipBadge({
  crew,
}: {
  crew: CrewMember;
}) {
  const relationship = getCrewRelationship(crew);

  if (relationship === "share") {
    return (
      <Badge
        variant="outline"
        className="
          border-blue-500/30
          bg-blue-500/10
          text-blue-400
          font-semibold
          gap-1.5
        "
      >
        <BriefcaseBusiness className="h-3.5 w-3.5" />
        SHARE
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="
        border-slate-500/30
        bg-slate-500/10
        text-slate-300
        font-semibold
        gap-1.5
      "
    >
      <UserRound className="h-3.5 w-3.5" />
      EXTERNO
    </Badge>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const active = normalizeText(status) === "ativo";

  return active ? (
    <Badge
      variant="outline"
      className="
        border-emerald-500/30
        bg-emerald-500/10
        text-emerald-400
        gap-1.5
      "
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      Ativo
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="
        border-red-500/30
        bg-red-500/10
        text-red-400
        gap-1.5
      "
    >
      <XCircle className="h-3.5 w-3.5" />
      Inativo
    </Badge>
  );
}

/* ============================================================================
 * COMPONENTE PRINCIPAL
 * ========================================================================== */

export default function GestaoDeTripulacao() {
  const navigate = useNavigate();

  const [activeMainTab, setActiveMainTab] =
    useState<MainTab>("members");

  const [crewMembers, setCrewMembers] =
    useState<CrewMember[]>([]);

  const [selectedCrew, setSelectedCrew] =
    useState<CrewMember | null>(null);

  const [flightHours, setFlightHours] =
    useState<CrewFlightHours[]>([]);

  const [licenses, setLicenses] =
    useState<CrewLicense[]>([]);

  const [schedules, setSchedules] =
    useState<LogbookFlight[]>([]);

  const [isLicenseDialogOpen, setIsLicenseDialogOpen] =
    useState(false);

  const [editingLicense, setEditingLicense] =
    useState<CrewLicense | null>(null);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ativo");

  const [relationshipFilter, setRelationshipFilter] =
    useState<"todos" | "share" | "externo">("todos");

  const [isEditingProfile, setIsEditingProfile] =
    useState(false);

  const [editingProfileData, setEditingProfileData] =
    useState<CrewMember | null>(null);

  const [loadingMembers, setLoadingMembers] =
    useState(false);

  const [loadingDetails, setLoadingDetails] =
    useState(false);

  const { hasRole } = useUserRole();

  const canEditProfile =
    hasRole("piloto_chefe") ||
    hasRole("admin") ||
    hasRole("gestor_master") ||
    hasRole("financeiro_master");

  const canEditHabilitacoes = true;

  /* --------------------------------------------------------------------------
   * CARREGAMENTO
   * ------------------------------------------------------------------------ */

  useEffect(() => {
    loadCrewMembers();
  }, [statusFilter]);

  useEffect(() => {
    if (selectedCrew) {
      loadCrewDetails(selectedCrew.id);
    }
  }, [selectedCrew]);

  const loadCrewMembers = async () => {
    setLoadingMembers(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from("membros_tripulacao")
        .select(`
          id,
          nome_completo,
          canac,
          email,
          telefone,
          data_nascimento,
          data_admissao,
          status,
          url_avatar,
          user_id,
          cpf,
          rg,
          endereco,
          tipo_licenca
        `)
        .eq("status", statusFilter)
        .order("nome_completo");

      if (error) {
        throw error;
      }

      const members = (data || []) as CrewMember[];

      /*
       * Busca de licenças em lote.
       */
      const crewIds = members.map(
        (member) => member.id
      );

      let licensesByMember: Record<
        string,
        CrewLicenseLite[]
      > = {};

      if (crewIds.length > 0) {
        const {
          data: allLicenses,
          error: licensesError,
        } = await (supabase as any)
          .from("habilitacoes_tripulante")
          .select(`
            id,
            membro_tripulacao_id,
            tipo_habilitacao,
            data_validade,
            CMA,
            validade_cma,
            FS_RH
          `)
          .in(
            "membro_tripulacao_id",
            crewIds
          );

        if (!licensesError) {
          licensesByMember =
            (allLicenses || []).reduce(
              (
                acc: Record<
                  string,
                  CrewLicenseLite[]
                >,
                license: CrewLicenseLite & {
                  membro_tripulacao_id: string;
                }
              ) => {
                if (
                  !acc[
                    license.membro_tripulacao_id
                  ]
                ) {
                  acc[
                    license.membro_tripulacao_id
                  ] = [];
                }

                acc[
                  license.membro_tripulacao_id
                ].push(license);

                return acc;
              },
              {}
            );
        }
      }

      const crewWithRoles = members.map(
        (crew) => ({
          ...crew,
          role: crew.user_id
            ? "Piloto"
            : "Tripulante",
          _licenses:
            licensesByMember[crew.id] || [],
        })
      );

      setCrewMembers(crewWithRoles);
    } catch (error: any) {
      console.error(
        "Erro ao carregar tripulantes:",
        error
      );

      toast({
        title: "Erro ao carregar tripulantes",
        description:
          error?.message ||
          "Não foi possível carregar os tripulantes.",
        variant: "destructive",
      });
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadCrewDetails = async (
    crewId: string
  ) => {
    setLoadingDetails(true);

    try {
      /*
       * HORAS
       */
      const {
        data: hoursData,
        error: hoursError,
      } = await supabase
        .from("horas_voo_tripulante")
        .select(`
          id,
          membro_tripulacao_id,
          aeronave_id,
          horas_totais,
          aeronave:aeronave_id(
            matricula,
            modelo
          )
        `)
        .eq(
          "membro_tripulacao_id",
          crewId
        );

      if (!hoursError) {
        setFlightHours(
          (hoursData || []) as CrewFlightHours[]
        );
      } else {
        setFlightHours([]);
      }

      /*
       * HABILITAÇÕES
       */
      const {
        data: licensesData,
        error: licensesError,
      } = await (supabase as any)
        .from("habilitacoes_tripulante")
        .select(`
          id,
          membro_tripulacao_id,
          tipo_habilitacao,
          data_validade,
          observacao,
          CMA,
          FS_RH,
          validade_cma
        `)
        .eq(
          "membro_tripulacao_id",
          crewId
        )
        .order("criado_em", {
          ascending: false,
        });

      if (!licensesError) {
        setLicenses(
          (licensesData || []) as CrewLicense[]
        );
      } else {
        setLicenses([]);
      }

      /*
       * ESCALA
       *
       * O diário usa PIC/SIC CANAC.
       * Como a estrutura apresentada não mostra uma FK direta para
       * membro_tripulacao, buscamos pelo CANAC.
       */
      const crew = crewMembers.find(
        (member) => member.id === crewId
      );

      const today = new Date()
        .toISOString()
        .slice(0, 10);

      if (crew?.canac) {
        const {
          data: schedulesData,
          error: schedulesError,
        } = await supabase
          .from("lancamentos_diario_bordo")
          .select(`
            id,
            data_registro,
            aerodromo_partida,
            aerodromo_chegada,
            tempo_total,
            natureza_voo,
            confirmado
          `)
          .or(
            `pic_canac.eq.${crew.canac},sic_canac.eq.${crew.canac}`
          )
          .gte(
            "data_registro",
            today
          )
          .order(
            "data_registro",
            {
              ascending: true,
            }
          )
          .limit(10);

        if (!schedulesError) {
          setSchedules(
            (schedulesData ||
              []) as LogbookFlight[]
          );
        } else {
          setSchedules([]);
        }
      } else {
        setSchedules([]);
      }
    } catch (error) {
      console.error(
        "Erro ao carregar detalhes:",
        error
      );

      setFlightHours([]);
      setLicenses([]);
      setSchedules([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  /* --------------------------------------------------------------------------
   * FILTROS
   * ------------------------------------------------------------------------ */

  const filteredCrewMembers = useMemo(() => {
    const term = normalizeText(searchTerm);

    return crewMembers.filter((crew) => {
      const matchesSearch =
        !term ||
        normalizeText(
          crew.nome_completo
        ).includes(term) ||
        normalizeText(
          crew.canac
        ).includes(term);

      const relationship =
        getCrewRelationship(crew);

      const matchesRelationship =
        relationshipFilter === "todos" ||
        relationship === relationshipFilter;

      return (
        matchesSearch &&
        matchesRelationship
      );
    });
  }, [
    crewMembers,
    searchTerm,
    relationshipFilter,
  ]);

  const totalLicensesExpiring = useMemo(() => {
    return crewMembers.reduce(
      (total, crew) => {
        const licenses =
          crew._licenses || [];

        const expiring =
          licenses.filter((license) => {
            const status =
              getLicenseStatus(license);

            return (
              status.type === "expired" ||
              status.type === "critical" ||
              status.type === "warning"
            );
          });

        return total + expiring.length;
      },
      0
    );
  }, [crewMembers]);

  const stats = useMemo(() => {
    const active =
      crewMembers.filter(
        (crew) =>
          normalizeText(
            crew.status
          ) === "ativo"
      ).length;

    const share =
      crewMembers.filter(
        (crew) =>
          getCrewRelationship(crew) ===
          "share"
      ).length;

    const external =
      crewMembers.filter(
        (crew) =>
          getCrewRelationship(crew) ===
          "externo"
      ).length;

    return {
      active,
      share,
      external,
      expiring: totalLicensesExpiring,
    };
  }, [
    crewMembers,
    totalLicensesExpiring,
  ]);

  /* --------------------------------------------------------------------------
   * HABILITAÇÕES
   * ------------------------------------------------------------------------ */

  const saveLicense = async (
    licenseData: Partial<CrewLicense>
  ) => {
    if (!selectedCrew) return;

    const payload = {
      membro_tripulacao_id:
        selectedCrew.id,
      ...licenseData,
    };

    try {
      if (editingLicense) {
        const { error } =
          await (supabase as any)
            .from(
              "habilitacoes_tripulante"
            )
            .update(payload)
            .eq(
              "id",
              editingLicense.id
            );

        if (error) throw error;
      } else {
        const { error } =
          await (supabase as any)
            .from(
              "habilitacoes_tripulante"
            )
            .insert([payload]);

        if (error) throw error;
      }

      toast({
        title:
          "Habilitação salva com sucesso",
      });

      setIsLicenseDialogOpen(false);
      setEditingLicense(null);

      await loadCrewDetails(
        selectedCrew.id
      );

      await loadCrewMembers();
    } catch (error: any) {
      toast({
        title:
          "Erro ao salvar habilitação",
        description:
          error?.message ||
          "Erro inesperado.",
        variant: "destructive",
      });
    }
  };

  const deleteLicense = async (
    licenseId: string
  ) => {
    if (
      !window.confirm(
        "Deseja realmente excluir esta habilitação?"
      )
    ) {
      return;
    }

    try {
      const { error } =
        await (supabase as any)
          .from(
            "habilitacoes_tripulante"
          )
          .delete()
          .eq("id", licenseId);

      if (error) throw error;

      toast({
        title:
          "Habilitação excluída",
      });

      if (selectedCrew) {
        await loadCrewDetails(
          selectedCrew.id
        );
      }

      await loadCrewMembers();
    } catch (error: any) {
      toast({
        title:
          "Erro ao excluir habilitação",
        description:
          error?.message ||
          "Erro inesperado.",
        variant: "destructive",
      });
    }
  };

  /* --------------------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------------------ */

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-5 md:px-6 md:py-7 space-y-6">

          {/* ================================================================
           * HEADER
           * ============================================================= */}

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-center gap-3">

              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  navigate("/")
                }
                className="
                  h-10
                  w-10
                  shrink-0
                  rounded-xl
                  border
                  border-border
                  bg-card
                  hover:bg-accent
                "
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                    Gestão de Tripulação
                  </h1>

                  <Badge
                    variant="outline"
                    className="
                      hidden
                      sm:inline-flex
                      border-primary/20
                      bg-primary/5
                      text-primary
                    "
                  >
                    Operacional
                  </Badge>
                </div>

                <p className="mt-1 text-sm text-muted-foreground">
                  Controle de tripulantes,
                  habilitações, horas e escala.
                </p>
              </div>
            </div>

            <Button
              onClick={() =>
                setActiveMainTab(
                  "registration"
                )
              }
              className="gap-2 rounded-xl"
            >
              <Plus className="h-4 w-4" />
              Novo tripulante
            </Button>
          </div>

          {/* ================================================================
           * INDICADORES
           * ============================================================= */}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

            <StatCard
              icon={
                <UserRoundCheck className="h-5 w-5" />
              }
              label="Tripulantes ativos"
              value={stats.active}
              description="Equipe operacional"
            />

            <StatCard
              icon={
                <BriefcaseBusiness className="h-5 w-5" />
              }
              label="Vinculados à Share"
              value={stats.share}
              description="Equipe interna"
            />

            <StatCard
              icon={
                <UserRoundX className="h-5 w-5" />
              }
              label="Tripulantes externos"
              value={stats.external}
              description="Freelancer / cliente"
            />

            <StatCard
              icon={
                <AlertTriangle className="h-5 w-5" />
              }
              label="Validades próximas"
              value={stats.expiring}
              description="Habilitações / CMA"
              warning={stats.expiring > 0}
            />
          </div>

          {/* ================================================================
           * TABS
           * ============================================================= */}

          <Tabs
            value={activeMainTab}
            onValueChange={(value) =>
              setActiveMainTab(
                value as MainTab
              )
            }
            className="space-y-5"
          >

            <div className="border-b border-border">
              <TabsList
                className="
                  h-auto
                  w-full
                  justify-start
                  gap-1
                  rounded-none
                  bg-transparent
                  p-0
                "
              >
                <TabsTrigger
                  value="members"
                  className="
                    rounded-t-lg
                    rounded-b-none
                    border-b-2
                    border-transparent
                    px-5
                    py-3
                    text-sm
                    data-[state=active]:border-primary
                    data-[state=active]:bg-transparent
                    data-[state=active]:text-foreground
                    data-[state=active]:shadow-none
                  "
                >
                  <Users className="mr-2 h-4 w-4" />
                  Tripulantes
                </TabsTrigger>

                <TabsTrigger
                  value="registration"
                  className="
                    rounded-t-lg
                    rounded-b-none
                    border-b-2
                    border-transparent
                    px-5
                    py-3
                    text-sm
                    data-[state=active]:border-primary
                    data-[state=active]:bg-transparent
                    data-[state=active]:text-foreground
                    data-[state=active]:shadow-none
                  "
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastro
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ==============================================================
             * MEMBROS
             * ============================================================ */}

            <TabsContent
              value="members"
              className="space-y-5"
            >

              {/* FILTROS */}

              <Card className="border-border/70 shadow-sm">
                <CardContent className="p-4">

                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center">

                    <div className="relative flex-1">

                      <Search
                        className="
                          absolute
                          left-3
                          top-1/2
                          h-4
                          w-4
                          -translate-y-1/2
                          text-muted-foreground
                        "
                      />

                      <Input
                        value={searchTerm}
                        onChange={(event) =>
                          setSearchTerm(
                            event.target.value
                          )
                        }
                        placeholder="Buscar por nome ou CANAC..."
                        className="
                          h-11
                          rounded-xl
                          pl-10
                        "
                      />

                    </div>

                    <div className="flex flex-wrap gap-2">

                      <FilterButton
                        active={
                          statusFilter ===
                          "ativo"
                        }
                        onClick={() =>
                          setStatusFilter(
                            "ativo"
                          )
                        }
                      >
                        Ativos
                      </FilterButton>

                      <FilterButton
                        active={
                          statusFilter ===
                          "inativo"
                        }
                        onClick={() =>
                          setStatusFilter(
                            "inativo"
                          )
                        }
                        danger
                      >
                        Inativos
                      </FilterButton>

                      <div className="mx-1 hidden h-8 w-px bg-border sm:block" />

                      <FilterButton
                        active={
                          relationshipFilter ===
                          "todos"
                        }
                        onClick={() =>
                          setRelationshipFilter(
                            "todos"
                          )
                        }
                      >
                        Todos
                      </FilterButton>

                      <FilterButton
                        active={
                          relationshipFilter ===
                          "share"
                        }
                        onClick={() =>
                          setRelationshipFilter(
                            "share"
                          )
                        }
                      >
                        Share
                      </FilterButton>

                      <FilterButton
                        active={
                          relationshipFilter ===
                          "externo"
                        }
                        onClick={() =>
                          setRelationshipFilter(
                            "externo"
                          )
                        }
                      >
                        Externos
                      </FilterButton>

                      <Button
                        variant="outline"
                        size="icon"
                        onClick={
                          loadCrewMembers
                        }
                        disabled={
                          loadingMembers
                        }
                        className="h-11 w-11 rounded-xl"
                        title="Atualizar"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${
                            loadingMembers
                              ? "animate-spin"
                              : ""
                          }`}
                        />
                      </Button>

                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CONTADOR */}

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {filteredCrewMembers.length}{" "}
                    {filteredCrewMembers.length ===
                    1
                      ? "tripulante encontrado"
                      : "tripulantes encontrados"}
                  </p>

                  {searchTerm && (
                    <p className="text-xs text-muted-foreground">
                      Resultado para "{searchTerm}"
                    </p>
                  )}
                </div>

                <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                  <Activity className="h-3.5 w-3.5" />
                  Equipe operacional
                </div>
              </div>

              {/* CARDS */}

              {loadingMembers ? (
                <LoadingGrid />
              ) : filteredCrewMembers.length === 0 ? (
                <EmptyCrewState
                  onCreate={() =>
                    setActiveMainTab(
                      "registration"
                    )
                  }
                />
              ) : (
                <div
                  className="
                    grid
                    grid-cols-1
                    gap-4
                    sm:grid-cols-2
                    lg:grid-cols-3
                    xl:grid-cols-4
                  "
                >
                  {filteredCrewMembers.map(
                    (crew) => (
                      <CrewProfessionalCard
                        key={crew.id}
                        crew={crew}
                        onClick={() =>
                          setSelectedCrew(
                            crew
                          )
                        }
                      />
                    )
                  )}
                </div>
              )}

            </TabsContent>

            {/* ==============================================================
             * CADASTRO
             * ============================================================ */}

            <TabsContent value="registration">
              <Card className="border-border/70 shadow-sm">
                <CardHeader className="border-b border-border/60">
                  <CardTitle>
                    Cadastro de Tripulante
                  </CardTitle>

                  <CardDescription>
                    Cadastre um novo membro da
                    tripulação e seus dados
                    operacionais.
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-6">
                  <CrewRegistrationForm />
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>

          {/* ================================================================
           * PERFIL
           * ============================================================= */}

          <Dialog
            open={!!selectedCrew}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedCrew(null);
                setIsEditingProfile(false);
                setEditingProfileData(null);
              }
            }}
          >
            <DialogContent
              className="
                max-w-6xl
                max-h-[92vh]
                overflow-hidden
                rounded-2xl
                p-0
              "
            >

              {selectedCrew && (
                <div className="flex max-h-[92vh] flex-col">

                  {/* HEADER PERFIL */}

                  <div className="border-b border-border bg-card px-5 py-5 md:px-7">

                    <DialogHeader>
                      <DialogTitle className="sr-only">
                        Perfil de{" "}
                        {selectedCrew.nome_completo}
                      </DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                      <div className="flex items-center gap-4">

                        <Avatar
                          crew={selectedCrew}
                          size="lg"
                        />

                        <div className="min-w-0">

                          <div className="flex flex-wrap items-center gap-2">

                            <h2 className="truncate text-xl font-semibold md:text-2xl">
                              {
                                selectedCrew.nome_completo
                              }
                            </h2>

                            <StatusBadge
                              status={
                                selectedCrew.status
                              }
                            />

                            <RelationshipBadge
                              crew={
                                selectedCrew
                              }
                            />

                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">

                            <span>
                              CANAC{" "}
                              <strong className="text-foreground">
                                {
                                  selectedCrew.canac
                                }
                              </strong>
                            </span>

                            {selectedCrew.tipo_licenca && (
                              <span>
                                {
                                  selectedCrew.tipo_licenca
                                }
                              </span>
                            )}

                          </div>

                        </div>
                      </div>

                      {canEditProfile && (
                        <Button
                          variant="outline"
                          className="gap-2 rounded-xl"
                          onClick={() => {
                            if (
                              isEditingProfile
                            ) {
                              setEditingProfileData(
                                null
                              );
                              setIsEditingProfile(
                                false
                              );
                            } else {
                              setEditingProfileData(
                                {
                                  ...selectedCrew,
                                }
                              );
                              setIsEditingProfile(
                                true
                              );
                            }
                          }}
                        >
                          <Edit className="h-4 w-4" />
                          {isEditingProfile
                            ? "Cancelar"
                            : "Editar perfil"}
                        </Button>
                      )}

                    </div>
                  </div>

                  {/* CONTEÚDO */}

                  <div className="overflow-y-auto p-5 md:p-7">

                    <Tabs
                      defaultValue="profile"
                      className="space-y-5"
                    >

                      <TabsList
                        className="
                          grid
                          h-auto
                          w-full
                          grid-cols-2
                          rounded-xl
                          bg-muted/60
                          p-1
                          sm:grid-cols-4
                        "
                      >

                        <TabsTrigger
                          value="profile"
                          className="rounded-lg py-2.5"
                        >
                          Perfil
                        </TabsTrigger>

                        <TabsTrigger
                          value="hours"
                          className="rounded-lg py-2.5"
                        >
                          Horas de voo
                        </TabsTrigger>

                        <TabsTrigger
                          value="licenses"
                          className="rounded-lg py-2.5"
                        >
                          Habilitações
                        </TabsTrigger>

                        <TabsTrigger
                          value="schedule"
                          className="rounded-lg py-2.5"
                        >
                          Escala
                        </TabsTrigger>

                      </TabsList>

                      {/* ====================================================
                       * PERFIL
                       * ================================================== */}

                      <TabsContent value="profile">

                        {isEditingProfile &&
                        editingProfileData ? (
                          <EditProfileForm
                            crew={
                              editingProfileData
                            }
                            onChange={
                              setEditingProfileData
                            }
                            onSave={async () => {
                              try {
                                const {
                                  error,
                                } =
                                  await supabase
                                    .from(
                                      "membros_tripulacao"
                                    )
                                    .update({
                                      cpf:
                                        editingProfileData.cpf ||
                                        null,

                                      rg:
                                        editingProfileData.rg ||
                                        null,

                                      endereco:
                                        editingProfileData.endereco ||
                                        null,

                                      tipo_licenca:
                                        editingProfileData.tipo_licenca
                                          ? editingProfileData.tipo_licenca.toUpperCase()
                                          : null,
                                    })
                                    .eq(
                                      "id",
                                      editingProfileData.id
                                    );

                                if (error) {
                                  throw error;
                                }

                                const updatedCrew =
                                  {
                                    ...selectedCrew,
                                    ...editingProfileData,
                                    tipo_licenca:
                                      editingProfileData.tipo_licenca
                                        ? editingProfileData.tipo_licenca.toUpperCase()
                                        : null,
                                  };

                                setSelectedCrew(
                                  updatedCrew
                                );

                                setIsEditingProfile(
                                  false
                                );

                                setEditingProfileData(
                                  null
                                );

                                toast({
                                  title:
                                    "Perfil atualizado com sucesso",
                                });

                                await loadCrewMembers();
                              } catch (
                                error: any
                              ) {
                                toast({
                                  title:
                                    "Erro ao salvar perfil",
                                  description:
                                    error?.message ||
                                    "Não foi possível salvar.",
                                  variant:
                                    "destructive",
                                });
                              }
                            }}
                          />
                        ) : (
                          <ProfileOverview
                            crew={selectedCrew}
                          />
                        )}

                      </TabsContent>

                      {/* ====================================================
                       * HORAS
                       * ================================================== */}

                      <TabsContent value="hours">

                        <FlightHoursPanel
                          flightHours={
                            flightHours
                          }
                          loading={
                            loadingDetails
                          }
                        />

                      </TabsContent>

                      {/* ====================================================
                       * HABILITAÇÕES
                       * ================================================== */}

                      <TabsContent value="licenses">

                        <Card className="border-border/70">

                          <CardHeader>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                              <div>
                                <CardTitle className="flex items-center gap-2">
                                  <Award className="h-5 w-5 text-primary" />
                                  Habilitações e licenças
                                </CardTitle>

                                <CardDescription>
                                  Controle de habilitações,
                                  CMA e validade.
                                </CardDescription>
                              </div>

                              <Button
                                className="gap-2 rounded-xl"
                                onClick={() => {
                                  setEditingLicense(
                                    null
                                  );
                                  setIsLicenseDialogOpen(
                                    true
                                  );
                                }}
                              >
                                <Plus className="h-4 w-4" />
                                Nova habilitação
                              </Button>

                            </div>
                          </CardHeader>

                          <CardContent>

                            {loadingDetails ? (
                              <div className="py-12 text-center text-sm text-muted-foreground">
                                Carregando habilitações...
                              </div>
                            ) : licenses.length >
                              0 ? (
                              <div className="space-y-3">
                                {licenses.map(
                                  (license) => (
                                    <LicenseCard
                                      key={
                                        license.id
                                      }
                                      license={
                                        license
                                      }
                                      canEdit={
                                        canEditHabilitacoes
                                      }
                                      onEdit={() => {
                                        setEditingLicense(
                                          license
                                        );
                                        setIsLicenseDialogOpen(
                                          true
                                        );
                                      }}
                                      onDelete={() =>
                                        deleteLicense(
                                          license.id
                                        )
                                      }
                                    />
                                  )
                                )}
                              </div>
                            ) : (
                              <EmptyPanel
                                icon={
                                  <Award className="h-7 w-7" />
                                }
                                title="Nenhuma habilitação cadastrada"
                                description="Cadastre as habilitações e o CMA deste tripulante."
                              />
                            )}

                          </CardContent>
                        </Card>

                      </TabsContent>

                      {/* ====================================================
                       * ESCALA
                       * ================================================== */}

                      <TabsContent value="schedule">

                        <SchedulePanel
                          schedules={
                            schedules
                          }
                          loading={
                            loadingDetails
                          }
                        />

                      </TabsContent>

                    </Tabs>

                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* ================================================================
           * DIALOG HABILITAÇÃO
           * ============================================================= */}

          <Dialog
            open={
              isLicenseDialogOpen
            }
            onOpenChange={(open) => {
              setIsLicenseDialogOpen(
                open
              );

              if (!open) {
                setEditingLicense(
                  null
                );
              }
            }}
          >
            <DialogContent className="max-w-2xl rounded-2xl">

              <DialogHeader>
                <DialogTitle>
                  {editingLicense
                    ? "Editar habilitação"
                    : "Nova habilitação"}
                </DialogTitle>
              </DialogHeader>

              <LicenseForm
                license={
                  editingLicense
                }
                onSave={saveLicense}
                onCancel={() => {
                  setIsLicenseDialogOpen(
                    false
                  );
                  setEditingLicense(
                    null
                  );
                }}
              />

            </DialogContent>
          </Dialog>

        </div>
      </div>
    </Layout>
  );
}

/* ============================================================================
 * STAT CARD
 * ========================================================================== */

function StatCard({
  icon,
  label,
  value,
  description,
  warning = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  description: string;
  warning?: boolean;
}) {
  return (
    <Card
      className={`
        border-border/70
        shadow-sm
        ${
          warning
            ? "border-amber-500/20"
            : ""
        }
      `}
    >
      <CardContent className="p-4">

        <div className="flex items-start justify-between gap-3">

          <div className="min-w-0">

            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>

            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {value}
            </p>

            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {description}
            </p>

          </div>

          <div
            className={`
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              ${
                warning
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-primary/10 text-primary"
              }
            `}
          >
            {icon}
          </div>

        </div>

      </CardContent>
    </Card>
  );
}

/* ============================================================================
 * FILTER BUTTON
 * ========================================================================== */

function FilterButton({
  children,
  active,
  danger = false,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={`
        h-11
        rounded-xl
        px-4
        text-sm
        ${
          active
            ? danger
              ? "border-red-500/30 bg-red-500/10 text-red-400"
              : "border-primary/30 bg-primary/10 text-primary"
            : ""
        }
      `}
    >
      {children}
    </Button>
  );
}

/* ============================================================================
 * AVATAR
 * ========================================================================== */

function Avatar({
  crew,
  size = "md",
}: {
  crew: CrewMember;
  size?: "md" | "lg";
}) {
  const dimensions =
    size === "lg"
      ? "h-16 w-16"
      : "h-12 w-12";

  return crew.url_avatar ? (
    <img
      src={crew.url_avatar}
      alt={crew.nome_completo}
      className={`
        ${dimensions}
        shrink-0
        rounded-2xl
        object-cover
        ring-1
        ring-border
      `}
    />
  ) : (
    <div
      className={`
        ${dimensions}
        shrink-0
        rounded-2xl
        bg-primary/10
        flex
        items-center
        justify-center
        text-primary
        ring-1
        ring-primary/10
      `}
    >
      <User
        className={
          size === "lg"
            ? "h-7 w-7"
            : "h-5 w-5"
        }
      />
    </div>
  );
}

/* ============================================================================
 * CARD PROFISSIONAL
 * ========================================================================== */

function CrewProfessionalCard({
  crew,
  onClick,
}: {
  crew: CrewMember;
  onClick: () => void;
}) {
  const licenses =
    crew._licenses || [];

  const hasExpired =
    licenses.some(
      (license) =>
        getLicenseStatus(
          license
        ).type === "expired"
    );

  const hasWarning =
    licenses.some((license) => {
      const status =
        getLicenseStatus(
          license
        );

      return (
        status.type === "warning" ||
        status.type === "critical"
      );
    });

  return (
    <button
      type="button"
      onClick={onClick}
      className="
        group
        w-full
        text-left
        focus:outline-none
      "
    >
      <Card
        className="
          h-full
          border-border/70
          bg-card
          shadow-sm
          transition-all
          duration-200
          hover:-translate-y-0.5
          hover:border-primary/30
          hover:shadow-lg
          focus-visible:ring-2
          focus-visible:ring-primary
        "
      >
        <CardContent className="p-4">

          <div className="flex items-start justify-between gap-3">

            <Avatar
              crew={crew}
              size="md"
            />

            <ChevronRight
              className="
                h-4
                w-4
                text-muted-foreground
                transition-transform
                group-hover:translate-x-1
              "
            />

          </div>

          <div className="mt-4">

            <h3 className="truncate font-semibold">
              {crew.nome_completo}
            </h3>

            <p className="mt-0.5 text-xs text-muted-foreground">
              CANAC{" "}
              <span className="font-medium text-foreground">
                {crew.canac}
              </span>
            </p>

          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">

            <RelationshipBadge
              crew={crew}
            />

            {crew.tipo_licenca && (
              <Badge
                variant="secondary"
                className="font-medium"
              >
                {crew.tipo_licenca}
              </Badge>
            )}

          </div>

          <div className="mt-4 border-t border-border/60 pt-3">

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-2 text-xs text-muted-foreground">

                {hasExpired ? (
                  <>
                    <XCircle className="h-3.5 w-3.5 text-red-400" />
                    <span className="text-red-400">
                      Habilitação vencida
                    </span>
                  </>
                ) : hasWarning ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-amber-400">
                      Validade próxima
                    </span>
                  </>
                ) : licenses.length >
                  0 ? (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span>
                      Documentação regular
                    </span>
                  </>
                ) : (
                  <>
                    <FileText className="h-3.5 w-3.5" />
                    <span>
                      Sem habilitações
                    </span>
                  </>
                )}

              </div>

              <StatusBadge
                status={
                  crew.status
                }
              />

            </div>

          </div>

        </CardContent>
      </Card>
    </button>
  );
}

/* ============================================================================
 * PERFIL
 * ========================================================================== */

function ProfileOverview({
  crew,
}: {
  crew: CrewMember;
}) {
  const fields = [
    {
      icon: FileText,
      label: "CPF",
      value: crew.cpf,
    },
    {
      icon: FileText,
      label: "RG",
      value: crew.rg,
    },
    {
      icon: Calendar,
      label: "Nascimento",
      value: crew.data_nascimento
        ? formatDateToBR(
            crew.data_nascimento
          )
        : null,
    },
    {
      icon: Calendar,
      label: "Admissão",
      value: crew.data_admissao
        ? formatDateToBR(
            crew.data_admissao
          )
        : null,
    },
    {
      icon: Mail,
      label: "E-mail",
      value: crew.email,
    },
    {
      icon: Phone,
      label: "Telefone",
      value: crew.telefone,
    },
  ];

  return (
    <div className="space-y-5">

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">
            Dados pessoais
          </CardTitle>
        </CardHeader>

        <CardContent>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

            {fields.map(
              ({
                icon: Icon,
                label,
                value,
              }) => (
                <InfoItem
                  key={label}
                  icon={
                    <Icon className="h-4 w-4" />
                  }
                  label={label}
                  value={value}
                />
              )
            )}

          </div>

        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-base">
              Documentação
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">

            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3">
              <span className="text-sm text-muted-foreground">
                Tipo de licença
              </span>

              <Badge variant="secondary">
                {crew.tipo_licenca ||
                  "Não informado"}
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3">
              <span className="text-sm text-muted-foreground">
                Vínculo
              </span>

              <RelationshipBadge
                crew={crew}
              />
            </div>

          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-base">
              Endereço
            </CardTitle>
          </CardHeader>

          <CardContent>

            <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">

              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />

              <p className="text-sm leading-6">
                {crew.endereco ||
                  "Endereço não informado."}
              </p>

            </div>

          </CardContent>
        </Card>

      </div>

    </div>
  );
}

/* ============================================================================
 * INFO ITEM
 * ========================================================================== */

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">

      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>

      <p className="mt-2 break-words text-sm font-medium">
        {value || (
          <span className="font-normal italic text-muted-foreground">
            Não informado
          </span>
        )}
      </p>

    </div>
  );
}

/* ============================================================================
 * HORAS
 * ========================================================================== */

function FlightHoursPanel({
  flightHours,
  loading,
}: {
  flightHours: CrewFlightHours[];
  loading: boolean;
}) {
  const totalHours =
    flightHours.reduce(
      (total, item) =>
        total +
        Number(
          item.horas_totais || 0
        ),
      0
    );

  return (
    <Card className="border-border/70">

      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Horas de voo
        </CardTitle>

        <CardDescription>
          Total acumulado por aeronave.
        </CardDescription>
      </CardHeader>

      <CardContent>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Carregando horas de voo...
          </div>
        ) : flightHours.length === 0 ? (
          <EmptyPanel
            icon={
              <Clock className="h-7 w-7" />
            }
            title="Nenhuma hora registrada"
            description="Não existem horas de voo registradas para este tripulante."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/60">

            <Table>

              <TableHeader>
                <TableRow className="bg-muted/30">

                  <TableHead>
                    Aeronave
                  </TableHead>

                  <TableHead className="text-right">
                    Horas
                  </TableHead>

                </TableRow>
              </TableHeader>

              <TableBody>

                {flightHours.map(
                  (item) => (
                    <TableRow
                      key={item.id}
                    >

                      <TableCell>

                        <div className="flex items-center gap-3">

                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Plane className="h-4 w-4" />
                          </div>

                          <div>

                            <p className="font-medium">
                              {
                                item.aeronave
                                  ?.matricula ||
                                "Não informado"
                              }
                            </p>

                            <p className="text-xs text-muted-foreground">
                              {
                                item.aeronave
                                  ?.modelo ||
                                "Modelo não informado"
                              }
                            </p>

                          </div>

                        </div>

                      </TableCell>

                      <TableCell className="text-right font-semibold">
                        {Number(
                          item.horas_totais ||
                            0
                        ).toFixed(1)}
                        h
                      </TableCell>

                    </TableRow>
                  )
                )}

                <TableRow className="bg-muted/40 font-semibold">

                  <TableCell>
                    TOTAL GERAL
                  </TableCell>

                  <TableCell className="text-right">
                    {totalHours.toFixed(
                      1
                    )}
                    h
                  </TableCell>

                </TableRow>

              </TableBody>

            </Table>

          </div>
        )}

      </CardContent>

    </Card>
  );
}

/* ============================================================================
 * LICENSE CARD
 * ========================================================================== */

function LicenseCard({
  license,
  canEdit,
  onEdit,
  onDelete,
}: {
  license: CrewLicense;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status =
    getLicenseStatus(
      license
    );

  const statusClass =
    status.type === "expired"
      ? "border-red-500/30 bg-red-500/5"
      : status.type === "critical"
      ? "border-red-500/20 bg-red-500/5"
      : status.type === "warning"
      ? "border-amber-500/30 bg-amber-500/5"
      : "border-border/60 bg-card";

  return (
    <div
      className={`
        rounded-xl
        border
        p-4
        ${statusClass}
      `}
    >

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-2">

            <h3 className="font-semibold">
              {license.tipo_habilitacao}
            </h3>

            <LicenseStatusBadge
              status={status}
            />

          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">

            {license.CMA && (
              <InfoLine
                label="Classe CMA"
                value={
                  license.CMA
                }
              />
            )}

            {license.FS_RH && (
              <InfoLine
                label="FS/RH"
                value={
                  license.FS_RH
                }
              />
            )}

            {license.validade_cma && (
              <InfoLine
                label="Validade CMA"
                value={formatDateToBR(
                  license.validade_cma
                )}
              />
            )}

            {!license.CMA &&
              license.data_validade && (
                <InfoLine
                  label="Validade"
                  value={formatDateToBR(
                    license.data_validade
                  )}
                />
              )}

          </div>

          {license.observacao && (
            <p className="mt-3 rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
              {license.observacao}
            </p>
          )}

        </div>

        <div className="flex shrink-0 gap-2">

          {canEdit && (
            <Button
              variant="outline"
              size="icon"
              onClick={onEdit}
              className="h-9 w-9 rounded-lg"
              title="Editar"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}

          {canEdit && (
            <Button
              variant="outline"
              size="icon"
              onClick={onDelete}
              className="
                h-9
                w-9
                rounded-lg
                text-red-400
                hover:border-red-500/30
                hover:bg-red-500/10
                hover:text-red-400
              "
              title="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

        </div>

      </div>

    </div>
  );
}

/* ============================================================================
 * LICENSE STATUS
 * ========================================================================== */

function LicenseStatusBadge({
  status,
}: {
  status: ReturnType<
    typeof getLicenseStatus
  >;
}) {
  if (status.type === "expired") {
    return (
      <Badge
        variant="outline"
        className="
          gap-1.5
          border-red-500/30
          bg-red-500/10
          text-red-400
        "
      >
        <XCircle className="h-3.5 w-3.5" />
        Vencida
      </Badge>
    );
  }

  if (
    status.type === "critical"
  ) {
    return (
      <Badge
        variant="outline"
        className="
          gap-1.5
          border-red-500/30
          bg-red-500/10
          text-red-400
        "
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        {status.label}
      </Badge>
    );
  }

  if (
    status.type === "warning"
  ) {
    return (
      <Badge
        variant="outline"
        className="
          gap-1.5
          border-amber-500/30
          bg-amber-500/10
          text-amber-400
        "
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        {status.label}
      </Badge>
    );
  }

  if (
    status.type === "valid"
  ) {
    return (
      <Badge
        variant="outline"
        className="
          gap-1.5
          border-emerald-500/30
          bg-emerald-500/10
          text-emerald-400
        "
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Válida
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="
        border-border
        text-muted-foreground
      "
    >
      Sem validade
    </Badge>
  );
}

/* ============================================================================
 * INFO LINE
 * ========================================================================== */

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-muted/30 px-3 py-2">

      <span className="text-xs text-muted-foreground">
        {label}
      </span>

      <p className="mt-0.5 font-medium">
        {value}
      </p>

    </div>
  );
}

/* ============================================================================
 * ESCALA
 * ========================================================================== */

function SchedulePanel({
  schedules,
  loading,
}: {
  schedules: LogbookFlight[];
  loading: boolean;
}) {
  return (
    <Card className="border-border/70">

      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Próximas escalas
        </CardTitle>

        <CardDescription>
          Próximos lançamentos de voo encontrados
          para este tripulante.
        </CardDescription>
      </CardHeader>

      <CardContent>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Carregando escala...
          </div>
        ) : schedules.length ===
          0 ? (
          <EmptyPanel
            icon={
              <Calendar className="h-7 w-7" />
            }
            title="Nenhuma escala encontrada"
            description="Não existem voos futuros registrados para este tripulante."
          />
        ) : (
          <div className="space-y-3">

            {schedules.map(
              (schedule) => {

                const date =
                  new Date(
                    `${schedule.data_registro}T00:00:00`
                  );

                return (
                  <div
                    key={
                      schedule.id
                    }
                    className="
                      flex
                      flex-col
                      gap-4
                      rounded-xl
                      border
                      border-border/60
                      bg-card
                      p-4
                      sm:flex-row
                      sm:items-center
                      sm:justify-between
                    "
                  >

                    <div className="flex items-center gap-4">

                      <div className="
                        flex
                        h-14
                        w-14
                        shrink-0
                        flex-col
                        items-center
                        justify-center
                        rounded-xl
                        bg-primary/10
                        text-primary
                      ">

                        <span className="text-lg font-bold leading-none">
                          {date.getDate()}
                        </span>

                        <span className="mt-1 text-[10px] font-medium uppercase">
                          {date.toLocaleDateString(
                            "pt-BR",
                            {
                              month:
                                "short",
                            }
                          )}
                        </span>

                      </div>

                      <div>

                        <p className="font-semibold">
                          {
                            schedule.aerodromo_partida
                          }{" "}
                          <span className="text-muted-foreground">
                            →
                          </span>{" "}
                          {
                            schedule.aerodromo_chegada
                          }
                        </p>

                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">

                          <span>
                            {
                              schedule.natureza_voo ||
                              "Natureza não informada"
                            }
                          </span>

                          {schedule.tempo_total !==
                            undefined &&
                            schedule.tempo_total !==
                              null && (
                              <span>
                                {
                                  schedule.tempo_total
                                }
                              </span>
                            )}

                        </div>

                      </div>

                    </div>

                    <Badge
                      variant={
                        schedule.confirmado
                          ? "default"
                          : "secondary"
                      }
                      className="w-fit"
                    >
                      {schedule.confirmado
                        ? "Confirmado"
                        : "Pendente"}
                    </Badge>

                  </div>
                );
              }
            )}

          </div>
        )}

      </CardContent>

    </Card>
  );
}

/* ============================================================================
 * EDIT PROFILE
 * ========================================================================== */

function EditProfileForm({
  crew,
  onChange,
  onSave,
}: {
  crew: CrewMember;
  onChange: (
    crew: CrewMember
  ) => void;
  onSave: () => Promise<void>;
}) {
  const [isSaving, setIsSaving] =
    useState(false);

  return (
    <Card className="border-border/70">

      <CardHeader>
        <CardTitle className="text-base">
          Editar dados do perfil
        </CardTitle>

        <CardDescription>
          Atualize os dados administrativos
          permitidos para este tripulante.
        </CardDescription>
      </CardHeader>

      <CardContent>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          <div className="space-y-2">
            <Label>CPF</Label>

            <Input
              value={
                crew.cpf || ""
              }
              onChange={(event) =>
                onChange({
                  ...crew,
                  cpf:
                    event.target
                      .value,
                })
              }
              placeholder="000.000.000-00"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label>RG</Label>

            <Input
              value={
                crew.rg || ""
              }
              onChange={(event) =>
                onChange({
                  ...crew,
                  rg:
                    event.target
                      .value,
                })
              }
              placeholder="00.000.000-0"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Tipo de licença
            </Label>

            <Select
              value={
                crew.tipo_licenca ||
                ""
              }
              onValueChange={(
                value
              ) =>
                onChange({
                  ...crew,
                  tipo_licenca:
                    value.toUpperCase(),
                })
              }
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>

              <SelectContent>
                {TIPOS_LICENCA.map(
                  (type) => (
                    <SelectItem
                      key={
                        type.value
                      }
                      value={
                        type.value
                      }
                    >
                      {type.label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>
              Endereço
            </Label>

            <Input
              value={
                crew.endereco ||
                ""
              }
              onChange={(event) =>
                onChange({
                  ...crew,
                  endereco:
                    event.target
                      .value,
                })
              }
              placeholder="Rua, número, bairro, cidade"
              className="rounded-xl"
            />
          </div>

        </div>

        <div className="mt-6 flex flex-col justify-end gap-2 border-t border-border/60 pt-5 sm:flex-row">

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onChange({
                ...crew,
              })
            }
            className="rounded-xl"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            disabled={isSaving}
            onClick={async () => {
              setIsSaving(true);

              try {
                await onSave();
              } finally {
                setIsSaving(
                  false
                );
              }
            }}
            className="rounded-xl"
          >
            {isSaving
              ? "Salvando..."
              : "Salvar alterações"}
          </Button>

        </div>

      </CardContent>

    </Card>
  );
}

/* ============================================================================
 * LICENSE FORM
 * ========================================================================== */

function LicenseForm({
  license,
  onSave,
  onCancel,
}: {
  license: CrewLicense | null;
  onSave: (
    data: Partial<CrewLicense>
  ) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] =
    useState<Partial<CrewLicense>>(
      license || {
        tipo_habilitacao: "",
        data_validade: "",
        observacao: "",
        CMA: "",
        FS_RH: "",
        validade_cma: "",
      }
    );

  const handleSubmit = (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    const tipo =
      String(
        formData.tipo_habilitacao ||
          ""
      ).trim();

    if (!tipo) {
      toast({
        title:
          "Informe o tipo de habilitação",
        variant:
          "destructive",
      });

      return;
    }

    if (
      tipo.toUpperCase() ===
      "CMA"
    ) {
      if (
        !formData.validade_cma
      ) {
        toast({
          title:
            "Preencha a validade do CMA",
          variant:
            "destructive",
        });

        return;
      }
    } else {
      if (
        !formData.data_validade
      ) {
        toast({
          title:
            "Preencha a data de validade",
          variant:
            "destructive",
        });

        return;
      }
    }

    onSave({
      ...formData,
      tipo_habilitacao:
        tipo.toUpperCase(),
    });
  };

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="space-y-5"
    >

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        <div className="sm:col-span-2 space-y-2">

          <Label>
            Tipo de habilitação *
          </Label>

          <Input
            value={
              formData.tipo_habilitacao ||
              ""
            }
            onChange={(event) =>
              setFormData({
                ...formData,
                tipo_habilitacao:
                  event.target.value,
              })
            }
            placeholder="Ex.: PP, PC, IFR, MLTE, CMA"
            className="rounded-xl"
          />

        </div>

        {String(
          formData.tipo_habilitacao ||
            ""
        ).toUpperCase() ===
        "CMA" ? (
          <>
            <div className="space-y-2">

              <Label>
                Classe CMA
              </Label>

              <Select
                value={
                  formData.CMA ||
                  ""
                }
                onValueChange={(
                  value
                ) =>
                  setFormData({
                    ...formData,
                    CMA: value,
                  })
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione a classe" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="primeira">
                    1ª Classe
                  </SelectItem>

                  <SelectItem value="segunda">
                    2ª Classe
                  </SelectItem>
                </SelectContent>
              </Select>

            </div>

            <div className="space-y-2">

              <Label>
                Tipo sanguíneo
              </Label>

              <Select
                value={
                  formData.FS_RH ||
                  ""
                }
                onValueChange={(
                  value
                ) =>
                  setFormData({
                    ...formData,
                    FS_RH: value,
                  })
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>

                <SelectContent>
                  {[
                    "A+",
                    "A-",
                    "B+",
                    "B-",
                    "AB+",
                    "AB-",
                    "O+",
                    "O-",
                  ].map(
                    (type) => (
                      <SelectItem
                        key={
                          type
                        }
                        value={
                          type
                        }
                      >
                        {type}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>

            </div>

            <div className="sm:col-span-2 space-y-2">

              <Label>
                Validade CMA *
              </Label>

              <Input
                type="date"
                value={
                  formData.validade_cma ||
                  ""
                }
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    validade_cma:
                      event.target
                        .value,
                  })
                }
                className="rounded-xl"
              />

            </div>
          </>
        ) : (
          <div className="sm:col-span-2 space-y-2">

            <Label>
              Data de validade *
            </Label>

            <Input
              type="date"
              value={
                formData.data_validade ||
                ""
              }
              onChange={(event) =>
                setFormData({
                  ...formData,
                  data_validade:
                    event.target
                      .value,
                })
              }
              required
              className="rounded-xl"
            />

          </div>
        )}

        <div className="sm:col-span-2 space-y-2">

          <Label>
            Observações
          </Label>

          <Textarea
            value={
              formData.observacao ||
              ""
            }
            onChange={(event) =>
              setFormData({
                ...formData,
                observacao:
                  event.target
                    .value,
              })
            }
            rows={4}
            placeholder="Informações adicionais sobre a habilitação..."
            className="rounded-xl resize-none"
          />

        </div>

      </div>

      <div className="flex flex-col justify-end gap-2 border-t border-border/60 pt-5 sm:flex-row">

        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="rounded-xl"
        >
          Cancelar
        </Button>

        <Button
          type="submit"
          className="rounded-xl"
        >
          Salvar habilitação
        </Button>

      </div>

    </form>
  );
}

/* ============================================================================
 * EMPTY
 * ========================================================================== */

function EmptyCrewState({
  onCreate,
}: {
  onCreate: () => void;
}) {
  return (
    <Card className="border-dashed border-border/80">

      <CardContent className="flex flex-col items-center justify-center py-16 text-center">

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Users className="h-7 w-7" />
        </div>

        <h3 className="mt-4 font-semibold">
          Nenhum tripulante encontrado
        </h3>

        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Ajuste os filtros de pesquisa ou
          cadastre um novo membro da
          tripulação.
        </p>

        <Button
          onClick={onCreate}
          className="mt-5 gap-2 rounded-xl"
        >
          <Plus className="h-4 w-4" />
          Cadastrar tripulante
        </Button>

      </CardContent>

    </Card>
  );
}

function EmptyPanel({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 py-12 text-center">

      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {icon}
      </div>

      <h3 className="mt-3 font-medium">
        {title}
      </h3>

      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {description}
      </p>

    </div>
  );
}

/* ============================================================================
 * LOADING
 * ========================================================================== */

function LoadingGrid() {
  return (
    <div
      className="
        grid
        grid-cols-1
        gap-4
        sm:grid-cols-2
        lg:grid-cols-3
        xl:grid-cols-4
      "
    >
      {Array.from({
        length: 8,
      }).map((_, index) => (
        <Card
          key={index}
          className="border-border/70"
        >
          <CardContent className="animate-pulse p-4">

            <div className="h-12 w-12 rounded-2xl bg-muted" />

            <div className="mt-4 h-4 w-3/4 rounded bg-muted" />

            <div className="mt-2 h-3 w-1/2 rounded bg-muted" />

            <div className="mt-4 flex gap-2">

              <div className="h-6 w-20 rounded-full bg-muted" />

              <div className="h-6 w-16 rounded-full bg-muted" />

            </div>

            <div className="mt-5 border-t border-border/60 pt-3">

              <div className="h-3 w-2/3 rounded bg-muted" />

            </div>

          </CardContent>
        </Card>
      ))}
    </div>
  );
}