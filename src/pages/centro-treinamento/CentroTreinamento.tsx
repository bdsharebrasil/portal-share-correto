import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  GraduationCap,
  Plus,
  Radio,
  UsersRound,
  Video,
  Clock3,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";

import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";

import {
  criarReuniaoTreinamento,
  listarReunioesTreinamento,
  type TrainingMeeting,
} from "@/components/centro-treinamento/trainingService";

/* ============================================================
   ÁREAS DO CENTRO DE TREINAMENTO
   ============================================================ */

const menuCards = [
  {
    title: "Sala de reunião",
    description:
      "Reúna a equipe em uma sala virtual com vídeo, compartilhamento de tela e recursos colaborativos.",
    eyebrow: "Ao vivo",
    href: "/centro-treinamento/sala-reuniao",
    icon: Video,
    iconClass:
      "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-400/15",
  },
  {
    title: "Treinamento",
    description:
      "Organize trilhas de capacitação, conteúdos, materiais e processos de desenvolvimento da equipe.",
    eyebrow: "Em breve",
    href: "/centro-treinamento/treinamento",
    icon: GraduationCap,
    iconClass:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-muted-foreground dark:border-slate-400/15",
  },
  {
    title: "Manual do sistema",
    description:
      "Consulte orientações operacionais, procedimentos e tutoriais para utilização do Share Brasil.",
    eyebrow: "Disponível",
    href: "/centro-treinamento/manual",
    icon: BookOpen,
    iconClass:
      "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-400/15",
  },
] as const;

/* ============================================================
   HELPERS
   ============================================================ */

function getMeetingStatus(status: TrainingMeeting["status"]) {
  switch (status) {
    case "encerrada":
      return {
        label: "Encerrada",
        className:
          "border-slate-200 bg-slate-100 text-muted-foreground dark:border-border dark:bg-card-secondary/70 dark:text-muted-foreground",
      };

    case "em_andamento":
      return {
        label: "Ao vivo",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400",
      };

    default:
      return {
        label: "Agendada",
        className:
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400",
      };
  }
}

function formatMeetingDate(date: string) {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ============================================================
   COMPONENTE
   ============================================================ */

export default function CentroTreinamento() {
  const { roles } = useAuth();
  const navigate = useNavigate();

  const [meetings, setMeetings] = useState<TrainingMeeting[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [agendadaPara, setAgendadaPara] = useState("");

  const canCreate =
    roles.includes("admin") || roles.includes("gestor_master");

  const upcomingMeetings = useMemo(() => {
    return [...meetings].sort((a, b) => {
      const dateA = a.agendada_para
        ? new Date(a.agendada_para).getTime()
        : Number.MAX_SAFE_INTEGER;

      const dateB = b.agendada_para
        ? new Date(b.agendada_para).getTime()
        : Number.MAX_SAFE_INTEGER;

      return dateA - dateB;
    });
  }, [meetings]);

  async function loadMeetings() {
    setLoading(true);

    try {
      const data = await listarReunioesTreinamento();
      setMeetings(data);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as reuniões."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMeetings();
  }, []);

  async function createMeeting(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!titulo.trim()) {
      toast.error("Informe o título da reunião.");
      return;
    }

    setSaving(true);

    try {
      const meeting = await criarReuniaoTreinamento({
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        agendada_para: agendadaPara
          ? new Date(agendadaPara).toISOString()
          : null,
      });

      setDialogOpen(false);
      setTitulo("");
      setDescricao("");
      setAgendadaPara("");

      toast.success("Reunião criada com sucesso.");

      navigate(`/centro-treinamento/sala-reuniao/${meeting.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a reunião."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-[1400px] space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        {/* ======================================================
            CABEÇALHO
            ====================================================== */}

        <section className="share-card overflow-hidden">
          <div className="flex flex-col gap-6 px-6 py-7 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/15 dark:bg-blue-500/10 dark:text-blue-400">
                  <GraduationCap className="size-4.5" />
                </span>

                <span className="section-label">
                  Centro de treinamento
                </span>
              </div>

              <h1 className="section-title text-2xl sm:text-3xl">
                Aprender, reunir e operar melhor.
              </h1>

              <p className="section-subtitle mt-2 max-w-2xl text-sm leading-6">
                Um ambiente central para reuniões, treinamentos,
                procedimentos e materiais de apoio da equipe Share Brasil.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <div className="hidden items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground sm:flex">
                <UsersRound className="size-4" />
                <span>Ambiente interno</span>
              </div>

              {canCreate && (
                <Button
                  onClick={() => setDialogOpen(true)}
                  className="h-10 rounded-lg px-4"
                >
                  <Plus className="size-4" />
                  Nova reunião
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* ======================================================
            RESUMO
            ====================================================== */}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="share-card">
            <div className="flex items-center gap-4 p-5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/15 dark:bg-blue-500/10 dark:text-blue-400">
                <Radio className="size-4.5" />
              </div>

              <div className="min-w-0">
                <p className="section-label">Salas</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  {meetings.length}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  reuniões cadastradas
                </p>
              </div>
            </div>
          </div>

          <div className="share-card">
            <div className="flex items-center gap-4 p-5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 dark:border-border dark:bg-card-secondary/70 dark:text-muted-foreground">
                <CalendarDays className="size-4.5" />
              </div>

              <div className="min-w-0">
                <p className="section-label">Agenda</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  {upcomingMeetings.filter(
                    (meeting) => meeting.status !== "encerrada"
                  ).length}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  salas ativas ou agendadas
                </p>
              </div>
            </div>
          </div>

          <div className="share-card sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-4 p-5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/15 dark:bg-sky-500/10 dark:text-sky-400">
                <BookOpen className="size-4.5" />
              </div>

              <div className="min-w-0">
                <p className="section-label">Conteúdo</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  3
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  áreas disponíveis no centro
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================
            ÁREAS PRINCIPAIS
            ====================================================== */}

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="section-label">Centro de treinamento</p>
              <h2 className="section-title mt-1 text-xl">
                Áreas principais
              </h2>
              <p className="section-subtitle mt-1">
                Acesse os recursos disponíveis para a equipe.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {menuCards.map((menu) => {
              const Icon = menu.icon;

              return (
                <Link
                  key={menu.title}
                  to={menu.href}
                  className="group block"
                >
                  <Card className="share-card h-full border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div
                          className={`flex size-11 items-center justify-center rounded-xl border ${menu.iconClass}`}
                        >
                          <Icon className="size-5" />
                        </div>

                        <Badge
                          variant="outline"
                          className="border-border bg-secondary text-xs font-medium text-muted-foreground"
                        >
                          {menu.eyebrow}
                        </Badge>
                      </div>

                      <CardTitle className="pt-3 text-base font-semibold tracking-tight">
                        {menu.title}
                      </CardTitle>

                      <CardDescription className="text-sm leading-6">
                        {menu.description}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-1">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                        Acessar área
                        <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ======================================================
            REUNIÕES
            ====================================================== */}

        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-label">Agenda de reuniões</p>

              <h2 className="section-title mt-1 text-xl">
                Próximas salas
              </h2>

              <p className="section-subtitle mt-1">
                Reuniões e encontros programados para a equipe.
              </p>
            </div>

            {canCreate && (
              <Button
                variant="outline"
                onClick={() => setDialogOpen(true)}
                className="h-9 rounded-lg"
              >
                <Plus className="size-4" />
                Criar reunião
              </Button>
            )}
          </div>

          {loading ? (
            <div className="share-card">
              <div className="flex min-h-[180px] items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-3 size-7 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                  <p className="text-sm text-muted-foreground">
                    Carregando reuniões...
                  </p>
                </div>
              </div>
            </div>
          ) : upcomingMeetings.length === 0 ? (
            <div className="share-card">
              <div className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center">
                <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground">
                  <CalendarDays className="size-5" />
                </div>

                <h3 className="mt-4 text-sm font-semibold">
                  Nenhuma reunião cadastrada
                </h3>

                <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                  Quando uma reunião for criada, ela aparecerá aqui com
                  data, horário e status.
                </p>

                {canCreate && (
                  <Button
                    variant="outline"
                    className="mt-4 rounded-lg"
                    onClick={() => setDialogOpen(true)}
                  >
                    <Plus className="size-4" />
                    Criar primeira reunião
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingMeetings.map((meeting) => {
                const status = getMeetingStatus(meeting.status);

                return (
                  <Card
                    key={meeting.id}
                    className="share-card overflow-hidden"
                  >
                    <CardContent className="p-0">
                      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                          <div className="hidden size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground sm:flex">
                            {meeting.status === "em_andamento" ? (
                              <Radio className="size-4" />
                            ) : (
                              <CalendarDays className="size-4" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-semibold">
                                {meeting.titulo}
                              </h3>

                              <Badge
                                variant="outline"
                                className={`font-medium ${status.className}`}
                              >
                                {status.label}
                              </Badge>
                            </div>

                            <p className="mt-1 line-clamp-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                              {meeting.descricao ||
                                "Sala aberta para treinamento da equipe."}
                            </p>

                            {meeting.agendada_para && (
                              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                  <Clock3 className="size-3.5" />
                                  {formatMeetingDate(
                                    meeting.agendada_para
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <Link
                          to={`/centro-treinamento/sala-reuniao/${meeting.id}`}
                          className="shrink-0"
                        >
                          <Button
                            variant={
                              meeting.status === "em_andamento"
                                ? "default"
                                : "outline"
                            }
                            className="h-9 rounded-lg"
                          >
                            {meeting.status === "em_andamento"
                              ? "Entrar agora"
                              : "Abrir sala"}

                            <ChevronRight className="size-4" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ========================================================
          MODAL — NOVA REUNIÃO
          ======================================================== */}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={createMeeting}>
            <DialogHeader>
              <DialogTitle className="text-xl">
                Nova sala de reunião
              </DialogTitle>

              <DialogDescription className="leading-6">
                Defina as informações da sala. Depois de criada, ela
                será aberta para que você possa compartilhar o acesso
                com a equipe.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 py-6">
              <div className="space-y-2">
                <Label htmlFor="reuniao-titulo">Título</Label>

                <Input
                  id="reuniao-titulo"
                  value={titulo}
                  onChange={(event) =>
                    setTitulo(event.target.value)
                  }
                  placeholder="Ex.: Onboarding do processo FAA"
                  required
                  minLength={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reuniao-descricao">
                  Descrição
                </Label>

                <Textarea
                  id="reuniao-descricao"
                  value={descricao}
                  onChange={(event) =>
                    setDescricao(event.target.value)
                  }
                  placeholder="Informe o objetivo e as orientações para os participantes."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reuniao-data">
                  Agendar para
                  <span className="ml-1 font-normal text-muted-foreground">
                    (opcional)
                  </span>
                </Label>

                <Input
                  id="reuniao-data"
                  type="datetime-local"
                  value={agendadaPara}
                  onChange={(event) =>
                    setAgendadaPara(event.target.value)
                  }
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>

              <Button type="submit" disabled={saving}>
                {saving ? "Criando..." : "Criar e abrir sala"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}