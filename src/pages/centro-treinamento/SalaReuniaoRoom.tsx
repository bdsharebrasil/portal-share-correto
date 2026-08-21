import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { MeetingRoom } from "@/components/centro-treinamento/MeetingRoom";
import { obterReuniaoTreinamento, obterPapelTreinamento, registrarParticipanteTreinamento, type TrainingMeeting } from "@/components/centro-treinamento/trainingService";

export default function SalaReuniaoRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const [meeting, setMeeting] = useState<TrainingMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userName = String(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email ?? "Participante");
  const isHost = Boolean(meeting && user && meeting.host_id === user.id && (roles.includes("admin") || roles.includes("gestor_master")));

  useEffect(() => {
    let active = true;
    if (!id) { setError("Sala não encontrada."); setLoading(false); return; }
    void obterReuniaoTreinamento(id).then((data) => { if (active) setMeeting(data); }).catch((err) => { if (active) setError(err instanceof Error ? err.message : "Sala não encontrada."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!meeting || !user) return;
    void registrarParticipanteTreinamento(meeting.id, userName).catch(() => undefined);
  }, [meeting, user, userName]);

  const leaveRoom = useCallback(() => navigate("/centro-treinamento/sala-reuniao"), [navigate]);
  if (loading) return <Layout><div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">Preparando a sala…</div></Layout>;
  if (error || !meeting || !user) return <Layout><div className="flex min-h-[60vh] items-center justify-center px-4"><Card className="max-w-md"><CardContent className="p-6 text-center"><h1 className="text-lg font-semibold">Sala não encontrada</h1><p className="mt-2 text-sm text-muted-foreground">{error || "Entre novamente no sistema para participar."}</p><button className="mt-5 rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950" onClick={leaveRoom}>Voltar para salas</button></CardContent></Card></div></Layout>;
  return <div className="min-h-screen bg-[#0b1323] px-4 py-6 text-white sm:px-6 lg:px-8"><MeetingRoom meeting={meeting} userId={user.id} userName={userName} isHost={isHost} onLeave={leaveRoom} /></div>;
}
