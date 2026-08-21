import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, CalendarDays, ChevronRight, GraduationCap, Plus, Radio, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { criarReuniaoTreinamento, listarReunioesTreinamento, type TrainingMeeting } from "@/components/centro-treinamento/trainingService";

const menuCards = [
  { title: "Sala de reunião", description: "Reuniões por vídeo com câmera opcional, compartilhamento de tela e lousa colaborativa.", eyebrow: "Ao vivo", to: "/centro-treinamento/sala-reuniao", icon: Radio, accent: "from-amber-300/20 via-amber-200/5 to-transparent" },
  { title: "Treinamento", description: "Organize conteúdos, trilhas e materiais de capacitação para a equipe.", eyebrow: "Em breve", to: "/centro-treinamento/treinamento", icon: GraduationCap, accent: "from-sky-300/20 via-sky-200/5 to-transparent" },
  { title: "Manual do sistema", description: "Consulte as orientações operacionais e os tutoriais do Share Brasil.", eyebrow: "Disponível", to: "/centro-treinamento/manual", icon: BookOpen, accent: "from-emerald-300/20 via-emerald-200/5 to-transparent" },
] as const;

export default function CentroTreinamento() {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<TrainingMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [agendadaPara, setAgendadaPara] = useState("");
  const canCreate = roles.includes("admin") || roles.includes("gestor_master");

  async function loadMeetings() {
    setLoading(true);
    try { setMeetings(await listarReunioesTreinamento()); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível carregar as reuniões."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadMeetings(); }, []);

  async function createMeeting(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const meeting = await criarReuniaoTreinamento({ titulo, descricao, agendada_para: agendadaPara ? new Date(agendadaPara).toISOString() : null });
      setDialogOpen(false); setTitulo(""); setDescricao(""); setAgendadaPara("");
      toast.success("Reunião criada com sucesso.");
      navigate(`/centro-treinamento/sala-reuniao/${meeting.id}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível criar a reunião."); }
    finally { setSaving(false); }
  }

  return <Layout>
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-700 bg-[#152647] px-6 py-8 text-white shadow-xl sm:px-10">
        <div className="absolute -right-16 -top-20 size-64 rounded-full bg-amber-300/15 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="mb-4 flex flex-wrap items-center gap-2"><Badge className="border-amber-300/30 bg-amber-300/10 text-amber-100">Novo espaço interno</Badge><span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-300">Centro Treinamento</span></div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Aprender, reunir e operar com clareza.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">A sala de reunião, o futuro catálogo de treinamentos e o Manual do sistema agora ficam reunidos em um único centro.</p>
        </div>
      </section>

      <section><div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Navegação central</p><h2 className="mt-1 text-xl font-semibold">Escolha uma área</h2></div><UsersRound className="size-5 text-muted-foreground" /></div>
        <div className="grid gap-4 lg:grid-cols-3">{menuCards.map((menu) => { const Icon = menu.icon; return <Link key={menu.title} to={menu.to} className="group"><Card className="relative h-full overflow-hidden border-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"><div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${menu.accent}`} /><CardHeader className="relative"><div className="flex items-start justify-between gap-3"><span className="flex size-11 items-center justify-center rounded-2xl bg-slate-900 text-amber-200 shadow-lg"><Icon className="size-5" /></span><Badge variant="secondary" className="bg-slate-100 text-slate-600">{menu.eyebrow}</Badge></div><CardTitle className="pt-3 text-lg">{menu.title}</CardTitle><CardDescription className="leading-6">{menu.description}</CardDescription></CardHeader><CardContent className="flex items-center gap-1 pt-0 text-sm font-semibold text-slate-700">Acessar área <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" /></CardContent></Card></Link>; })}</div>
      </section>

      <section><div className="mb-4 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Agenda de reuniões</p><h2 className="mt-1 text-xl font-semibold">Próximas salas</h2><p className="mt-1 text-sm text-muted-foreground">Reuniões e encontros da equipe.</p></div>{canCreate && <Button onClick={() => setDialogOpen(true)}><Plus className="size-4" /> Criar reunião</Button>}</div>
        {loading ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Carregando reuniões…</CardContent></Card> : meetings.length === 0 ? <Card><CardContent className="py-10 text-center"><CalendarDays className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">Nenhuma reunião cadastrada ainda.</p></CardContent></Card> : <div className="grid gap-3">{meetings.map((meeting) => <Card key={meeting.id} className="border-slate-200"><CardContent className="flex flex-wrap items-center justify-between gap-4 py-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold">{meeting.titulo}</h3><Badge variant="secondary">{meeting.status === "encerrada" ? "Encerrada" : meeting.status === "em_andamento" ? "Ao vivo" : "Agendada"}</Badge></div><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{meeting.descricao || "Sala aberta para treinamento da equipe."}</p>{meeting.agendada_para && <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="size-3.5" /> {new Date(meeting.agendada_para).toLocaleString("pt-BR")}</p>}</div><Link to={`/centro-treinamento/sala-reuniao/${meeting.id}`}><Button variant="outline">Entrar na sala <ChevronRight className="size-4" /></Button></Link></CardContent></Card>)}</div>}
      </section>
    </div>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent><form onSubmit={createMeeting}><DialogHeader><DialogTitle>Nova sala de reunião</DialogTitle><DialogDescription>Defina o tema da sala. O link poderá ser compartilhado com a equipe.</DialogDescription></DialogHeader><div className="grid gap-4 py-5"><div className="space-y-2"><Label htmlFor="reuniao-titulo">Título</Label><Input id="reuniao-titulo" value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Ex.: Onboarding do processo FAA" required minLength={3} /></div><div className="space-y-2"><Label htmlFor="reuniao-descricao">Descrição</Label><Textarea id="reuniao-descricao" value={descricao} onChange={(event) => setDescricao(event.target.value)} placeholder="Objetivo e orientações para os participantes" rows={4} /></div><div className="space-y-2"><Label htmlFor="reuniao-data">Agendar para (opcional)</Label><Input id="reuniao-data" type="datetime-local" value={agendadaPara} onChange={(event) => setAgendadaPara(event.target.value)} /></div></div><DialogFooter><Button type="submit" disabled={saving}>{saving ? "Criando…" : "Criar e abrir sala"}</Button></DialogFooter></form></DialogContent></Dialog>
  </Layout>;
}
